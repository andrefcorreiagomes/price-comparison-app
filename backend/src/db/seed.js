const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'prices.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Canonical product list
const canonicalProducts = [
  {
    id: 1,
    name: 'Leite UHT Meio Gordo Mimosa',
    brand: 'Mimosa',
    category: 'Laticínios',
    barcode_ean: '5601111111111'
  },
  {
    id: 2,
    name: 'Leite Meio Gordo Marca Própria',
    brand: 'Marca Própria',
    category: 'Laticínios',
    barcode_ean: '5602222222222'
  },
  {
    id: 3,
    name: 'Manteiga Primor Salgada 250g',
    brand: 'Primor',
    category: 'Laticínios',
    barcode_ean: '5603333333333'
  },
  {
    id: 4,
    name: 'Iogurte Grego Natural Danone 4x120g',
    brand: 'Danone',
    category: 'Laticínios',
    barcode_ean: '5604444444444'
  },
  {
    id: 5,
    name: 'Arroz Carolino Cigala',
    brand: 'Cigala',
    category: 'Mercearia',
    barcode_ean: '5605555555555'
  },
  {
    id: 6,
    name: 'Arroz Carolino Marca Própria',
    brand: 'Marca Própria',
    category: 'Mercearia',
    barcode_ean: '5606666666666'
  },
  {
    id: 7,
    name: 'Massa Esparguete Milaneza 500g',
    brand: 'Milaneza',
    category: 'Mercearia',
    barcode_ean: '5607777777777'
  },
  {
    id: 8,
    name: 'Massa Esparguete Marca Própria 500g',
    brand: 'Marca Própria',
    category: 'Mercearia',
    barcode_ean: '5608888888888'
  },
  {
    id: 9,
    name: 'Azeite Virgem Extra Oliveira da Serra 750ml',
    brand: 'Oliveira da Serra',
    category: 'Mercearia',
    barcode_ean: '5609999999999'
  },
  {
    id: 10,
    name: 'Azeite Virgem Extra Marca Própria 750ml',
    brand: 'Marca Própria',
    category: 'Mercearia',
    barcode_ean: '5600000000001'
  },
  {
    id: 11,
    name: 'Café Solúvel Nescafé Clássico 200g',
    brand: 'Nescafé',
    category: 'Bebidas/Café',
    barcode_ean: '5600000000005'
  },
  {
    id: 12,
    name: 'Café Solúvel Marca Própria 200g',
    brand: 'Marca Própria',
    category: 'Bebidas/Café',
    barcode_ean: '5600000000006'
  },
  {
    id: 13,
    name: 'Pão de Forma Integral Bimbo 12 Cereais',
    brand: 'Bimbo',
    category: 'Padaria',
    barcode_ean: '5600000000003'
  },
  {
    id: 14,
    name: 'Pão de Forma Branco Marca Própria',
    brand: 'Marca Própria',
    category: 'Padaria',
    barcode_ean: '5600000000004'
  }
];

// Store product mappings with realistic URLs, SKUs, and packaging info
const storeProducts = [
  // Mimosa Milk
  { id: 1, product_id: 1, store: 'Continente', store_product_id: '202301', store_url: 'https://www.continente.pt/produto/leite-uht-meio-gordo-mimosa-202301.html', package_size: 1.0, package_unit: 'L' },
  { id: 2, product_id: 1, store: 'Pingo Doce', store_product_id: 'pd-1011', store_url: 'https://www.pingodoce.pt/produto/leite-uht-meio-gordo-mimosa-pd-1011.html', package_size: 1.0, package_unit: 'L' },

  // Own Brand Milk
  { id: 3, product_id: 2, store: 'Continente', store_product_id: '405021', store_url: 'https://www.continente.pt/produto/leite-uht-meio-gordo-continente-405021.html', package_size: 1.0, package_unit: 'L' },
  { id: 4, product_id: 2, store: 'Pingo Doce', store_product_id: 'pd-2022', store_url: 'https://www.pingodoce.pt/produto/leite-uht-meio-gordo-pingo-doce-pd-2022.html', package_size: 1.0, package_unit: 'L' },

  // Primor Butter
  { id: 5, product_id: 3, store: 'Continente', store_product_id: '109988', store_url: 'https://www.continente.pt/produto/manteiga-com-sal-primor-109988.html', package_size: 0.25, package_unit: 'kg' },
  { id: 6, product_id: 3, store: 'Pingo Doce', store_product_id: 'pd-3033', store_url: 'https://www.pingodoce.pt/produto/manteiga-com-sal-primor-pd-3033.html', package_size: 0.25, package_unit: 'kg' },

  // Greek Yogurt
  { id: 7, product_id: 4, store: 'Continente', store_product_id: '809010', store_url: 'https://www.continente.pt/produto/iogurte-grego-natural-danone-809010.html', package_size: 0.48, package_unit: 'kg' },
  { id: 8, product_id: 4, store: 'Pingo Doce', store_product_id: 'pd-4044', store_url: 'https://www.pingodoce.pt/produto/iogurte-grego-natural-danone-pd-4044.html', package_size: 0.48, package_unit: 'kg' },

  // Cigala Rice
  { id: 9, product_id: 5, store: 'Continente', store_product_id: '506070', store_url: 'https://www.continente.pt/produto/arroz-carolino-cigala-506070.html', package_size: 1.0, package_unit: 'kg' },
  { id: 10, product_id: 5, store: 'Pingo Doce', store_product_id: 'pd-5055', store_url: 'https://www.pingodoce.pt/produto/arroz-carolino-cigala-pd-5055.html', package_size: 1.0, package_unit: 'kg' },

  // Own Brand Rice
  { id: 11, product_id: 6, store: 'Continente', store_product_id: '506080', store_url: 'https://www.continente.pt/produto/arroz-carolino-continente-506080.html', package_size: 1.0, package_unit: 'kg' },
  { id: 12, product_id: 6, store: 'Pingo Doce', store_product_id: 'pd-5066', store_url: 'https://www.pingodoce.pt/produto/arroz-carolino-pingo-doce-pd-5066.html', package_size: 1.0, package_unit: 'kg' },

  // Milaneza Spaghetti
  { id: 13, product_id: 7, store: 'Continente', store_product_id: '702030', store_url: 'https://www.continente.pt/produto/massa-esparguete-milaneza-702030.html', package_size: 0.5, package_unit: 'kg' },
  { id: 14, product_id: 7, store: 'Pingo Doce', store_product_id: 'pd-7077', store_url: 'https://www.pingodoce.pt/produto/massa-esparguete-milaneza-pd-7077.html', package_size: 0.5, package_unit: 'kg' },

  // Own Brand Spaghetti
  { id: 15, product_id: 8, store: 'Continente', store_product_id: '702040', store_url: 'https://www.continente.pt/produto/massa-esparguete-continente-702040.html', package_size: 0.5, package_unit: 'kg' },
  { id: 16, product_id: 8, store: 'Pingo Doce', store_product_id: 'pd-7088', store_url: 'https://www.pingodoce.pt/produto/massa-esparguete-pingo-doce-pd-7088.html', package_size: 0.5, package_unit: 'kg' },

  // Oliveira da Serra Olive Oil
  { id: 17, product_id: 9, store: 'Continente', store_product_id: '901020', store_url: 'https://www.continente.pt/produto/azeite-virgem-extra-oliveira-da-serra-901020.html', package_size: 0.75, package_unit: 'L' },
  { id: 18, product_id: 9, store: 'Pingo Doce', store_product_id: 'pd-9099', store_url: 'https://www.pingodoce.pt/produto/azeite-virgem-extra-oliveira-da-serra-pd-9099.html', package_size: 0.75, package_unit: 'L' },

  // Own Brand Olive Oil
  { id: 19, product_id: 10, store: 'Continente', store_product_id: '901030', store_url: 'https://www.continente.pt/produto/azeite-virgem-extra-continente-901030.html', package_size: 0.75, package_unit: 'L' },
  { id: 20, product_id: 10, store: 'Pingo Doce', store_product_id: 'pd-9088', store_url: 'https://www.pingodoce.pt/produto/azeite-virgem-extra-pingo-doce-pd-9088.html', package_size: 0.75, package_unit: 'L' },

  // Nescafé Instant Coffee
  { id: 21, product_id: 11, store: 'Continente', store_product_id: '302010', store_url: 'https://www.continente.pt/produto/cafe-soluvel-nescafe-classico-302010.html', package_size: 0.2, package_unit: 'kg' },
  { id: 22, product_id: 11, store: 'Pingo Doce', store_product_id: 'pd-3011', store_url: 'https://www.pingodoce.pt/produto/cafe-soluvel-nescafe-classico-pd-3011.html', package_size: 0.2, package_unit: 'kg' },

  // Own Brand Coffee
  { id: 23, product_id: 12, store: 'Continente', store_product_id: '302020', store_url: 'https://www.continente.pt/produto/cafe-soluvel-continente-302020.html', package_size: 0.2, package_unit: 'kg' },
  { id: 24, product_id: 12, store: 'Pingo Doce', store_product_id: 'pd-3022', store_url: 'https://www.pingodoce.pt/produto/cafe-soluvel-pingo-doce-pd-3022.html', package_size: 0.2, package_unit: 'kg' },

  // Bimbo Bread
  { id: 25, product_id: 13, store: 'Continente', store_product_id: '601020', store_url: 'https://www.continente.pt/produto/pao-de-forma-integral-bimbo-601020.html', package_size: 0.65, package_unit: 'kg' },
  { id: 26, product_id: 13, store: 'Pingo Doce', store_product_id: 'pd-6066', store_url: 'https://www.pingodoce.pt/produto/pao-de-forma-integral-bimbo-pd-6066.html', package_size: 0.65, package_unit: 'kg' },

  // Own Brand Bread
  { id: 27, product_id: 14, store: 'Continente', store_product_id: '601030', store_url: 'https://www.continente.pt/produto/pao-de-forma-branco-continente-601030.html', package_size: 0.8, package_unit: 'kg' },
  { id: 28, product_id: 14, store: 'Pingo Doce', store_product_id: 'pd-6077', store_url: 'https://www.pingodoce.pt/produto/pao-de-forma-branco-pingo-doce-pd-6077.html', package_size: 0.8, package_unit: 'kg' }
];

// Base prices to fluctuate from (Continente price vs Pingo Doce price)
const basePrices = {
  1: { Continente: 0.99, 'Pingo Doce': 0.99 }, // Mimosa Milk (usually identical)
  2: { Continente: 0.89, 'Pingo Doce': 0.88 }, // Own Brand Milk (tight competition)
  3: { Continente: 2.49, 'Pingo Doce': 2.39 }, // Primor Butter
  4: { Continente: 2.19, 'Pingo Doce': 2.25 }, // Greek Yogurt
  5: { Continente: 1.69, 'Pingo Doce': 1.64 }, // Cigala Rice
  6: { Continente: 1.15, 'Pingo Doce': 1.15 }, // Own Brand Rice
  7: { Continente: 1.09, 'Pingo Doce': 1.09 }, // Milaneza Spaghetti
  8: { Continente: 0.79, 'Pingo Doce': 0.78 }, // Own Brand Spaghetti
  9: { Continente: 5.99, 'Pingo Doce': 5.89 }, // Oliveira da Serra Olive Oil
  10: { Continente: 4.49, 'Pingo Doce': 4.49 }, // Own Brand Olive Oil
  11: { Continente: 5.49, 'Pingo Doce': 5.59 }, // Nescafé Coffee
  12: { Continente: 3.29, 'Pingo Doce': 3.19 }, // Own Brand Coffee
  13: { Continente: 2.59, 'Pingo Doce': 2.65 }, // Bimbo Bread
  14: { Continente: 1.39, 'Pingo Doce': 1.39 }  // Own Brand Bread
};

// Delete existing DB to start fresh
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  console.log('Loading schema...');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  
  // Split statements and run them
  schema.split(';').forEach(statement => {
    if (statement.trim()) {
      db.run(statement);
    }
  });

  console.log('Inserting canonical products...');
  const insertProduct = db.prepare('INSERT INTO products (id, name, brand, category, barcode_ean) VALUES (?, ?, ?, ?, ?)');
  canonicalProducts.forEach(p => {
    insertProduct.run(p.id, p.name, p.brand, p.category, p.barcode_ean);
  });
  insertProduct.finalize();

  console.log('Inserting store product mappings...');
  const insertStoreProduct = db.prepare('INSERT INTO store_products (id, product_id, store, store_product_id, store_url, package_size, package_unit) VALUES (?, ?, ?, ?, ?, ?, ?)');
  storeProducts.forEach(sp => {
    insertStoreProduct.run(sp.id, sp.product_id, sp.store, sp.store_product_id, sp.store_url, sp.package_size, sp.package_unit);
  });
  insertStoreProduct.finalize();

  console.log('Generating 30 days of price history...');
  const insertPriceHistory = db.prepare(`
    INSERT INTO price_history (store_product_id, price, price_per_unit, is_on_sale, sale_details, record_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Generate date array (30 days ago to today)
  const dates = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Track ongoing promotions to make them last several days
  // Key: store_product_id, Value: { daysLeft: Number, discountPercent: Number, details: String }
  const activePromos = {};

  storeProducts.forEach(sp => {
    const baseVal = basePrices[sp.product_id][sp.store];
    let currentPrice = baseVal;
    
    // Normalize factor for unit calculation (converting g to kg, ml to L)
    let unitFactor = 1.0;
    if (sp.package_unit === 'g' || sp.package_unit === 'ml') {
      unitFactor = sp.package_size / 1000.0;
    } else {
      unitFactor = sp.package_size;
    }

    dates.forEach((dateStr, dateIdx) => {
      // 1. Process active promotion decay
      if (activePromos[sp.id]) {
        activePromos[sp.id].daysLeft--;
        if (activePromos[sp.id].daysLeft <= 0) {
          delete activePromos[sp.id];
        }
      }

      // 2. Decide if a new promotion starts (10% chance if no active promo)
      if (!activePromos[sp.id] && Math.random() < 0.12) {
        const discountPercent = Math.random() < 0.5 ? 15 : (Math.random() < 0.7 ? 20 : 25);
        const daysLeft = Math.floor(Math.random() * 4) + 3; // 3 to 6 days
        activePromos[sp.id] = {
          daysLeft,
          discountPercent,
          details: `Poupança Imediata ${discountPercent}%`
        };
      }

      // 3. Small general daily price fluctuation (+/- €0.01 to €0.03) with 5% chance
      if (Math.random() < 0.05) {
        const change = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 3) + 1) / 100.0;
        // Keep price reasonable
        const newBase = Number((basePrices[sp.product_id][sp.store] + change).toFixed(2));
        if (newBase > baseVal * 0.9 && newBase < baseVal * 1.1) {
          basePrices[sp.product_id][sp.store] = newBase;
        }
      }

      // Calculate final price for the day
      let dayBasePrice = basePrices[sp.product_id][sp.store];
      let dayPrice = dayBasePrice;
      let isOnSale = 0;
      let saleDetails = null;

      if (activePromos[sp.id]) {
        const promo = activePromos[sp.id];
        dayPrice = Number((dayBasePrice * (1 - promo.discountPercent / 100)).toFixed(2));
        isOnSale = 1;
        saleDetails = promo.details;
      }

      const pricePerUnit = Number((dayPrice / unitFactor).toFixed(2));

      // Insert record
      insertPriceHistory.run(sp.id, dayPrice, pricePerUnit, isOnSale, saleDetails, dateStr);
    });
  });

  insertPriceHistory.finalize();
  console.log('Database successfully seeded!');
});

db.close();
