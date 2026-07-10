import React from 'react';
import { Trash2, Plus, Minus, ShoppingBag, Sparkles } from 'lucide-react';

export default function Basket({ basketItems, onUpdateQuantity, onRemoveFromBasket }) {
  const hasItems = basketItems.length > 0;

  // Helper to get product package quantity details
  const getProductQuantity = (prices) => {
    const storeDetails = prices.Continente || prices['Pingo Doce'];
    if (!storeDetails) return '';
    return `${storeDetails.packageSize} ${storeDetails.packageUnit}`;
  };

  // Calculate totals locally for instantaneous updates
  const calculateTotals = () => {
    let continenteTotal = 0;
    let pingoDoceTotal = 0;

    basketItems.forEach(item => {
      const cPrice = item.prices.Continente ? item.prices.Continente.price : 0;
      const pdPrice = item.prices['Pingo Doce'] ? item.prices['Pingo Doce'].price : 0;
      
      continenteTotal += cPrice * item.quantity;
      pingoDoceTotal += pdPrice * item.quantity;
    });

    const savings = Math.abs(continenteTotal - pingoDoceTotal);
    let winner = 'Tie';
    if (continenteTotal < pingoDoceTotal) winner = 'Continente';
    else if (pingoDoceTotal < continenteTotal) winner = 'Pingo Doce';

    return {
      continenteTotal: Number(continenteTotal.toFixed(2)),
      pingoDoceTotal: Number(pingoDoceTotal.toFixed(2)),
      winner,
      savings: Number(savings.toFixed(2))
    };
  };

  const { continenteTotal, pingoDoceTotal, winner, savings } = calculateTotals();

  return (
    <div className="basket-panel">
      <h3 className="basket-title">
        <ShoppingBag size={20} className="color-accent" />
        Shopping Basket
        {hasItems && <span className="basket-count">{basketItems.length}</span>}
      </h3>

      {!hasItems ? (
        <div className="empty-state" style={{ padding: '2rem 1rem', minHeight: '200px' }}>
          <ShoppingBag size={32} className="empty-state-icon" style={{ opacity: 0.5 }} />
          <h4 className="empty-state-title" style={{ fontSize: '1rem' }}>Your basket is empty</h4>
          <p className="empty-state-desc" style={{ fontSize: '0.8rem' }}>Add items from the comparison list to build your shopping trip.</p>
        </div>
      ) : (
        <>
          {/* Items List */}
          <div className="basket-items-list">
            {basketItems.map((item) => {
              const cPrice = item.prices.Continente ? item.prices.Continente.price : null;
              const pdPrice = item.prices['Pingo Doce'] ? item.prices['Pingo Doce'].price : null;

              return (
                <div key={item.id} className="basket-item">
                  <div className="basket-item-info">
                    <span className="basket-item-name">{item.name}</span>
                    <span className="basket-item-brand">{item.brand} • {getProductQuantity(item.prices)}</span>
                    
                    <div className="basket-item-qty-control">
                      <button 
                        className="btn-qty" 
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        title="Decrease quantity"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="qty-val">{item.quantity}</span>
                      <button 
                        className="btn-qty" 
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        title="Increase quantity"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>

                  <div className="basket-item-actions">
                    {/* Tiny subtotal display */}
                    <div className="basket-item-prices">
                      <div className="c">C: €{(cPrice * item.quantity).toFixed(2)}</div>
                      <div className="pd">PD: €{(pdPrice * item.quantity).toFixed(2)}</div>
                    </div>
                    <button 
                      className="btn-remove-item"
                      onClick={() => onRemoveFromBasket(item.id)}
                      title="Remove product"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison summary */}
          <div className="basket-comparison-results">
            <div className="store-basket-total continente">
              <span>Continente</span>
              <span className="total-amount">€{continenteTotal.toFixed(2)}</span>
            </div>

            <div className="store-basket-total pingodoce">
              <span>Pingo Doce</span>
              <span className="total-amount">€{pingoDoceTotal.toFixed(2)}</span>
            </div>

            {winner !== 'Tie' ? (
              <div className="basket-winner-box">
                <div className="winner-message">
                  🏆 {winner} is cheaper!
                </div>
                <div className="savings-message">
                  You save <strong>€{savings.toFixed(2)}</strong> on this shopping list.
                </div>
              </div>
            ) : (
              <div className="basket-winner-box" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <div className="winner-message">⚖️ It's a Tie!</div>
                <div className="savings-message">Both stores cost the exact same total.</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
