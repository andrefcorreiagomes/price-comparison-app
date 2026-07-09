import React from 'react';
import { ShoppingCart, TrendingUp, Sparkles } from 'lucide-react';

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

  // Helper to compare prices and calculate savings details
  const getCheapestInfo = (prices) => {
    const cVal = prices.Continente ? prices.Continente.price : null;
    const pdVal = prices['Pingo Doce'] ? prices['Pingo Doce'].price : null;

    if (cVal === null || pdVal === null) return null;

    if (cVal < pdVal) {
      const diff = pdVal - cVal;
      return { store: 'Continente', savings: diff };
    } else if (pdVal < cVal) {
      const diff = cVal - pdVal;
      return { store: 'Pingo Doce', savings: diff };
    }
    return { store: 'Tie', savings: 0 };
  };

  return (
    <div className="product-grid">
      {products.map((product) => {
        const cheapestInfo = getCheapestInfo(product.prices);
        const isSelected = selectedProductId === product.id;

        return (
          <div 
            key={product.id} 
            className={`product-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectProduct(product)}
          >
            <div className="product-info">
              <span className="product-category">{product.category}</span>
              <h2 className="product-name">{product.name}</h2>
              <span className="product-brand">Brand: {product.brand}</span>
            </div>

            {/* Price Side by Side comparison row */}
            <div className="price-comparison-row">
              {/* Continente */}
              <div className="store-price-box continente">
                <span className="store-name-tag">Continente</span>
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
                <span className="store-name-tag">Pingo Doce</span>
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
                    Cheaper at {cheapestInfo.store} (save €{cheapestInfo.savings.toFixed(2)})
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
