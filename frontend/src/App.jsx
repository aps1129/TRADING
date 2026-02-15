import { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Newspaper, BarChart3,
  Search, Menu, X, Zap, ChevronRight
} from 'lucide-react';
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
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/news', icon: Newspaper, label: 'News' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  ];

  return (
    <div className="min-h-screen bg-grid">
      {/* ─── Navbar ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5"
        style={{ background: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--gradient-primary)' }}>
                <Zap size={18} className="text-white" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-white">
                  StockAI
                </span>
                <span className="hidden sm:inline text-xs text-slate-500 ml-1.5 font-medium">
                  PRO
                </span>
              </div>
            </NavLink>

            {/* Search Bar (Desktop) */}
            <div className="hidden md:flex relative flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchQuery && setShowSearch(true)}
                  onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                  placeholder="Search stocks... (e.g. RELIANCE, TCS)"
                  className="input pl-10 pr-4 py-2.5 text-sm bg-white/[0.04] border-white/[0.08]"
                />
                {showSearch && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 glass-card p-2 max-h-64 overflow-y-auto z-50"
                    style={{ background: 'rgba(15, 23, 42, 0.97)' }}>
                    {searchResults.map((s) => (
                      <button key={s.symbol}
                        onMouseDown={() => selectStock(s.symbol)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                          hover:bg-white/[0.06] transition-colors text-left group cursor-pointer">
                        <div>
                          <span className="font-semibold text-white text-sm">{s.symbol}</span>
                          <span className="text-slate-500 text-xs ml-2">{s.name}</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Nav Links (Desktop) */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-white/[0.08] text-white shadow-inner'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`
                  }>
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors">
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 animate-fade-in"
            style={{ background: 'rgba(10, 14, 26, 0.97)' }}>
            <div className="px-4 py-3">
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search stocks..."
                  className="input pl-10 py-2.5 text-sm"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mb-3 space-y-1">
                  {searchResults.slice(0, 5).map((s) => (
                    <button key={s.symbol}
                      onClick={() => selectStock(s.symbol)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                        hover:bg-white/[0.06] transition-colors text-left">
                      <span className="font-semibold text-sm">{s.symbol}</span>
                      <span className="text-slate-500 text-xs">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                {navLinks.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} end={to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all
                      ${isActive ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white'}`
                    }>
                    <Icon size={18} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Main Content ────────────────────────────────────── */}
      <main className="pt-20 pb-8 px-4 sm:px-6 max-w-7xl mx-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:symbol" element={<StockDetail />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            StockAI Pro — AI-powered analysis for educational purposes only
          </p>
          <p className="text-xs text-slate-700">
            Data: yfinance • AI: Google Gemini • Zero monthly cost
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
