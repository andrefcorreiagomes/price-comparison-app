const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'src', 'db', 'prices.db');
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening DB:', err.message);
    process.exit(1);
  }
});

const ean = '5603722524516';

db.serialize(() => {
  console.log(`=== Querying database records for EAN: ${ean} ===\n`);

  // 1. Query Products table
  db.get('SELECT * FROM products WHERE barcode_ean = ?', [ean], (err, product) => {
    if (err) throw err;
    console.log('1. PRODUCTS TABLE ROW:');
    console.log(JSON.stringify(product, null, 2));
    console.log('');

    if (product) {
      // 2. Query Store Products table
      db.all('SELECT * FROM store_products WHERE product_id = ?', [product.id], (err, mappings) => {
        if (err) throw err;
        console.log('2. STORE_PRODUCTS TABLE ROW(S):');
        console.log(JSON.stringify(mappings, null, 2));
        console.log('');

        if (mappings && mappings.length > 0) {
          const mappingIds = mappings.map(m => m.id);
          const placeholders = mappingIds.map(() => '?').join(',');

          // 3. Query Price History table
          db.all(
            `SELECT * FROM price_history WHERE store_product_id IN (${placeholders}) ORDER BY record_date DESC`,
            mappingIds,
            (err, history) => {
              if (err) throw err;
              console.log('3. PRICE_HISTORY TABLE ROW(S):');
              console.log(JSON.stringify(history, null, 2));
              db.close();
            }
          );
        } else {
          db.close();
        }
      });
    } else {
      console.log('No product found with this EAN.');
      db.close();
    }
  });
});
