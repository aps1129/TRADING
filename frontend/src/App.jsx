import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import NewsPage from './pages/NewsPage';
import Analytics from './pages/Analytics';
import { searchStocks } from './api';
import './index.css';

// Custom Hook to close mobile menu on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

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
    { to: '/', label: 'Overview' },
    { to: '/news', label: 'News AI' },
    { to: '/analytics', label: 'Predictions' },
  ];

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <ScrollToTop />
      {/* ─── Premium Glass Navbar ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav shadow-lg">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Brand Logo */}
            <NavLink to="/" className="flex items-center gap-3 shrink-0 group">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-[var(--accent)] to-[var(--ai-purple)] flex items-center justify-center shadow-[0_0_15px_var(--accent-glow)] group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-[var(--accent)] transition-colors">
                StockAI
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-bg)] uppercase tracking-wider">
                PRO
              </span>
            </NavLink>

            {/* Global Search Bar (Desktop) */}
            <div className="hidden md:flex relative flex-1 max-w-xl mx-10">
              <div className="relative w-full group">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchQuery && setShowSearch(true)}
                  onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                  placeholder="Search NSE stocks (e.g. RELIANCE, TCS)..."
                  className="input pl-12 pr-12 py-2.5 w-full bg-[#06090F]/50 focus:bg-[#06090F]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] px-2 py-1 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)] font-mono font-bold tracking-widest hidden lg:block">
                  CTRL+K
                </span>

                {/* Search Dropdown */}
                {showSearch && searchResults.length > 0 && (
                  <div className="absolute top-[calc(100%+8px)] left-0 right-0 p-2 shadow-2xl z-50 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] max-h-80 overflow-y-auto">
                    {searchResults.map((s) => (
                      <button key={s.symbol}
                        onMouseDown={() => selectStock(s.symbol)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left cursor-pointer transition-colors hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border)] group">
                        <div className="flex flex-col">
                          <span className="mono font-bold text-[13px] text-white group-hover:text-[var(--accent)] transition-colors">{s.symbol}</span>
                          <span className="text-[12px] text-[var(--text-secondary)] mt-0.5">{s.name}</span>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-[var(--bg-base)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[14px] text-[var(--accent)]">→</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Nav Links (Desktop) */}
            <div className="hidden md:flex items-center gap-2">
              {navLinks.map(({ to, label }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${isActive
                      ? 'bg-[var(--bg-surface)] text-white shadow-inner border border-[var(--border)]'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card)]'}`
                  }>
                  {label}
                </NavLink>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden glass-nav border-t border-[var(--border)] absolute top-full left-0 right-0 shadow-2xl">
            <div className="p-4 space-y-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search NSE stocks..."
                  className="input pl-10 py-3 text-[14px] w-full"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] p-2">
                  {searchResults.slice(0, 5).map((s) => (
                    <button key={s.symbol}
                      onClick={() => selectStock(s.symbol)}
                      className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-left border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-surface)]">
                      <span className="mono font-bold text-white">{s.symbol}</span>
                      <span className="text-[12px] text-[var(--text-secondary)]">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="pt-2 flex flex-col gap-2">
                {navLinks.map(({ to, label }) => (
                  <NavLink key={to} to={to} end={to === '/'}
                    className={({ isActive }) =>
                      `block px-4 py-3 rounded-lg text-[14px] font-bold transition-colors ${isActive
                        ? 'bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[var(--accent)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                      }`
                    }>
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Main Content ────────────────────────────────────── */}
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto min-h-[calc(100vh-80px)]">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:symbol" element={<StockDetail />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>

      {/* ─── Terminal Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] bg-[#030408] py-8">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--bullish)] animate-pulse" />
            <p className="text-[12px] font-mono text-[var(--text-muted)]">
              SYSTEM ONLINE • MARKETS ACTIVE
            </p>
          </div>
          <div className="flex gap-6 text-[12px] font-mono text-[var(--text-muted)]">
            <span>DATA: <b className="text-[var(--text-secondary)]">YFINANCE</b></span>
            <span>AI: <b className="text-[var(--ai-purple)]">GEMINI 2.0</b></span>
          </div>
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
