const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const matcher = require('../utils/matcher');

// Helper to normalize quantities to base units (KG / L)
function parseQuantity(qtyStr) {
  if (!qtyStr) return { size: 1.0, unit: 'un' };
  
  const str = qtyStr.toLowerCase().replace(',', '.');
  
  // 1. Pack multiplier checks, e.g. "pack 4x200 ml", "4 x 120 g", "4x120g"
  const packMatch = str.match(/(?:pack\s+)?(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(g|ml|kg|l|cl)/i);
  if (packMatch) {
    const count = parseInt(packMatch[1], 10);
    const size = parseFloat(packMatch[2]);
    const unit = packMatch[3].toUpperCase();
    let totalSize = count * size;
    
    if (unit === 'G') {
      return { size: Number((totalSize / 1000.0).toFixed(3)), unit: 'KG' };
    } else if (unit === 'ML') {
      return { size: Number((totalSize / 1000.0).toFixed(3)), unit: 'L' };
    } else if (unit === 'CL') {
      return { size: Number((totalSize / 100.0).toFixed(3)), unit: 'L' };
    } else if (unit === 'KG') {
      return { size: Number(totalSize.toFixed(3)), unit: 'KG' };
    } else if (unit === 'L') {
      return { size: Number(totalSize.toFixed(3)), unit: 'L' };
    }
  }

  // 2. Simple quantity checks, e.g. "250 g", "1 kg", "750 ml", "0.75 l"
  const simpleMatch = str.match(/(\d+(?:\.\d+)?)\s*(g|ml|kg|l|cl)/i);
  if (simpleMatch) {
    const size = parseFloat(simpleMatch[1]);
    const unit = simpleMatch[2].toUpperCase();
    
    if (unit === 'G') {
      return { size: Number((size / 1000.0).toFixed(3)), unit: 'KG' };
    } else if (unit === 'ML') {
      return { size: Number((size / 1000.0).toFixed(3)), unit: 'L' };
    } else if (unit === 'CL') {
      return { size: Number((size / 100.0).toFixed(3)), unit: 'L' };
    } else if (unit === 'KG') {
      return { size: Number(size.toFixed(3)), unit: 'KG' };
    } else if (unit === 'L') {
      return { size: Number(size.toFixed(3)), unit: 'L' };
    }
  }

  return { size: 1.0, unit: 'un' };
}

// Fetch Lidl Search API
function fetchLidlProducts(query) {
  return new Promise((resolve, reject) => {
    const url = `https://www.lidl.pt/q/api/search?q=${encodeURIComponent(query)}&assortment=PT&locale=pt_PT&version=v2.0.0`;
    
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      if (res.statusCode !== 200) {
        return reject(new Error(`Lidl API error: Status ${res.statusCode}`));
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const rawItems = json.items || [];
          const products = [];

          rawItems.forEach(item => {
            if (!item.gridbox || !item.gridbox.data) return;

            const gb = item.gridbox.data;
            const priceVal = gb.price?.price;
            if (!priceVal || priceVal <= 0) return; // Skip items without price

            const name = gb.keyfacts?.fullTitle || gb.title || item.label || '';
            const brand = (gb.brand && typeof gb.brand === 'object' && gb.brand.name) 
              ? gb.brand.name 
              : (typeof gb.brand === 'string' ? gb.brand : (gb.keyfacts?.analyticsCategory || ''));
            const storeProductId = String(gb.productId || item.code || gb.erpNumber);
            const detailUrl = item.url ? `https://www.lidl.pt${item.url}` : 'https://www.lidl.pt';
            const imageUrl = gb.image || null;
            const quantityStr = gb.price?.packaging?.text || gb.title || '';
            const isPromo = (gb.price?.discount?.showDiscount || gb.price?.discount?.discountText) ? 1 : 0;
            const saleDetails = gb.price?.discount?.discountText || '';
            const rawCategory = gb.keyfacts?.wonCategoryPrimary || '';

            products.push({
              storeProductId,
              name,
              brand,
              price: priceVal,
              imageUrl,
              detailUrl,
              quantityStr,
              isPromo,
              saleDetails,
              rawCategory
            });
          });

          // Deduplicate by Store Product ID
          const uniqueMap = {};
          products.forEach(p => {
            uniqueMap[p.storeProductId] = p;
          });
          resolve(Object.values(uniqueMap));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Save scraped product to SQLite database
function saveProductToDb(db, product) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.all('SELECT * FROM products', [], (err, dbProducts) => {
        if (err) return reject(err);

        const parsedQty = parseQuantity(product.quantityStr);
        const matchResult = matcher.findBestMatch(product.name, product.brand, dbProducts, parsedQty.size);

        let productId;

        const saveStoreProductAndPrice = (prodId) => {
          db.get(
            'SELECT id FROM store_products WHERE product_id = ? AND store = "Lidl"',
            [prodId],
            (err, spRow) => {
              if (err) return reject(err);

              if (spRow) {
                // Update existing mapping
                db.run(
                  'UPDATE store_products SET store_product_id = ?, store_url = ?, package_size = ?, package_unit = ?, image_url = ? WHERE id = ?',
                  [product.storeProductId, product.detailUrl, parsedQty.size, parsedQty.unit, product.imageUrl, spRow.id],
                  (err) => {
                    if (err) return reject(err);
                    insertPriceHistory(spRow.id, parsedQty, prodId);
                  }
                );
              } else {
                // Insert new mapping
                db.run(
                  'INSERT INTO store_products (product_id, store, store_product_id, store_url, package_size, package_unit, image_url) VALUES (?, "Lidl", ?, ?, ?, ?, ?)',
                  [prodId, product.storeProductId, product.detailUrl, parsedQty.size, parsedQty.unit, product.imageUrl],
                  function(err) {
                    if (err) return reject(err);
                    insertPriceHistory(this.lastID, parsedQty, prodId);
                  }
                );
              }
            }
          );
        };

        const insertPriceHistory = (storeProdId, parsedQty, prodId) => {
          const unitFactor = parsedQty.size;
          const pricePerUnit = Number((product.price / unitFactor).toFixed(2));
          const todayStr = new Date().toISOString().split('T')[0];

          db.run(
            `INSERT OR REPLACE INTO price_history (store_product_id, price, price_per_unit, is_on_sale, sale_details, record_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [storeProdId, product.price, pricePerUnit, product.isPromo, product.saleDetails, todayStr],
            (err) => {
              if (err) return reject(err);
              console.log(`Saved: ${product.name} (${product.brand}) @ Lidl = €${product.price} (Canonical ID: ${prodId})`);
              resolve();
            }
          );
        };

        if (matchResult) {
          productId = matchResult.product.id;
          console.log(`Fuzzy Matched: "${product.name}" (${product.brand}) -> Canonical: "${matchResult.product.name}" (Score: ${matchResult.score.toFixed(2)})`);
          saveStoreProductAndPrice(productId);
        } else {
          // No match, create a new product
          let category = 'Outros';
          const normCat = (product.rawCategory || '').toLowerCase();
          if (normCat.includes('leite')) category = 'Laticínios';
          else if (normCat.includes('arroz') || normCat.includes('massa') || normCat.includes('azeite') || normCat.includes('mercearia')) category = 'Mercearia';
          else if (normCat.includes('café') || normCat.includes('cafe')) category = 'Bebidas/Café';
          else if (normCat.includes('pão') || normCat.includes('padaria')) category = 'Padaria';

          const dummyEan = `LIDL-${product.storeProductId}`;

          console.log(`No match for: "${product.name}" (${product.brand}). Creating new canonical product.`);

          db.run(
            'INSERT INTO products (name, brand, category, barcode_ean) VALUES (?, ?, ?, ?)',
            [product.name, product.brand, category, dummyEan],
            function(err) {
              if (err) return reject(err);
              productId = this.lastID;
              saveStoreProductAndPrice(productId);
            }
          );
        }
      });
    });
  });
}

// Scrape query and save results
async function scrape(query) {
  console.log(`=== Starting Lidl Scraper for query: "${query}" ===`);
  const db = new sqlite3.Database(path.join(__dirname, '../db/prices.db'));

  try {
    const products = await fetchLidlProducts(query);
    console.log(`Found ${products.length} products on Lidl API for "${query}".`);

    for (const prod of products) {
      try {
        await saveProductToDb(db, prod);
      } catch (err) {
        console.error(`Error saving product ${prod.name}:`, err);
      }
    }
  } catch (err) {
    console.error("Lidl scraper error:", err);
  } finally {
    db.close();
    console.log('=== Lidl Scraper Run Completed ===\n');
  }
}

// Enable direct run
if (require.main === module) {
  const query = process.argv[2] || 'leite';
  scrape(query);
}

module.exports = { scrape };
