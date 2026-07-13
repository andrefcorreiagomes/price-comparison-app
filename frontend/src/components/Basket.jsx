import React from 'react';
import { Trash2, Plus, Minus, ShoppingBag, Sparkles } from 'lucide-react';

export default function Basket({ basketItems, onUpdateQuantity, onRemoveFromBasket }) {
  const hasItems = basketItems.length > 0;

  // Helper to get product package quantity details
  const getProductQuantity = (prices) => {
    const c = prices.Continente;
    const pd = prices['Pingo Doce'];
    const l = prices.Lidl;
    const a = prices.Auchan;
    
    const activeSizes = [];
    if (c) activeSizes.push(`C: ${c.packageSize}${c.packageUnit}`);
    if (pd) activeSizes.push(`PD: ${pd.packageSize}${pd.packageUnit}`);
    if (l) activeSizes.push(`L: ${l.packageSize}${l.packageUnit}`);
    if (a) activeSizes.push(`A: ${a.packageSize}${a.packageUnit}`);
    
    const sizesOnly = [c, pd, l, a].filter(Boolean);
    if (sizesOnly.length > 0) {
      const first = sizesOnly[0];
      const allIdentical = sizesOnly.every(s => s.packageSize === first.packageSize && s.packageUnit === first.packageUnit);
      if (allIdentical) {
        return `${first.packageSize}${first.packageUnit}`;
      }
    }
    
    return activeSizes.join(' • ');
  };

  // Calculate totals locally for instantaneous updates
  const calculateTotals = () => {
    let continenteTotal = 0;
    let pingoDoceTotal = 0;
    let lidlTotal = 0;
    let auchanTotal = 0;

    basketItems.forEach(item => {
      const cPrice = item.prices.Continente ? item.prices.Continente.price : 0;
      const pdPrice = item.prices['Pingo Doce'] ? item.prices['Pingo Doce'].price : 0;
      const lPrice = item.prices.Lidl ? item.prices.Lidl.price : 0;
      const aPrice = item.prices.Auchan ? item.prices.Auchan.price : 0;
      
      continenteTotal += cPrice * item.quantity;
      pingoDoceTotal += pdPrice * item.quantity;
      lidlTotal += lPrice * item.quantity;
      auchanTotal += aPrice * item.quantity;
    });

    const totalsList = [
      { store: 'Continente', total: continenteTotal },
      { store: 'Pingo Doce', total: pingoDoceTotal },
      { store: 'Lidl', total: lidlTotal },
      { store: 'Auchan', total: auchanTotal }
    ].filter(t => t.total > 0);

    let winner = 'Tie';
    let minTotal = Infinity;
    let maxTotal = -Infinity;
    
    totalsList.forEach(t => {
      if (t.total < minTotal) {
        minTotal = t.total;
        winner = t.store;
      }
      if (t.total > maxTotal) {
        maxTotal = t.total;
      }
    });

    const winnersCount = totalsList.filter(t => t.total === minTotal).length;
    if (winnersCount > 1) {
      winner = 'Tie';
    }

    const savings = minTotal !== Infinity && maxTotal !== -Infinity && minTotal !== maxTotal
      ? maxTotal - minTotal
      : 0;

    return {
      continenteTotal: Number(continenteTotal.toFixed(2)),
      pingoDoceTotal: Number(pingoDoceTotal.toFixed(2)),
      lidlTotal: Number(lidlTotal.toFixed(2)),
      auchanTotal: Number(auchanTotal.toFixed(2)),
      winner,
      savings: Number(savings.toFixed(2))
    };
  };

  const { continenteTotal, pingoDoceTotal, lidlTotal, auchanTotal, winner, savings } = calculateTotals();

  return (
    <div className="basket-panel">
      <h3 className="basket-title">
        <ShoppingBag size={20} className="color-accent" />
        Carrinho de Compras
        {hasItems && <span className="basket-count">{basketItems.length}</span>}
      </h3>

      {!hasItems ? (
        <div className="empty-state" style={{ padding: '2rem 1rem', minHeight: '200px' }}>
          <ShoppingBag size={32} className="empty-state-icon" style={{ opacity: 0.5 }} />
          <h4 className="empty-state-title" style={{ fontSize: '1rem' }}>O seu carrinho está vazio</h4>
          <p className="empty-state-desc" style={{ fontSize: '0.8rem' }}>Adicione produtos da lista de comparação para planear a sua compra.</p>
        </div>
      ) : (
        <>
          {/* Items List */}
          <div className="basket-items-list">
            {basketItems.map((item) => {
              const cPrice = item.prices.Continente ? item.prices.Continente.price : null;
              const pdPrice = item.prices['Pingo Doce'] ? item.prices['Pingo Doce'].price : null;
              const lPrice = item.prices.Lidl ? item.prices.Lidl.price : null;
              const aPrice = item.prices.Auchan ? item.prices.Auchan.price : null;

              return (
                <div key={item.id} className="basket-item">
                  <div className="basket-item-info">
                    <span className="basket-item-name">{item.name}</span>
                    <span className="basket-item-brand">{item.brand} • {getProductQuantity(item.prices)}</span>
                    
                    <div className="basket-item-qty-control">
                      <button 
                        className="btn-qty" 
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        title="Diminuir quantidade"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="qty-val">{item.quantity}</span>
                      <button 
                        className="btn-qty" 
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        title="Aumentar quantidade"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>

                  <div className="basket-item-actions">
                    {/* Tiny subtotal display */}
                    <div className="basket-item-prices">
                      {cPrice !== null && <div className="c">C: €{(cPrice * item.quantity).toFixed(2)}</div>}
                      {pdPrice !== null && <div className="pd">PD: €{(pdPrice * item.quantity).toFixed(2)}</div>}
                      {lPrice !== null && <div className="l">L: €{(lPrice * item.quantity).toFixed(2)}</div>}
                      {aPrice !== null && <div className="a">A: €{(aPrice * item.quantity).toFixed(2)}</div>}
                    </div>
                    <button 
                      className="btn-remove-item"
                      onClick={() => onRemoveFromBasket(item.id)}
                      title="Remover produto"
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
            {continenteTotal > 0 && (
              <div className="store-basket-total continente">
                <span>Continente</span>
                <span className="total-amount">€{continenteTotal.toFixed(2)}</span>
              </div>
            )}

            {pingoDoceTotal > 0 && (
              <div className="store-basket-total pingodoce">
                <span>Pingo Doce</span>
                <span className="total-amount">€{pingoDoceTotal.toFixed(2)}</span>
              </div>
            )}

            {lidlTotal > 0 && (
              <div className="store-basket-total lidl">
                <span>Lidl</span>
                <span className="total-amount">€{lidlTotal.toFixed(2)}</span>
              </div>
            )}

            {auchanTotal > 0 && (
              <div className="store-basket-total auchan">
                <span>Auchan</span>
                <span className="total-amount">€{auchanTotal.toFixed(2)}</span>
              </div>
            )}

            {winner !== 'Tie' ? (
              <div className="basket-winner-box">
                <div className="winner-message">
                  🏆 O {winner} é mais barato!
                </div>
                <div className="savings-message">
                  Poupa <strong>€{savings.toFixed(2)}</strong> nesta lista de compras.
                </div>
              </div>
            ) : (
              <div className="basket-winner-box" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <div className="winner-message">⚖️ Empate!</div>
                <div className="savings-message">Os supermercados têm exatamente o mesmo custo total.</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
