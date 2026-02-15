import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, Plus, Trash2, RefreshCw, Eye,
    ArrowUpRight, ArrowDownRight, Minus, Newspaper, Zap, AlertTriangle
} from 'lucide-react';
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
        <div className="space-y-6 animate-fade-in-up">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Your market overview at a glance
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleFetchNews}
                        className="btn btn-secondary text-xs"
                        disabled={refreshing}>
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Fetching...' : 'Fetch News'}
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="btn btn-primary text-xs">
                        <Plus size={14} />
                        Add Stock
                    </button>
                </div>
            </div>

            {/* ─── Stat Cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
                <StatCard
                    label="Watchlist"
                    value={watchlist.length}
                    sub="stocks tracked"
                    color="blue"
                    icon={Eye}
                />
                <StatCard
                    label="Patterns"
                    value={recent_patterns.length}
                    sub="recently detected"
                    color="purple"
                    icon={Zap}
                />
                <StatCard
                    label="Predictions"
                    value={prediction_stats.total_predictions || 0}
                    sub={`${prediction_stats.accuracy || 0}% accuracy`}
                    color="green"
                    icon={TrendingUp}
                />
                <StatCard
                    label="News"
                    value={recent_news.length}
                    sub="recent articles"
                    color="amber"
                    icon={Newspaper}
                />
            </div>

            {/* ─── Watchlist ───────────────────────────────────────── */}
            <div className="glass-card p-5 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Eye size={18} className="text-blue-400" />
                        Watchlist
                    </h2>
                    <button onClick={() => setShowAddModal(true)}
                        className="btn btn-ghost text-xs">
                        <Plus size={14} />
                        Add
                    </button>
                </div>

                {watchlist.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                            <TrendingUp size={28} className="text-slate-600" />
                        </div>
                        <p className="text-slate-500 text-sm mb-4">No stocks in your watchlist yet</p>
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary text-sm">
                            <Plus size={16} />
                            Add Your First Stock
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                                    <th className="pb-3 pl-2">Stock</th>
                                    <th className="pb-3 text-right">Price</th>
                                    <th className="pb-3 text-right">Change</th>
                                    <th className="pb-3 text-right hidden sm:table-cell">Volume</th>
                                    <th className="pb-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="stagger-children">
                                {watchlist.map((stock) => (
                                    <tr key={stock.symbol}
                                        className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                        onClick={() => navigate(`/stock/${stock.symbol}`)}>
                                        <td className="py-3.5 pl-2">
                                            <div>
                                                <span className="font-semibold text-sm text-white group-hover:text-blue-400 transition-colors">
                                                    {stock.symbol}
                                                </span>
                                                <p className="text-xs text-slate-500 mt-0.5">{stock.name}</p>
                                            </div>
                                        </td>
                                        <td className="py-3.5 text-right font-mono text-sm font-medium">
                                            ₹{stock.price?.toLocaleString('en-IN') || '—'}
                                        </td>
                                        <td className="py-3.5 text-right">
                                            <PriceChange change={stock.change} percent={stock.change_percent} />
                                        </td>
                                        <td className="py-3.5 text-right text-xs text-slate-500 hidden sm:table-cell font-mono">
                                            {stock.volume ? formatVolume(stock.volume) : '—'}
                                        </td>
                                        <td className="py-3.5 text-right">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveStock(stock.symbol); }}
                                                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100">
                                                <Trash2 size={14} />
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
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Patterns */}
                <div className="glass-card p-5 sm:p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Zap size={18} className="text-purple-400" />
                        Recent Patterns
                    </h2>
                    {recent_patterns.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center">
                            Analyze a stock to detect patterns
                        </p>
                    ) : (
                        <div className="space-y-3 stagger-children">
                            {recent_patterns.slice(0, 6).map((p, i) => (
                                <div key={i}
                                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                                    onClick={() => navigate(`/stock/${p.symbol}`)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${p.pattern_type?.includes('Bullish') || p.pattern_type?.includes('Golden') || p.pattern_type?.includes('Oversold')
                                                ? 'bg-emerald-400'
                                                : p.pattern_type?.includes('Bearish') || p.pattern_type?.includes('Death') || p.pattern_type?.includes('Overbought')
                                                    ? 'bg-red-400'
                                                    : 'bg-amber-400'
                                            }`} />
                                        <div>
                                            <p className="text-sm font-medium">{p.pattern_type}</p>
                                            <p className="text-xs text-slate-500">{p.symbol}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-600 font-mono">
                                        {p.confidence}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent News */}
                <div className="glass-card p-5 sm:p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Newspaper size={18} className="text-amber-400" />
                        Latest News
                    </h2>
                    {recent_news.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-slate-500 mb-3">No news yet</p>
                            <button onClick={handleFetchNews} className="btn btn-secondary text-xs">
                                <RefreshCw size={14} />
                                Fetch News Now
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 stagger-children">
                            {recent_news.slice(0, 6).map((n, i) => (
                                <div key={i}
                                    className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                                    onClick={() => navigate('/news')}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-snug line-clamp-2">{n.title}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-xs text-slate-600">{n.source}</span>
                                                <span className="text-xs text-slate-700">•</span>
                                                <SentimentBadge sentiment={n.sentiment} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Add Stock Modal ─────────────────────────────────── */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
                    onClick={() => setShowAddModal(false)}>
                    <div className="glass-card p-6 w-full max-w-md animate-fade-in-up"
                        style={{ background: 'rgba(15, 23, 42, 0.97)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold mb-4">Add Stock to Watchlist</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 block">
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
                                <label className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 block">
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
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowAddModal(false)}
                                    className="btn btn-secondary flex-1">
                                    Cancel
                                </button>
                                <button onClick={handleAddStock}
                                    className="btn btn-primary flex-1">
                                    <Plus size={16} />
                                    Add Stock
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

function StatCard({ label, value, sub, color, icon: Icon }) {
    const colorMap = {
        blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
        purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
        green: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
        amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
    };
    const iconColorMap = {
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        green: 'text-emerald-400',
        amber: 'text-amber-400',
    };

    return (
        <div className={`rounded-2xl border bg-gradient-to-br p-4 sm:p-5 ${colorMap[color]}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1.5">{value}</p>
                    <p className="text-xs text-slate-500 mt-1">{sub}</p>
                </div>
                <Icon size={20} className={iconColorMap[color]} />
            </div>
        </div>
    );
}

function PriceChange({ change, percent }) {
    if (change === undefined || change === null) return <span className="text-xs text-slate-600">—</span>;
    const isUp = change > 0;
    const isDown = change < 0;
    return (
        <div className={`flex items-center gap-1 justify-end ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-500'}`}>
            {isUp ? <ArrowUpRight size={14} /> : isDown ? <ArrowDownRight size={14} /> : <Minus size={14} />}
            <span className="text-xs font-mono font-medium">
                {isUp ? '+' : ''}{percent?.toFixed(2)}%
            </span>
        </div>
    );
}

function SentimentBadge({ sentiment }) {
    const cls = sentiment === 'bullish' ? 'badge-bullish'
        : sentiment === 'bearish' ? 'badge-bearish'
            : 'badge-neutral';
    return <span className={`badge text-[10px] ${cls}`}>{sentiment || 'pending'}</span>;
}

function formatVolume(vol) {
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(1)}Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(1)}L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
}

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            <div className="skeleton h-10 w-48" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
            </div>
            <div className="skeleton h-64 rounded-2xl" />
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="skeleton h-48 rounded-2xl" />
                <div className="skeleton h-48 rounded-2xl" />
            </div>
        </div>
    );
}

function ErrorState({ message, onRetry }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mb-6">
                <AlertTriangle size={32} className="text-red-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
            <p className="text-sm text-slate-500 text-center max-w-md mb-6">{message}</p>
            <button onClick={onRetry} className="btn btn-primary">
                <RefreshCw size={16} />
                Retry
            </button>
        </div>
    );
}
