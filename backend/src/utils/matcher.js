/**
 * Helper utility to perform fuzzy string and brand matching between
 * scraped store products and canonical database products.
 */

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD') // decompose combined graphemes (remove accents)
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ') // replace non-alphanumeric with spaces
    .replace(/\bsalgad[ao]s?\b/g, 'sal') // normalize salgada/salgado to sal
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

function isHouseBrand(brandName) {
  const norm = normalize(brandName);
  return norm === 'marca propria' || norm === 'pingo doce' || norm === 'continente';
}

/**
 * Computes a Jaccard-like word intersection score between two strings.
 * Returns a score between 0.0 and 1.0.
 */
function getWordMatchScore(str1, str2) {
  const norm1 = normalize(str1);
  const norm2 = normalize(str2);
  
  if (norm1 === norm2) return 1.0;
  
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 1));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 1));
  
  if (words1.size === 0 || words2.size === 0) return 0.0;
  
  let intersectionCount = 0;
  words1.forEach(w => {
    if (words2.has(w)) {
      intersectionCount++;
    }
  });
  
  // Return the Jaccard index (intersection over union)
  const unionSize = new Set([...words1, ...words2]).size;
  return intersectionCount / unionSize;
}

function extractSizeFromName(name) {
  if (!name) return null;
  // Match patterns like "750ml", "250g", "1L", "500g", "4x120g"
  const match = name.toLowerCase().match(/([\d.,x]+)\s*(ml|g|kg|l|cl)/i);
  if (match) {
    let sizeStr = match[1].replace(/\s+/g, '').replace(',', '.');
    let size = 1.0;
    if (sizeStr.includes('x')) {
      const parts = sizeStr.split('x');
      size = parseFloat(parts[0]) * parseFloat(parts[1]);
    } else {
      size = parseFloat(sizeStr);
    }
    let unit = match[2].toUpperCase();
    if (unit === 'G') return size / 1000.0;
    if (unit === 'ML') return size / 1000.0;
    if (unit === 'CL') return size / 100.0;
    return size;
  }
  return null;
}

/**
 * Finds the best matching canonical product in the database.
 * 
 * @param {string} scrapedName - Scraped product name (e.g. "Arroz Agulha")
 * @param {string} scrapedBrand - Scraped product brand (e.g. "Cigala")
 * @param {Array} dbProducts - Canonical products from DB (each has id, name, brand, category)
 * @param {number|null} scrapedSize - Scraped quantity size normalized to KG/L
 * @param {number} threshold - Minimum score to consider a match (default: 0.45)
 * @returns {Object|null} The best matching product from dbProducts, or null if no match is found
 */
function findBestMatch(scrapedName, scrapedBrand, dbProducts, scrapedSize = null, threshold = 0.45) {
  const normScrapedBrand = normalize(scrapedBrand);
  const isScrapedHouseBrand = isHouseBrand(scrapedBrand);
  
  let bestProduct = null;
  let bestScore = -1;

  // Combine scraped name and brand for full matching context
  const fullScrapedText = `${scrapedName} ${isScrapedHouseBrand ? '' : scrapedBrand}`;

  for (const prod of dbProducts) {
    const normDbBrand = normalize(prod.brand);
    const isDbHouseBrand = isHouseBrand(prod.brand);
    
    // Brand validation:
    // 1. If brand is a house brand, both must be house brands.
    // 2. If it's a specific brand, they must match exactly (normalized).
    let brandMatches = false;
    if (isScrapedHouseBrand && isDbHouseBrand) {
      brandMatches = true;
    } else if (normScrapedBrand === normDbBrand) {
      brandMatches = true;
    }

    if (!brandMatches) continue;

    // Size validation:
    // Prevent matching different package sizes if canonical name specifies a size
    if (scrapedSize !== null) {
      const canonicalSize = extractSizeFromName(prod.name);
      if (canonicalSize !== null) {
        // If sizes are different (allow minor floating point variance of 0.05)
        if (Math.abs(canonicalSize - scrapedSize) > 0.05) {
          continue;
        }
      }
    }

    // Combine canonical name and brand for matching context
    const fullDbText = `${prod.name} ${isDbHouseBrand ? '' : prod.brand}`;
    
    const score = getWordMatchScore(fullScrapedText, fullDbText);
    
    if (score > bestScore) {
      bestScore = score;
      bestProduct = prod;
    }
  }

  if (bestScore >= threshold) {
    return {
      product: bestProduct,
      score: bestScore
    };
  }
  
  return null;
}

module.exports = {
  normalize,
  isHouseBrand,
  getWordMatchScore,
  findBestMatch
};
