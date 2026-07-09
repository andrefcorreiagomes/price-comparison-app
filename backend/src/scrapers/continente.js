const https = require('https');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

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
          nextUrl = 'https://www.continente.pt' + nextUrl;
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

// Parses quantity string like "emb. 1 lt" into size and unit
function parseQuantity(qtyStr) {
  if (!qtyStr) return { size: 1.0, unit: 'L' };
  
  const str = qtyStr.toLowerCase().replace('emb.', '').replace(/\s+/g, ' ').trim();
  
  // Match patterns like "1 kg", "250 g", "750 ml", "1 lt", "1.5 l", "6x1 l", "4 x 120 g"
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
  
  // Match the single-quoted product data serialized for analytics
  const impressionRegex = /data-product-tile-impression='([^']+)'/g;
  let match;

  while ((match = impressionRegex.exec(html)) !== null) {
    // Basic JSON decode for structure
    const decoded = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');

    try {
      const productMeta = JSON.parse(decoded);
      
      // Find the position in HTML to search for surrounding detail URL and quantity
      const matchIndex = match.index;
      
      // Look forward 8000 characters to find the product detail link and quantity
      const context = html.substring(matchIndex, matchIndex + 8000);
      
      // Extract detail page URL (Demandware standard product link)
      const urlMatch = context.match(/href="([^"]+\/produto\/[^"]+)"/i);
      const detailUrl = urlMatch ? (urlMatch[1].startsWith('http') ? urlMatch[1] : 'https://www.continente.pt' + urlMatch[1]) : null;

      // Extract quantity string
      const qtyMatch = context.match(/class="pwc-tile--quantity"[^>]*>([\s\S]*?)<\/p>/i);
      const quantityStr = qtyMatch ? qtyMatch[1].replace(/<[^>]*>/g, '').trim() : null;

      // Extract sale info if present
      const isPromo = context.includes('pwc-badge') || context.includes('pwc-tile--badge') ? 1 : 0;
      
      // Check if price discount is displayed in the badge
      const badgeMatch = context.match(/class="[^"]*pwc-badge[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const saleDetails = badgeMatch ? badgeMatch[1].replace(/<[^>]*>/g, '').trim() : (isPromo ? 'Promoção' : null);

      if (productMeta.id && productMeta.name && detailUrl) {
        products.push({
          storeProductId: productMeta.id,
          name: decodeHtmlEntities(productMeta.name),
          brand: decodeHtmlEntities(productMeta.brand || 'Marca Própria'),
          category: decodeHtmlEntities(productMeta.category || 'Outros'),
          price: parseFloat(productMeta.price) || 0.0,
          detailUrl,
          quantityStr,
          isPromo,
          saleDetails: decodeHtmlEntities(saleDetails)
        });
      }
    } catch (err) {
      // Ignore parse errors on corrupted elements
    }
  }

  // Deduplicate products by SKU
  const uniqueMap = {};
  products.forEach(p => {
    uniqueMap[p.storeProductId] = p;
  });
  return Object.values(uniqueMap);
}

// Scrape EAN from the detail page HTML
async function scrapeProductEan(detailUrl) {
  try {
    const detailHtml = await fetchHtml(detailUrl);
    // Find EAN in tab URL parameters
    const eanMatch = detailHtml.match(/ean=(\d{13})/i);
    if (eanMatch) {
      return eanMatch[1];
    }
    // Fallback: search for gtin13 in JSON-LD structure
    const gtinMatch = detailHtml.match(/"gtin13"\s*:\s*"(\d{13})"/i);
    if (gtinMatch) {
      return gtinMatch[1];
    }
    return null;
  } catch (err) {
    console.error(`Failed to scrape EAN from ${detailUrl}:`, err.message);
    return null;
  }
}

// Database upsert transactions
function saveProductToDb(db, product) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Insert or find canonical product
      db.get('SELECT id FROM products WHERE barcode_ean = ?', [product.ean], (err, row) => {
        if (err) return reject(err);

        let productId;
        const saveStoreProductAndPrice = (prodId) => {
          // 2. Insert or update store product mapping
          const parsedQty = parseQuantity(product.quantityStr);
          
          db.get(
            'SELECT id FROM store_products WHERE product_id = ? AND store = "Continente"',
            [prodId],
            (err, spRow) => {
              if (err) return reject(err);

              if (spRow) {
                // Update mapping link & quantity
                db.run(
                  'UPDATE store_products SET store_product_id = ?, store_url = ?, package_size = ?, package_unit = ? WHERE id = ?',
                  [product.storeProductId, product.detailUrl, parsedQty.size, parsedQty.unit, spRow.id],
                  (err) => {
                    if (err) return reject(err);
                    insertPriceHistory(spRow.id, parsedQty);
                  }
                );
              } else {
                // Create new mapping
                db.run(
                  'INSERT INTO store_products (product_id, store, store_product_id, store_url, package_size, package_unit) VALUES (?, "Continente", ?, ?, ?, ?)',
                  [prodId, product.storeProductId, product.detailUrl, parsedQty.size, parsedQty.unit],
                  function(err) {
                    if (err) return reject(err);
                    insertPriceHistory(this.lastID, parsedQty);
                  }
                );
              }
            }
          );
        };

        const insertPriceHistory = (storeProdId, parsedQty) => {
          // Calculate unit factor
          let unitFactor = parsedQty.size;
          if (parsedQty.unit === 'G' || parsedQty.unit === 'ML') {
            unitFactor = parsedQty.size / 1000.0;
          }
          const pricePerUnit = Number((product.price / unitFactor).toFixed(2));
          const todayStr = new Date().toISOString().split('T')[0];

          // 3. Insert price history log
          db.run(
            `INSERT OR REPLACE INTO price_history (store_product_id, price, price_per_unit, is_on_sale, sale_details, record_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [storeProdId, product.price, pricePerUnit, product.isPromo, product.saleDetails, todayStr],
            (err) => {
              if (err) return reject(err);
              console.log(`Saved: ${product.name} @ Continente = €${product.price} (EAN: ${product.ean})`);
              resolve();
            }
          );
        };

        if (row) {
          // Exists in DB, map to existing canonical product
          productId = row.id;
          saveStoreProductAndPrice(productId);
        } else {
          // Brand name or generic matching
          let category = 'Outros';
          if (product.category.includes('Leite')) category = 'Laticínios';
          else if (product.category.includes('Arroz') || product.category.includes('Massa') || product.category.includes('Azeite')) category = 'Mercearia';
          else if (product.category.includes('Café')) category = 'Bebidas/Café';
          else if (product.category.includes('Pão') || product.category.includes('Padaria')) category = 'Padaria';

          // Insert new canonical product
          db.run(
            'INSERT INTO products (name, brand, category, barcode_ean) VALUES (?, ?, ?, ?)',
            [product.name, product.brand, category, product.ean],
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
  
  console.log(`=== Starting Continente Scraper for query: "${query}" ===`);
  
  try {
    const searchUrl = `https://www.continente.pt/pesquisa/?q=${encodeURIComponent(query)}`;
    console.log(`Fetching search results page...`);
    const searchHtml = await fetchHtml(searchUrl);
    
    console.log('Extracting products metadata...');
    const products = extractProductsFromSearchHtml(searchHtml);
    console.log(`Found ${products.length} products on search page.`);
    
    // Limit EAN fetches to first 5 products to prevent spamming their server in a run
    const limit = Math.min(products.length, 5);
    console.log(`Processing first ${limit} products (fetching EANs and updating DB)...`);
    
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
      }
    });

    for (let i = 0; i < limit; i++) {
      const p = products[i];
      console.log(`\n[${i + 1}/${limit}] Fetching EAN for SKU ${p.storeProductId}: "${p.name}"`);
      
      // Delay slightly between requests (1 second) to be polite
      await new Promise(r => setTimeout(r, 1000));
      
      const ean = await scrapeProductEan(p.detailUrl);
      if (ean) {
        p.ean = ean;
        await saveProductToDb(db, p);
      } else {
        console.warn(`Could not extract EAN for "${p.name}". Skipping.`);
      }
    }

    db.close();
    console.log('\n=== Continente Scraper Run Completed successfully! ===');
  } catch (err) {
    console.error('Scraper execution failed:', err.message);
  }
}

main();
