const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'src', 'db', 'prices.db');
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening DB:', err.message);
    process.exit(1);
  }
});

// We want to query products with ID 16, 17, 18, 19, 20
const productIds = [16, 17, 18, 19, 20];
const placeholders = productIds.map(() => '?').join(',');

db.serialize(() => {
  console.log(`=== Querying database records for Product IDs: ${productIds.join(', ')} ===\n`);

  // 1. Query Products
  db.all(`SELECT id, name, barcode_ean FROM products WHERE id IN (${placeholders})`, productIds, (err, products) => {
    if (err) throw err;
    
    // Map product info for easier display
    const prodMap = {};
    products.forEach(p => { prodMap[p.id] = p; });

    // 2. Query Store Products mappings
    db.all(`SELECT * FROM store_products WHERE product_id IN (${placeholders})`, productIds, (err, mappings) => {
      if (err) throw err;
      console.log('--- STORE_PRODUCTS ROWS ---');
      console.log(JSON.stringify(mappings, null, 2));
      console.log('');

      if (mappings && mappings.length > 0) {
        const mappingIds = mappings.map(m => m.id);
        const historyPlaceholders = mappingIds.map(() => '?').join(',');

        // 3. Query Price History logs
        db.all(
          `SELECT ph.*, sp.product_id 
           FROM price_history ph 
           JOIN store_products sp ON ph.store_product_id = sp.id 
           WHERE ph.store_product_id IN (${historyPlaceholders}) 
           ORDER BY ph.record_date DESC`,
          mappingIds,
          (err, history) => {
            if (err) throw err;
            console.log('--- PRICE_HISTORY ROWS ---');
            
            // Format output nicely with product names
            const formattedHistory = history.map(h => ({
              id: h.id,
              store_product_id: h.store_product_id,
              product_name: prodMap[h.product_id] ? prodMap[h.product_id].name : 'Unknown',
              price: h.price,
              price_per_unit: h.price_per_unit,
              is_on_sale: !!h.is_on_sale,
              sale_details: h.sale_details,
              record_date: h.record_date
            }));

            console.log(JSON.stringify(formattedHistory, null, 2));
            db.close();
          }
        );
      } else {
        db.close();
      }
    });
  });
});
