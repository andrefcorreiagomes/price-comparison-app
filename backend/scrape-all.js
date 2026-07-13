const { execSync } = require('child_process');

const queries = [
  'leite mimosa',
  'leite continente meio gordo',
  'leite pingo doce meio gordo',
  'manteiga primor',
  'iogurte grego danone natural',
  'arroz carolino cigala',
  'arroz carolino continente',
  'arroz carolino pingo doce',
  'esparguete milaneza',
  'esparguete continente',
  'esparguete pingo doce',
  'azeite oliveira serra extra',
  'azeite continente extra',
  'azeite pingo doce extra',
  'cafe nescafe classico',
  'cafe continente',
  'cafe pingo doce',
  'pao bimbo 12',
  'pao continente',
  'pao pingo doce'
];

console.log('=== Starting Complete Scraper Run to Populate All Product Images ===');

for (const q of queries) {
  console.log(`\n=== Scraping for term: "${q}" ===`);
  try {
    console.log(`Running Continente scraper for "${q}"...`);
    execSync(`node src/scrapers/continente.js "${q}"`, { stdio: 'inherit' });
    
    console.log(`Running Pingo Doce scraper for "${q}"...`);
    execSync(`node src/scrapers/pingodoce.js "${q}"`, { stdio: 'inherit' });
    
    console.log(`Running Lidl scraper for "${q}"...`);
    execSync(`node src/scrapers/lidl.js "${q}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Error scraping for "${q}":`, err.message);
  }
}

console.log('\n=== All Scrapers Completed! Database is fully populated with images! ===');
