const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'src', 'db', 'prices.db');
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Error opening DB:', err.message);
    process.exit(1);
  }
});

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

db.all('SELECT id, name, brand, category FROM products', [], (err, rows) => {
  if (err) throw err;
  
  db.serialize(() => {
    rows.forEach(r => {
      const cleanName = decodeHtmlEntities(r.name);
      const cleanBrand = decodeHtmlEntities(r.brand);
      const cleanCategory = decodeHtmlEntities(r.category);
      
      if (cleanName !== r.name || cleanBrand !== r.brand || cleanCategory !== r.category) {
        db.run(
          'UPDATE products SET name = ?, brand = ?, category = ? WHERE id = ?',
          [cleanName, cleanBrand, cleanCategory, r.id],
          (err) => {
            if (err) console.error(`Failed to update product ${r.id}:`, err.message);
            else console.log(`Cleaned up product ID ${r.id}: "${cleanName}"`);
          }
        );
      }
    });
  });
  
  // Close the database after transactions complete
  setTimeout(() => {
    db.close();
    console.log('Database cleanup finished!');
  }, 1000);
});
