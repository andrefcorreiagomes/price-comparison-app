import React from 'react';
import { ShoppingCart, TrendingUp, Sparkles, ShoppingBag } from 'lucide-react';

export default function ProductList({ products, onSelectProduct, onAddToBasket, selectedProductId }) {
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <Sparkles size={40} className="empty-state-icon" />
        <h3 className="empty-state-title">No products found</h3>
        <p className="empty-state-desc">Try search terms like "leite", "arroz" or clear the category filter.</p>
      </div>
    );
  }


  // Helper to get first available product image URL
  const getProductImage = (prices) => {
    if (prices.Continente && prices.Continente.imageUrl) {
      return prices.Continente.imageUrl;
    }
    if (prices['Pingo Doce'] && prices['Pingo Doce'].imageUrl) {
      return prices['Pingo Doce'].imageUrl;
    }
    if (prices.Lidl && prices.Lidl.imageUrl) {
      return prices.Lidl.imageUrl;
    }
    return null;
  };

  // Helper to compare prices and calculate savings details based on unit price
  const getCheapestInfo = (prices) => {
    const activeStores = [];
    let unit = 'unit';

    ['Continente', 'Pingo Doce', 'Lidl'].forEach(store => {
      if (prices[store] && prices[store].pricePerUnit > 0) {
        activeStores.push({
          store,
          pricePerUnit: prices[store].pricePerUnit,
          unit: prices[store].packageUnit
        });
        unit = prices[store].packageUnit || unit;
      }
    });

    if (activeStores.length < 2) return null;

    // Sort by price per unit ascending
    activeStores.sort((a, b) => a.pricePerUnit - b.pricePerUnit);

    const cheapest = activeStores[0];
    const secondCheapest = activeStores[1];
    
    if (cheapest.pricePerUnit === secondCheapest.pricePerUnit) {
      return { store: 'Tie', savings: 0, unit };
    }

    const diff = secondCheapest.pricePerUnit - cheapest.pricePerUnit;
    return { store: cheapest.store, savings: diff, unit };
  };

  return (
    <div className="product-grid">
      {products.map((product) => {
        const cheapestInfo = getCheapestInfo(product.prices);
        const isSelected = selectedProductId === product.id;
        const imgUrl = getProductImage(product.prices);

        return (
          <div 
            key={product.id} 
            className={`product-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectProduct(product)}
          >
            <div className="product-card-image-container">
              {imgUrl && (
                <img 
                  src={imgUrl} 
                  alt={product.name} 
                  className="product-card-image"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.classList.add('image-error');
                  }}
                />
              )}
              <div className="fallback-placeholder" style={{ display: imgUrl ? 'none' : 'flex' }}>
                <ShoppingBag size={28} className="fallback-icon" />
              </div>
            </div>
            <div className="product-info">
              <span className="product-category">{product.category}</span>
              <h2 className="product-name">{product.name}</h2>
              <div style={{ marginTop: '0.25rem' }}>
                <span className="product-brand">Brand: {product.brand}</span>
              </div>
            </div>

            {/* Price Side by Side comparison row */}
            <div className="price-comparison-row">
              {/* Continente */}
              <div className="store-price-box continente">
                <span className="store-name-tag">Continente {product.prices.Continente ? `(${product.prices.Continente.packageSize}${product.prices.Continente.packageUnit})` : ''}</span>
                {product.prices.Continente ? (
                  <>
                    <span className="store-price">
                      €{product.prices.Continente.price.toFixed(2)}
                    </span>
                    <span className="store-unit-price">
                      €{product.prices.Continente.pricePerUnit.toFixed(2)}/{product.prices.Continente.packageUnit}
                    </span>
                    {product.prices.Continente.isOnSale && (
                      <span className="promo-badge" title={product.prices.Continente.saleDetails}>
                        Sale
                      </span>
                    )}
                  </>
                ) : (
                  <span className="store-price" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                    N/A
                  </span>
                )}
              </div>

              {/* Pingo Doce */}
              <div className="store-price-box pingodoce">
                <span className="store-name-tag">Pingo Doce {product.prices['Pingo Doce'] ? `(${product.prices['Pingo Doce'].packageSize}${product.prices['Pingo Doce'].packageUnit})` : ''}</span>
                {product.prices['Pingo Doce'] ? (
                  <>
                    <span className="store-price">
                      €{product.prices['Pingo Doce'].price.toFixed(2)}
                    </span>
                    <span className="store-unit-price">
                      €{product.prices['Pingo Doce'].pricePerUnit.toFixed(2)}/{product.prices['Pingo Doce'].packageUnit}
                    </span>
                    {product.prices['Pingo Doce'].isOnSale && (
                      <span className="promo-badge" title={product.prices['Pingo Doce'].saleDetails}>
                        Sale
                      </span>
                    )}
                  </>
                ) : (
                  <span className="store-price" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                    N/A
                  </span>
                )}
              </div>

              {/* Lidl */}
              <div className="store-price-box lidl">
                <span className="store-name-tag">Lidl {product.prices.Lidl ? `(${product.prices.Lidl.packageSize}${product.prices.Lidl.packageUnit})` : ''}</span>
                {product.prices.Lidl ? (
                  <>
                    <span className="store-price">
                      €{product.prices.Lidl.price.toFixed(2)}
                    </span>
                    <span className="store-unit-price">
                      €{product.prices.Lidl.pricePerUnit.toFixed(2)}/{product.prices.Lidl.packageUnit}
                    </span>
                    {product.prices.Lidl.isOnSale && (
                      <span className="promo-badge" title={product.prices.Lidl.saleDetails}>
                        Sale
                      </span>
                    )}
                  </>
                ) : (
                  <span className="store-price" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                    N/A
                  </span>
                )}
              </div>
            </div>

            {/* Cheapest highlight badge */}
            {cheapestInfo && (
              <div style={{ minHeight: '26px' }}>
                {cheapestInfo.store === 'Tie' ? (
                  <div className="cheapest-badge" style={{ color: 'var(--text-secondary)', background: 'var(--border-color)', borderColor: 'var(--border-color-hover)' }}>
                    Same price at both stores
                  </div>
                ) : (
                  <div className="cheapest-badge">
                    Cheaper at {cheapestInfo.store} (save €{cheapestInfo.savings.toFixed(2)}/{cheapestInfo.unit})
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
              <button 
                className="btn-card" 
                onClick={() => onSelectProduct(product)}
                title="View historical price charts"
              >
                <TrendingUp size={14} />
                History
              </button>
              <button 
                className="btn-card btn-card-primary" 
                onClick={() => onAddToBasket(product)}
              >
                <ShoppingCart size={14} />
                Add List
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
