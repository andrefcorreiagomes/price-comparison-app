import React, { useState, useEffect } from 'react';
import { Sun, Moon, Search, Sparkles, X, Info } from 'lucide-react';
import ProductList from './components/ProductList';
import PriceChart from './components/PriceChart';
import Basket from './components/Basket';

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Selected Product for Charting
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Basket State
  const [basketItems, setBasketItems] = useState(() => {
    const saved = localStorage.getItem('grocery_basket');
    return saved ? JSON.parse(saved) : [];
  });

  // Theme State
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  // Categories list derived from seed data (or query from API, but we know them)
  const categories = ['Laticínios', 'Mercearia', 'Bebidas/Café', 'Padaria'];

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sync basket to localStorage
  useEffect(() => {
    localStorage.setItem('grocery_basket', JSON.stringify(basketItems));
  }, [basketItems]);

  // Fetch products on search or filter change
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        let url = '/api/products';
        const params = [];
        if (searchQuery) params.push(`q=${encodeURIComponent(searchQuery)}`);
        if (categoryFilter) params.push(`category=${encodeURIComponent(categoryFilter)}`);
        
        if (params.length > 0) {
          url += `?${params.join('&')}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('API error');
        const data = await response.ok ? await response.json() : [];
        setProducts(data);
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search slightly to avoid excessive API requests
    const timeoutId = setTimeout(fetchProducts, 250);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, categoryFilter]);

  // Fetch price history when product is selected
  useEffect(() => {
    if (!selectedProduct) {
      setHistoryData([]);
      return;
    }

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const response = await fetch(`/api/products/${selectedProduct.id}/history`);
        if (!response.ok) throw new Error('API error');
        const data = await response.json();
        setHistoryData(data);
      } catch (err) {
        console.error('Error fetching history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedProduct]);

  // Toggle dark/light theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Add item to shopping list
  const handleAddToBasket = (product) => {
    setBasketItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  // Remove item from shopping list
  const handleRemoveFromBasket = (id) => {
    setBasketItems(prev => prev.filter(item => item.id !== id));
  };

  // Update item quantity
  const handleUpdateQuantity = (id, delta) => {
    setBasketItems(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      });
    });
  };

  return (
    <div className="app-container">
      {/* Top Header Bar */}
      <header className="app-header">
        <div className="brand-section">
          <h1>
            <Sparkles className="color-accent" size={28} />
            PoupaFárcil
          </h1>
          <p>Grocery Price Comparison: Continente vs. Pingo Doce vs. Lidl vs. Auchan</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-theme-toggle" 
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Main Filter and Search Controls */}
      <section className="search-filter-bar">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search groceries (e.g., Mimosa, Leite, Arroz)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <select 
          value={categoryFilter} 
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="category-select"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </section>

      {/* Historical Price Chart Section (appears when product is selected) */}
      {selectedProduct && (
        <section className="history-panel">
          <div className="history-header">
            <div className="history-title-area">
              <h3>Price Evolution Chart</h3>
              <p>Comparing price changes over the last 30 days for <strong>{selectedProduct.name}</strong></p>
            </div>
            <button 
              className="btn-close-panel" 
              onClick={() => setSelectedProduct(null)}
              title="Close chart panel"
            >
              <X size={18} />
            </button>
          </div>

          <div className="chart-container">
            {loadingHistory ? (
              <div className="empty-state" style={{ height: '100%' }}>
                <p className="empty-state-title">Loading history data...</p>
              </div>
            ) : (
              <PriceChart 
                historyData={historyData} 
                productName={selectedProduct.name} 
              />
            )}
          </div>
        </section>
      )}

      {/* Grid Dashboard: Left is Products list, Right is Basket comparison */}
      <main className="dashboard-grid">
        <section>
          {loading ? (
            <div className="empty-state" style={{ minHeight: '300px' }}>
              <p className="empty-state-title">Loading groceries catalog...</p>
            </div>
          ) : (
            <ProductList 
              products={products} 
              onSelectProduct={setSelectedProduct}
              onAddToBasket={handleAddToBasket}
              selectedProductId={selectedProduct?.id}
            />
          )}
        </section>

        <aside>
          <Basket 
            basketItems={basketItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveFromBasket={handleRemoveFromBasket}
          />
        </aside>
      </main>
    </div>
  );
}
