import { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import NewsPage from './pages/NewsPage';
import Analytics from './pages/Analytics';
import { searchStocks } from './api';
import './index.css';

function AppContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (query.length >= 1) {
      try {
        const res = await searchStocks(query);
        setSearchResults(res.data.results || []);
        setShowSearch(true);
      } catch {
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  }, []);

  const selectStock = (symbol) => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
    setMobileMenuOpen(false);
    navigate(`/stock/${symbol}`);
  };

  const navLinks = [
    { to: '/', label: 'Dashboard' },
    { to: '/news', label: 'News' },
    { to: '/analytics', label: 'Analytics' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* ─── Navbar ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-white)' }}>
                StockAI
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                PRO
              </span>
            </NavLink>

            {/* Search Bar (Desktop) */}
            <div className="hidden md:flex relative flex-1 max-w-sm mx-8">
              <div className="relative w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: 'var(--text-muted)' }}>Search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchQuery && setShowSearch(true)}
                  onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                  placeholder=""
                  className="input pl-14 py-1.5 text-xs"
                  style={{ background: 'var(--bg-surface)', height: '32px' }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  /
                </span>
                {showSearch && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 p-1 max-h-60 overflow-y-auto z-50"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    {searchResults.map((s) => (
                      <button key={s.symbol}
                        onMouseDown={() => selectStock(s.symbol)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded text-left cursor-pointer"
                        style={{ transition: 'background 0.1s' }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--bg-surface)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}>
                        <div>
                          <span className="mono font-semibold text-xs" style={{ color: 'var(--text-white)' }}>{s.symbol}</span>
                          <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>&#8594;</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Nav Links (Desktop) */}
            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map(({ to, label }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-xs font-medium transition-colors ${isActive
                      ? ''
                      : ''}`
                  }
                  style={({ isActive }) => ({
                    background: isActive ? 'var(--bg-surface)' : 'transparent',
                    color: isActive ? 'var(--text-white)' : 'var(--text-secondary)',
                  })}>
                  {label}
                </NavLink>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded"
              style={{ color: 'var(--text-secondary)' }}>
              <span className="text-xs font-medium">{mobileMenuOpen ? 'Close' : 'Menu'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden animate-in"
            style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
            <div className="px-4 py-3">
              <div className="relative mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search stocks..."
                  className="input py-2 text-xs"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mb-3 space-y-0.5">
                  {searchResults.slice(0, 5).map((s) => (
                    <button key={s.symbol}
                      onClick={() => selectStock(s.symbol)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded text-left text-xs"
                      style={{ color: 'var(--text-primary)' }}>
                      <span className="mono font-semibold">{s.symbol}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-0.5">
                {navLinks.map(({ to, label }) => (
                  <NavLink key={to} to={to} end={to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2.5 rounded text-xs font-medium"
                    style={({ isActive }) => ({
                      background: isActive ? 'var(--bg-surface)' : 'transparent',
                      color: isActive ? 'var(--text-white)' : 'var(--text-secondary)',
                    })}>
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Main Content ────────────────────────────────────── */}
      <main className="pt-14 pb-6 px-4 sm:px-6 max-w-[1400px] mx-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:symbol" element={<StockDetail />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)' }} className="py-4 mt-4">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            StockAI Pro -- AI-powered analysis for educational purposes only. Not financial advice.
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Data: yfinance | AI: Google Gemini | Zero cost
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
