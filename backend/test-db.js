const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'src', 'db', 'prices.db');
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening DB:', err.message);
    process.exit(1);
  }
  console.log('Connected to prices.db successfully!');
});

db.serialize(() => {
  // 1. Check products count
  db.get('SELECT COUNT(*) as count FROM products', [], (err, row) => {
    if (err) throw err;
    console.log(`Total canonical products: ${row.count}`);
  });

  // 2. Check store mappings
  db.get('SELECT COUNT(*) as count FROM store_products', [], (err, row) => {
    if (err) throw err;
    console.log(`Total store product mappings: ${row.count}`);
  });

  // 3. Check price history count
  db.get('SELECT COUNT(*) as count FROM price_history', [], (err, row) => {
    if (err) throw err;
    console.log(`Total price history records: ${row.count}`);
  });

  // 4. Test product retrieval with latest prices
  const latestPricesQuery = `
    SELECT 
      p.name, sp.store, ph.price, ph.record_date
    FROM products p
    JOIN store_products sp ON p.id = sp.product_id
    JOIN price_history ph ON sp.id = ph.store_product_id
    WHERE ph.record_date = (
      SELECT MAX(record_date) 
      FROM price_history 
      WHERE store_product_id = sp.id
    )
    LIMIT 4
  `;

  console.log('\nSample Latest Prices:');
  db.all(latestPricesQuery, [], (err, rows) => {
    if (err) throw err;
    rows.forEach(r => {
      console.log(`- ${r.name} at ${r.store}: €${r.price} (Date: ${r.record_date})`);
    });
    db.close();
  });
});
