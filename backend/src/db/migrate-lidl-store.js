const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'prices.db');
console.log("Migrating database at:", dbPath);
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("Disabling foreign keys...");
  db.run("PRAGMA foreign_keys=OFF;");

  console.log("Beginning transaction...");
  db.run("BEGIN TRANSACTION;");

  // Check if store_products has the old check constraint
  // We can rename it, create the new table, copy data, and drop the old one
  console.log("Renaming store_products to _store_products_old...");
  db.run("ALTER TABLE store_products RENAME TO _store_products_old;", (err) => {
    if (err) {
      console.error("Error renaming table:", err);
      db.run("ROLLBACK;");
      db.close();
      process.exit(1);
    }
  });

  console.log("Creating new store_products table with 'Lidl' check constraint...");
  db.run(`
    CREATE TABLE store_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        store TEXT NOT NULL CHECK(store IN ('Continente', 'Pingo Doce', 'Lidl')),
        store_product_id TEXT NOT NULL,
        store_url TEXT,
        package_size REAL NOT NULL,
        package_unit TEXT NOT NULL,
        image_url TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `, (err) => {
    if (err) {
      console.error("Error creating new table:", err);
      db.run("ROLLBACK;");
      db.close();
      process.exit(1);
    }
  });

  console.log("Copying data from _store_products_old to store_products...");
  db.run(`
    INSERT INTO store_products (id, product_id, store, store_product_id, store_url, package_size, package_unit, image_url)
    SELECT id, product_id, store, store_product_id, store_url, package_size, package_unit, image_url
    FROM _store_products_old;
  `, (err) => {
    if (err) {
      console.error("Error copying data:", err);
      db.run("ROLLBACK;");
      db.close();
      process.exit(1);
    }
  });

  console.log("Dropping _store_products_old table...");
  db.run("DROP TABLE _store_products_old;", (err) => {
    if (err) {
      console.error("Error dropping old table:", err);
      db.run("ROLLBACK;");
      db.close();
      process.exit(1);
    }
  });

  console.log("Committing transaction...");
  db.run("COMMIT;", (err) => {
    if (err) {
      console.error("Error committing transaction:", err);
      db.close();
      process.exit(1);
    } else {
      console.log("Transaction committed successfully!");
    }
  });

  console.log("Re-enabling foreign keys...");
  db.run("PRAGMA foreign_keys=ON;");
});

db.close(() => {
  console.log("Database connection closed. Migration finished!");
});
