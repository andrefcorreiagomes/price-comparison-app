const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'src', 'db', 'prices.db');
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening DB:', err.message);
    process.exit(1);
  }
});

db.all('SELECT * FROM products', [], (err, rows) => {
  if (err) throw err;
  console.log(`=== ALL PRODUCTS IN DATABASE (${rows.length} products) ===`);
  rows.forEach(r => {
    console.log(`- [ID: ${r.id}] ${r.name} (${r.brand}) [EAN: ${r.barcode_ean}]`);
  });
  db.close();
});
