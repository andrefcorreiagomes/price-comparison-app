const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'db', 'prices.db');

app.use(cors());
app.use(express.json());

// Helper to open connection to SQLite database
function getDbConnection() {
  return new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error connecting to SQLite:', err.message);
    }
  });
}

/**
 * GET /api/products
 * Query products with optional search and category filters.
 * Returns products with their LATEST price from Continente and Pingo Doce.
 */
app.get('/api/products', (req, res) => {
  const db = getDbConnection();
  const { q, category } = req.query;

  let query = `
    SELECT 
      p.id as product_id, p.name, p.brand, p.category, p.barcode_ean,
      sp.id as store_product_id, sp.store, sp.store_product_id as sku, sp.store_url, sp.package_size, sp.package_unit, sp.image_url,
      ph.price, ph.price_per_unit, ph.is_on_sale, ph.sale_details, ph.record_date
    FROM products p
    LEFT JOIN store_products sp ON p.id = sp.product_id
    LEFT JOIN price_history ph ON sp.id = ph.store_product_id
    WHERE ph.record_date = (
      SELECT MAX(record_date) 
      FROM price_history 
      WHERE store_product_id = sp.id
    )
  `;
  
  const params = [];

  if (q) {
    query += ` AND (p.name LIKE ? OR p.brand LIKE ? OR p.barcode_ean = ?)`;
    const searchWildcard = `%${q}%`;
    params.push(searchWildcard, searchWildcard, q);
  }

  if (category) {
    query += ` AND p.category = ?`;
    params.push(category);
  }

  db.all(query, params, (err, rows) => {
    db.close();
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database query failed' });
    }

    // Group rows by canonical product ID
    const productsMap = {};

    rows.forEach(row => {
      const { product_id, name, brand, category, barcode_ean } = row;
      
      if (!productsMap[product_id]) {
        productsMap[product_id] = {
          id: product_id,
          name,
          brand,
          category,
          barcode_ean,
          prices: {}
        };
      }

      if (row.store) {
        productsMap[product_id].prices[row.store] = {
          storeProductId: row.store_product_id,
          sku: row.sku,
          url: row.store_url,
          packageSize: row.package_size,
          packageUnit: row.package_unit,
          imageUrl: row.image_url,
          price: row.price,
          pricePerUnit: row.price_per_unit,
          isOnSale: !!row.is_on_sale,
          saleDetails: row.sale_details,
          date: row.record_date
        };
      }
    });

    res.json(Object.values(productsMap));
  });
});

/**
 * GET /api/products/:id/history
 * Fetch 30-day historical prices for a specific product, formatted for charts.
 */
app.get('/api/products/:id/history', (req, res) => {
  const db = getDbConnection();
  const productId = req.params.id;

  const query = `
    SELECT 
      ph.record_date as date,
      sp.store,
      ph.price,
      ph.price_per_unit,
      ph.is_on_sale,
      ph.sale_details
    FROM price_history ph
    JOIN store_products sp ON ph.store_product_id = sp.id
    WHERE sp.product_id = ?
    ORDER BY ph.record_date ASC
  `;

  db.all(query, [productId], (err, rows) => {
    db.close();
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    // Group by date
    const historyMap = {};

    rows.forEach(row => {
      if (!historyMap[row.date]) {
        historyMap[row.date] = { date: row.date };
      }
      historyMap[row.date][row.store] = {
        price: row.price,
        pricePerUnit: row.price_per_unit,
        isOnSale: !!row.is_on_sale,
        saleDetails: row.sale_details
      };
    });

    // Convert map to sorted array
    const sortedHistory = Object.values(historyMap).sort((a, b) => a.date.localeCompare(b.date));
    res.json(sortedHistory);
  });
});

/**
 * POST /api/basket/compare
 * Body: { items: [ { productId: Number, quantity: Number }, ... ] }
 * Compares the total cost of the shopping basket at Continente vs. Pingo Doce.
 */
app.post('/api/basket/compare', (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid items array' });
  }

  const db = getDbConnection();

  // Extract all product IDs
  const productIds = items.map(item => item.productId);
  const placeholders = productIds.map(() => '?').join(',');

  // Query latest prices for all target products
  const query = `
    SELECT 
      p.id as product_id, p.name, p.brand,
      sp.store, sp.package_size, sp.package_unit,
      ph.price, ph.price_per_unit
    FROM products p
    JOIN store_products sp ON p.id = sp.product_id
    JOIN price_history ph ON sp.id = ph.store_product_id
    WHERE p.id IN (${placeholders})
      AND ph.record_date = (
        SELECT MAX(record_date) 
        FROM price_history 
        WHERE store_product_id = sp.id
      )
  `;

  db.all(query, productIds, (err, rows) => {
    db.close();
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to compare basket' });
    }

    // Build lookup map for products
    const productPriceMap = {};
    rows.forEach(row => {
      if (!productPriceMap[row.product_id]) {
        productPriceMap[row.product_id] = {};
      }
      productPriceMap[row.product_id][row.store] = {
        price: row.price,
        name: row.name,
        brand: row.brand,
        packageSize: row.package_size,
        packageUnit: row.package_unit
      };
    });

    const stores = ['Continente', 'Pingo Doce', 'Lidl', 'Auchan']; // Predefined stores list to ensure correct columns

    // Initialize store totals
    const storeTotals = {};
    stores.forEach(store => {
      storeTotals[store] = 0;
    });

    const itemsDetails = [];

    items.forEach(item => {
      const { productId, quantity } = item;
      const prices = productPriceMap[productId];

      if (prices) {
        const itemPrices = {};
        const itemSubtotals = {};
        
        let name = 'Unknown Product';
        let brand = '';
        
        stores.forEach(store => {
          const storeData = prices[store];
          const price = storeData ? storeData.price : null;
          itemPrices[store] = price;
          
          const subtotal = price !== null ? price * quantity : 0;
          itemSubtotals[store] = Number(subtotal.toFixed(2));
          
          if (storeData) {
            name = storeData.name;
            brand = storeData.brand;
            storeTotals[store] += subtotal;
          }
        });

        itemsDetails.push({
          productId,
          name,
          brand,
          quantity,
          prices: itemPrices,
          subtotals: itemSubtotals
        });
      }
    });

    // Format totals and find winner
    const formattedTotals = {};
    let cheaperStore = 'Tie';
    let minTotal = Infinity;
    
    // For savings, we compare the difference between the cheapest and next cheapest or standard
    stores.forEach(store => {
      const total = Number(storeTotals[store].toFixed(2));
      formattedTotals[store] = total;
      
      // Cheaper store must have a valid total > 0 (to avoid N/A stores winning)
      if (total > 0 && total < minTotal) {
        minTotal = total;
        cheaperStore = store;
      }
    });

    // Calculate savings against the next cheapest (or standard diff if 2 stores)
    let savings = 0;
    const sortedTotals = Object.entries(formattedTotals)
      .filter(([_, t]) => t > 0)
      .sort((a, b) => a[1] - b[1]);

    if (sortedTotals.length >= 2) {
      // Savings = difference between second cheapest and cheapest
      savings = Number((sortedTotals[1][1] - sortedTotals[0][1]).toFixed(2));
    }

    res.json({
      totals: formattedTotals,
      cheaperStore,
      savings,
      items: itemsDetails
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
