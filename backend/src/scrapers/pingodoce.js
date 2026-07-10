const https = require('https');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const matcher = require('../utils/matcher');

const DB_PATH = path.join(__dirname, '..', 'db', 'prices.db');

const requestOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,pt-PT;q=0.8,pt;q=0.7'
  }
};

// Helper to fetch HTML content, automatically following redirects
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, requestOptions, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let nextUrl = res.headers.location;
        if (!nextUrl.startsWith('http')) {
          nextUrl = 'https://www.pingodoce.pt' + nextUrl;
        }
        resolve(fetchHtml(nextUrl));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}. Status code: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Parses quantity string like "1 Kg" or "0.25 Kg" into size and unit
function parseQuantity(qtyStr) {
  if (!qtyStr) return { size: 1.0, unit: 'un' };
  
  const str = qtyStr.toLowerCase().replace('emb.', '').replace(/\s+/g, ' ').trim();
  
  // Match patterns like "1 kg", "250 g", "750 ml", "1 lt", "1.5 l", "6x1 l", "4 x 120 g", "0.25 kg"
  const match = str.match(/([\d.,x\s]+)\s*(lt|l|kg|g|ml)/i);
  if (match) {
    let sizeStr = match[1].replace(/\s+/g, '').replace(',', '.');
    let size = 1.0;
    
    // Check for multiplication like "6x1" or "4x120"
    if (sizeStr.includes('x')) {
      const parts = sizeStr.split('x');
      const qty = parseFloat(parts[0]);
      const weight = parseFloat(parts[1]);
      size = qty * weight;
    } else {
      size = parseFloat(sizeStr);
    }
    
    let unit = match[2].toUpperCase();
    if (unit === 'LT') unit = 'L';
    
    // Normalize to standard base units (KG and L)
    if (unit === 'G') {
      size = size / 1000.0;
      unit = 'KG';
    } else if (unit === 'ML') {
      size = size / 1000.0;
      unit = 'L';
    }
    return { size, unit };
  }
  return { size: 1.0, unit: 'un' };
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&acirc;/g, 'â')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&agrave;/g, 'à')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&ordm;/g, 'º')
    .replace(/&ordf;/g, 'ª');
}

// Extract product metadata and detail URLs from search results page
function extractProductsFromSearchHtml(html) {
  const products = [];
  
  // Match the single-quoted product data serialized for GTM/analytics
  const gtmRegex = /data-gtm-info='([^']+)'/g;
  let match;

  while ((match = gtmRegex.exec(html)) !== null) {
    const decoded = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');

    try {
      const gtmData = JSON.parse(decoded);
      const item = gtmData.items && gtmData.items[0];
      if (!item) continue;
      
      const matchIndex = match.index;
      
      // Look forward 6000 characters to find the product detail link, unit, and promos
      const context = html.substring(matchIndex, matchIndex + 6000);
      
      // Extract detail page URL
      const urlMatch = context.match(/href="([^"]+\/produtos\/[^"]+)"/i) || context.match(/href="([^"]+\/produto\/[^"]+)"/i) || context.match(/href="([^"]+)"/i);
      const detailUrl = urlMatch ? (urlMatch[1].startsWith('http') ? urlMatch[1] : 'https://www.pingodoce.pt' + urlMatch[1]) : null;

      // Extract image URL
      const imgMatch = context.match(/class="[^"]*product-tile-component-image[^"]*"[^>]*src="([^"]+)"/i) || context.match(/class="[^"]*product-tile-component-image[^"]*"[^>]*data-src="([^"]+)"/i);
      const imageUrl = imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : null;

      // Extract quantity string (before the | separator in class="product-unit")
      const unitMatch = context.match(/class="product-unit"[^>]*>([\s\S]*?)<\/div>/i);
      const quantityStr = unitMatch ? unitMatch[1].replace(/<[^>]*>/g, '').split('|')[0].trim() : null;

      // Extract sale info if present
      const isPromo = context.includes('reduced-price') || context.includes('strike-through') || context.includes('promo-badge') || context.includes('product-tile-promo-label') ? 1 : 0;
      
      // Find promo description
      const badgeMatch = context.match(/class="product-tile-promo-label"[^>]*alt="([^"]+)"/i) || context.match(/class="[^"]*badge[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const saleDetails = badgeMatch ? badgeMatch[1].replace(/<[^>]*>/g, '').trim() : (isPromo ? 'Promoção' : null);

      if (item.item_id && item.item_name && detailUrl) {
        products.push({
          storeProductId: item.item_id,
          name: decodeHtmlEntities(item.item_name),
          brand: decodeHtmlEntities(item.item_brand || 'Marca Própria'),
          rawCategory: decodeHtmlEntities(item.item_category || ''),
          price: parseFloat(item.price) || 0.0,
          detailUrl,
          imageUrl,
          quantityStr,
          isPromo,
          saleDetails: decodeHtmlEntities(saleDetails)
        });
      }
    } catch (err) {
      // Ignore parse errors
    }
  }

  // Deduplicate products by SKU
  const uniqueMap = {};
  products.forEach(p => {
    uniqueMap[p.storeProductId] = p;
  });
  return Object.values(uniqueMap);
}

// Database upsert transactions using fuzzy name matching
function saveProductToDb(db, product) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Get all canonical products to perform name matching
      db.all('SELECT * FROM products', [], (err, dbProducts) => {
        if (err) return reject(err);

        // Try to match the scraped product with a canonical one
        const matchResult = matcher.findBestMatch(product.name, product.brand, dbProducts);
        
        let productId;
        
        const saveStoreProductAndPrice = (prodId) => {
          const parsedQty = parseQuantity(product.quantityStr);
          
          // 2. Insert or update store product mapping
          db.get(
            'SELECT id FROM store_products WHERE product_id = ? AND store = "Pingo Doce"',
            [prodId],
            (err, spRow) => {
              if (err) return reject(err);

              if (spRow) {
                // Update mapping link & quantity
                db.run(
                  'UPDATE store_products SET store_product_id = ?, store_url = ?, package_size = ?, package_unit = ?, image_url = ? WHERE id = ?',
                  [product.storeProductId, product.detailUrl, parsedQty.size, parsedQty.unit, product.imageUrl, spRow.id],
                  (err) => {
                    if (err) return reject(err);
                    insertPriceHistory(spRow.id, parsedQty, prodId);
                  }
                );
              } else {
                // Create new mapping
                db.run(
                  'INSERT INTO store_products (product_id, store, store_product_id, store_url, package_size, package_unit, image_url) VALUES (?, "Pingo Doce", ?, ?, ?, ?, ?)',
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
          // Calculate unit factor (already normalized to KG/L in parseQuantity)
          const unitFactor = parsedQty.size;
          const pricePerUnit = Number((product.price / unitFactor).toFixed(2));
          const todayStr = new Date().toISOString().split('T')[0];

          // 3. Insert price history log
          db.run(
            `INSERT OR REPLACE INTO price_history (store_product_id, price, price_per_unit, is_on_sale, sale_details, record_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [storeProdId, product.price, pricePerUnit, product.isPromo, product.saleDetails, todayStr],
            (err) => {
              if (err) return reject(err);
              console.log(`Saved: ${product.name} (${product.brand}) @ Pingo Doce = €${product.price} (Canonical ID: ${prodId})`);
              resolve();
            }
          );
        };

        if (matchResult) {
          // Found matching canonical product!
          productId = matchResult.product.id;
          console.log(`Fuzzy Matched: "${product.name}" (${product.brand}) -> Canonical: "${matchResult.product.name}" (Score: ${matchResult.score.toFixed(2)})`);
          saveStoreProductAndPrice(productId);
        } else {
          // No match found, create a new canonical product with a mock barcode
          let category = 'Outros';
          const normCat = (product.rawCategory || '').toLowerCase();
          if (normCat.includes('leite')) category = 'Laticínios';
          else if (normCat.includes('arroz') || normCat.includes('massa') || normCat.includes('azeite') || normCat.includes('mercearia')) category = 'Mercearia';
          else if (normCat.includes('café') || normCat.includes('cafe')) category = 'Bebidas/Café';
          else if (normCat.includes('pão') || normCat.includes('padaria')) category = 'Padaria';

          const dummyEan = `PD-${product.storeProductId}`;
          
          console.log(`No match for: "${product.name}" (${product.brand}). Creating new canonical product.`);
          
          db.run(
            'INSERT INTO products (name, brand, category, barcode_ean) VALUES (?, ?, ?, ?)',
            [product.name, product.brand, category, dummyEan],
            function(err) {
              if (err) return reject(err);
              saveStoreProductAndPrice(this.lastID);
            }
          );
        }
      });
    });
  });
}

// Main execution flow
async function main() {
  const args = process.argv.slice(2);
  const query = args[0] || 'leite';
  
  console.log(`=== Starting Pingo Doce Scraper for query: "${query}" ===`);
  
  try {
    const searchUrl = `https://www.pingodoce.pt/on/demandware.store/Sites-pingo-doce-Site/default/Search-Show?q=${encodeURIComponent(query)}`;
    console.log(`Fetching search results page...`);
    const searchHtml = await fetchHtml(searchUrl);
    
    console.log('Extracting products metadata...');
    const products = extractProductsFromSearchHtml(searchHtml);
    console.log(`Found ${products.length} products on search page.`);
    
    // Process first 5 products to prevent spamming
    const limit = Math.min(products.length, 5);
    console.log(`Processing first ${limit} products and updating DB...`);
    
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
      }
    });

    for (let i = 0; i < limit; i++) {
      const p = products[i];
      console.log(`\n[${i + 1}/${limit}] Processing: "${p.name}" (${p.brand})`);
      
      // Delay slightly between requests to be polite
      await new Promise(r => setTimeout(r, 800));
      await saveProductToDb(db, p);
    }

    db.close();
    console.log('\n=== Pingo Doce Scraper Run Completed successfully! ===');
  } catch (err) {
    console.error('Scraper execution failed:', err.message);
  }
}

// Only execute if run directly
if (require.main === module) {
  main();
}
