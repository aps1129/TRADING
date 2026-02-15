import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, addToWatchlist, removeFromWatchlist, fetchNews } from '../api';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSymbol, setNewSymbol] = useState('');
    const [newName, setNewName] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const res = await getDashboard();
            setData(res.data);
            setError(null);
        } catch (err) {
            setError('Unable to connect to backend. Make sure the server is running on port 8000.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddStock = async () => {
        if (!newSymbol.trim()) return;
        try {
            await addToWatchlist(newSymbol.trim(), newName.trim() || newSymbol.trim());
            setNewSymbol('');
            setNewName('');
            setShowAddModal(false);
            loadDashboard();
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to add stock');
        }
    };

    const handleRemoveStock = async (symbol) => {
        if (!confirm(`Remove ${symbol} from watchlist?`)) return;
        try {
            await removeFromWatchlist(symbol);
            loadDashboard();
        } catch (err) {
            alert('Failed to remove stock');
        }
    };

    const handleFetchNews = async () => {
        setRefreshing(true);
        try {
            await fetchNews();
            setTimeout(() => {
                loadDashboard();
                setRefreshing(false);
            }, 3000);
        } catch {
            setRefreshing(false);
        }
    };

    if (loading) return <LoadingSkeleton />;
    if (error) return <ErrorState message={error} onRetry={loadDashboard} />;

    const { watchlist = [], recent_patterns = [], recent_news = [], prediction_stats = {} } = data || {};

    return (
        <div className="space-y-4 animate-up">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2">
                <div>
                    <h1 className="text-base font-semibold" style={{ color: 'var(--text-white)' }}>
                        Dashboard
                    </h1>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Market overview
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleFetchNews}
                        className="btn btn-secondary"
                        disabled={refreshing}>
                        {refreshing ? 'Fetching...' : 'Fetch News'}
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                        + Add Stock
                    </button>
                </div>
            </div>

            {/* ─── Stat Cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    label="Watchlist"
                    value={watchlist.length}
                    sub="stocks tracked"
                />
                <StatCard
                    label="Patterns"
                    value={recent_patterns.length}
                    sub="recently detected"
                />
                <StatCard
                    label="Predictions"
                    value={prediction_stats.total_predictions || 0}
                    sub={`${prediction_stats.accuracy || 0}% accuracy`}
                />
                <StatCard
                    label="News"
                    value={recent_news.length}
                    sub="recent articles"
                />
            </div>

            {/* ─── Watchlist Table ──────────────────────────────────── */}
            <div className="card">
                <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <h2 className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}>
                        Watchlist
                    </h2>
                    <button onClick={() => setShowAddModal(true)}
                        className="btn btn-ghost text-xs">
                        + Add
                    </button>
                </div>

                {watchlist.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>No stocks in your watchlist yet</p>
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                            + Add Your First Stock
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider"
                                    style={{ color: 'var(--text-muted)' }}>
                                    <th className="pb-2 pt-3 pl-4 font-medium">Stock</th>
                                    <th className="pb-2 pt-3 text-right font-medium">Price</th>
                                    <th className="pb-2 pt-3 text-right font-medium">Change</th>
                                    <th className="pb-2 pt-3 text-right hidden sm:table-cell font-medium">Volume</th>
                                    <th className="pb-2 pt-3 text-right pr-4 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody className="table-zebra">
                                {watchlist.map((stock) => (
                                    <tr key={stock.symbol}
                                        className="cursor-pointer group"
                                        style={{ borderTop: '1px solid var(--border)', transition: 'background 0.1s' }}
                                        onClick={() => navigate(`/stock/${stock.symbol}`)}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                                        <td className="py-2.5 pl-4">
                                            <div>
                                                <span className="mono font-semibold text-xs"
                                                    style={{ color: 'var(--text-white)' }}>
                                                    {stock.symbol}
                                                </span>
                                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{stock.name}</p>
                                            </div>
                                        </td>
                                        <td className="py-2.5 text-right mono text-xs font-medium"
                                            style={{ color: 'var(--text-white)' }}>
                                            {stock.price != null ? `₹${stock.price.toLocaleString('en-IN')}` : '—'}
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <PriceChange change={stock.change} percent={stock.change_percent} />
                                        </td>
                                        <td className="py-2.5 text-right text-[11px] hidden sm:table-cell mono"
                                            style={{ color: 'var(--text-secondary)' }}>
                                            {stock.volume ? formatVolume(stock.volume) : '—'}
                                        </td>
                                        <td className="py-2.5 text-right pr-4">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveStock(stock.symbol); }}
                                                className="btn btn-ghost text-[11px] opacity-0 group-hover:opacity-100"
                                                style={{ color: 'var(--bearish)', padding: '2px 8px' }}>
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── Two Column: Patterns + News ─────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-3">
                {/* Recent Patterns */}
                <div className="card">
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <h2 className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}>
                            Recent Patterns
                        </h2>
                    </div>
                    {recent_patterns.length === 0 ? (
                        <p className="text-xs py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                            Analyze a stock to detect patterns
                        </p>
                    ) : (
                        <div className="p-2">
                            {recent_patterns.slice(0, 6).map((p, i) => (
                                <div key={i}
                                    className="flex items-center justify-between px-3 py-2 rounded cursor-pointer"
                                    style={{ transition: 'background 0.1s' }}
                                    onClick={() => navigate(`/stock/${p.symbol}`)}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                                    <div className="flex items-center gap-3">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full"
                                            style={{
                                                background: p.pattern_type?.includes('Bullish') || p.pattern_type?.includes('Golden') || p.pattern_type?.includes('Oversold')
                                                    ? 'var(--bullish)'
                                                    : p.pattern_type?.includes('Bearish') || p.pattern_type?.includes('Death') || p.pattern_type?.includes('Overbought')
                                                        ? 'var(--bearish)'
                                                        : 'var(--neutral)'
                                            }} />
                                        <div>
                                            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.pattern_type}</p>
                                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{p.symbol}</p>
                                        </div>
                                    </div>
                                    <span className="mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                        {p.confidence}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent News */}
                <div className="card">
                    <div className="px-4 py-3 flex items-center justify-between"
                        style={{ borderBottom: '1px solid var(--border)' }}>
                        <h2 className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}>
                            Latest News
                        </h2>
                        {recent_news.length === 0 && (
                            <button onClick={handleFetchNews} className="btn btn-ghost text-[11px]">
                                Fetch Now
                            </button>
                        )}
                    </div>
                    {recent_news.length === 0 ? (
                        <p className="text-xs py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                            No news yet
                        </p>
                    ) : (
                        <div className="p-2">
                            {recent_news.slice(0, 6).map((n, i) => (
                                <div key={i}
                                    className="px-3 py-2 rounded cursor-pointer"
                                    style={{ transition: 'background 0.1s' }}
                                    onClick={() => navigate('/news')}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                                    <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                                        {n.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{n.source}</span>
                                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>|</span>
                                        <SentimentText sentiment={n.sentiment} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Add Stock Modal ─────────────────────────────────── */}
            {showAddModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-in"
                    style={{ background: 'rgba(0, 0, 0, 0.7)' }}
                    onClick={() => setShowAddModal(false)}>
                    <div className="card p-5 w-full max-w-md animate-up"
                        style={{ background: 'var(--bg-elevated)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-white)' }}>
                            Add Stock to Watchlist
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] uppercase tracking-wider mb-1 block"
                                    style={{ color: 'var(--text-muted)' }}>
                                    NSE Symbol
                                </label>
                                <input
                                    type="text"
                                    value={newSymbol}
                                    onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                                    placeholder="e.g. RELIANCE, TCS, INFY"
                                    className="input"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[11px] uppercase tracking-wider mb-1 block"
                                    style={{ color: 'var(--text-muted)' }}>
                                    Company Name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g. Reliance Industries"
                                    className="input"
                                />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button onClick={() => setShowAddModal(false)}
                                    className="btn btn-secondary flex-1">
                                    Cancel
                                </button>
                                <button onClick={handleAddStock}
                                    className="btn btn-primary flex-1">
                                    + Add Stock
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
    return (
        <div className="card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider font-medium"
                style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-lg font-bold mono mt-1" style={{ color: 'var(--text-white)' }}>{value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
        </div>
    );
}

function PriceChange({ change, percent }) {
    if (change === undefined || change === null) return <span className="text-[11px] mono" style={{ color: 'var(--text-muted)' }}>—</span>;
    const isUp = change > 0;
    const isDown = change < 0;
    const color = isUp ? 'var(--bullish)' : isDown ? 'var(--bearish)' : 'var(--text-secondary)';
    return (
        <span className="mono text-xs font-medium" style={{ color }}>
            {isUp ? '+' : ''}{percent?.toFixed(2)}%
        </span>
    );
}

function SentimentText({ sentiment }) {
    if (!sentiment || sentiment === 'pending') {
        return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Pending</span>;
    }
    const color = sentiment === 'bullish' ? 'var(--bullish)'
        : sentiment === 'bearish' ? 'var(--bearish)'
            : 'var(--neutral)';
    return <span className="text-[11px] font-medium capitalize" style={{ color }}>{sentiment}</span>;
}

function formatVolume(vol) {
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(1)}Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(1)}L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
}

function LoadingSkeleton() {
    return (
        <div className="space-y-4 pt-4">
            <div className="skeleton h-8 w-40" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-20 rounded-lg" />)}
            </div>
            <div className="skeleton h-56 rounded-lg" />
            <div className="grid lg:grid-cols-2 gap-3">
                <div className="skeleton h-40 rounded-lg" />
                <div className="skeleton h-40 rounded-lg" />
            </div>
        </div>
    );
}

function ErrorState({ message, onRetry }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 animate-in">
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-white)' }}>Connection Error</h2>
            <p className="text-xs text-center max-w-md mb-4" style={{ color: 'var(--text-secondary)' }}>{message}</p>
            <button onClick={onRetry} className="btn btn-primary">
                Retry
            </button>
        </div>
    );
}
