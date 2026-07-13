-- Schema for Grocery Price Comparison database

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    barcode_ean TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS store_products (
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

CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_product_id INTEGER NOT NULL,
    price REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    is_on_sale INTEGER NOT NULL CHECK(is_on_sale IN (0, 1)),
    sale_details TEXT,
    record_date TEXT NOT NULL,
    FOREIGN KEY (store_product_id) REFERENCES store_products(id) ON DELETE CASCADE,
    UNIQUE (store_product_id, record_date)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(record_date);
CREATE INDEX IF NOT EXISTS idx_price_history_store_product ON price_history(store_product_id);
