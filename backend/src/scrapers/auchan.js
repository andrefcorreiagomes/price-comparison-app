const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const matcher = require('../utils/matcher');

// Helper to parse quantity details from name/package string
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

  // 2. Simple quantity checks, e.g. "250 g", "1 kg", "750 ml", "1l", "1.5 l"
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

// Fetch search results from Auchan Portugal website (supports up to 3 redirects)
function fetchAuchanProducts(query, redirectUrl = null, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 3) {
      return reject(new Error('Too many redirects'));
    }

    const url = redirectUrl || `https://www.auchan.pt/pt/pesquisa?q=${encodeURIComponent(query)}`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        let loc = res.headers.location;
        if (loc) {
          if (loc.startsWith('/')) {
            loc = `https://www.auchan.pt${loc}`;
          }
          console.log(`Following redirect to: ${loc}`);
          return resolve(fetchAuchanProducts(query, loc, depth + 1));
        }
      }

      let html = '';
      
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch Auchan search page, status: ${res.statusCode}`));
      }

      res.on('data', (chunk) => {
        html += chunk;
      });

      res.on('end', () => {
        try {
          const tiles = [];
          const tileStartRegex = /<div[^>]*class="[^"]*product-tile[^"]*"[^>]*>/gi;
          let match;
          
          while ((match = tileStartRegex.exec(html)) !== null) {
            // Stop early if we have enough items (e.g. max 8 to prevent scraping thousands of products)
            if (tiles.length >= 8) {
              break;
            }
            
            const startIdx = match.index;
            const chunk = html.slice(startIdx, startIdx + 5000);
            
            const gtmAttr = chunk.match(/data-gtm="([^"]+)"/i);
            const urlsAttr = chunk.match(/data-urls="([^"]+)"/i);
            const imgAttr = chunk.match(/<img[^>]+data-src="([^"]+)"/i) || chunk.match(/<img[^>]+src="([^"]+)"/i);
            
            if (gtmAttr) {
              try {
                const gtmJsonStr = gtmAttr[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                const gtm = JSON.parse(gtmJsonStr);
                
                const name = gtm.name || '';
                const id = gtm.id || '';
                const price = parseFloat(gtm.price || 0);
                const brand = gtm.brand || '';
                const category = gtm.category || '';
                
                if (!id || isNaN(price) || price <= 0) {
                  continue;
                }
                
                let productUrl = '';
                if (urlsAttr) {
                  const urlsJsonStr = urlsAttr[1].replace(/&quot;/g, '"');
                  const urls = JSON.parse(urlsJsonStr);
                  productUrl = urls.productUrl || '';
                }
                
                const imageUrl = imgAttr ? imgAttr[1] : null;
                const discount = parseFloat(gtm.discount || 0);
                
                tiles.push({
                  storeProductId: id,
                  name: name,
                  brand: brand,
                  price: price,
                  imageUrl: imageUrl,
                  detailUrl: productUrl ? `https://www.auchan.pt${productUrl}` : 'https://www.auchan.pt',
                  quantityStr: name, // Parse size directly from product title (e.g., "LEITE AUCHAN UHT MEIO GORDO SLIM 1L")
                  isPromo: discount > 0 ? 1 : 0,
                  saleDetails: discount > 0 ? `Desconto: €${discount.toFixed(2)}` : '',
                  rawCategory: category
                });
              } catch (e) {
                // Ignore parser errors for specific tiles
              }
            }
          }
          
          // Deduplicate by store product ID
          const uniqueMap = {};
          tiles.forEach(t => {
            uniqueMap[t.storeProductId] = t;
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
            'SELECT id FROM store_products WHERE product_id = ? AND store = "Auchan"',
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
                  'INSERT INTO store_products (product_id, store, store_product_id, store_url, package_size, package_unit, image_url) VALUES (?, "Auchan", ?, ?, ?, ?, ?)',
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
              console.log(`Saved: ${product.name} (${product.brand}) @ Auchan = €${product.price} (Canonical ID: ${prodId})`);
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
          const normName = product.name.toLowerCase();
          
          if (normCat.includes('leite') || normName.includes('leite')) category = 'Laticínios';
          else if (normCat.includes('arroz') || normName.includes('arroz') || normCat.includes('massa') || normName.includes('massa') || normCat.includes('azeite') || normName.includes('azeite')) category = 'Mercearia';
          else if (normCat.includes('café') || normCat.includes('cafe') || normName.includes('café') || normName.includes('cafe')) category = 'Bebidas/Café';
          else if (normCat.includes('pão') || normCat.includes('pao') || normName.includes('pão') || normName.includes('pao')) category = 'Padaria';

          db.run(
            'INSERT INTO products (name, brand, category, barcode_ean) VALUES (?, ?, ?, ?)',
            [product.name, product.brand, category, `AUCHAN-${product.storeProductId}`],
            function(err) {
              if (err) return reject(err);
              productId = this.lastID;
              console.log(`Created new Canonical product: ${product.name} (Canonical ID: ${productId})`);
              saveStoreProductAndPrice(productId);
            }
          );
        }
      });
    });
  });
}

// Orchestrator main loop
async function run(searchQuery) {
  const query = searchQuery || process.argv[2];
  if (!query) {
    console.error('Please provide a search query argument, e.g., node auchan.js "leite"');
    process.exit(1);
  }

  console.log(`=== Starting Auchan Scraper for query: "${query}" ===`);
  const dbPath = path.join(__dirname, '..', 'db', 'prices.db');
  const db = new sqlite3.Database(dbPath);

  try {
    const products = await fetchAuchanProducts(query);
    console.log(`Found ${products.length} products on Auchan site for "${query}" (capped).`);
    
    for (const p of products) {
      await saveProductToDb(db, p);
    }
  } catch (err) {
    console.error('Scraper run failed:', err);
  } finally {
    db.close();
    console.log('=== Auchan Scraper Run Completed ===');
  }
}

// Execute if run directly
if (require.main === module) {
  run();
}

module.exports = {
  fetchAuchanProducts,
  saveProductToDb,
  run
};
