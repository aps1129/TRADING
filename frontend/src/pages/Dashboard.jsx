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
        <div className="space-y-8 animate-up">
            {/* ─── Hero Header ──────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-elevated)] via-[var(--bg-card)] to-[var(--bg-base)] p-8 shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--accent)] rounded-full blur-[150px] opacity-[0.07] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--ai-purple)] rounded-full blur-[120px] opacity-[0.05] pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--ai-purple)] flex items-center justify-center shadow-[0_0_25px_var(--accent-glow)]">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            Market Overview
                        </h1>
                        <p className="text-[13px] text-[var(--text-secondary)] mt-3 ml-16 uppercase tracking-wider font-mono font-semibold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--bullish)] shadow-[0_0_8px_var(--bullish)] animate-pulse" />
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 ml-16 sm:ml-0">
                        <button onClick={handleFetchNews} className="btn btn-secondary border border-[var(--border)] shadow-sm font-mono text-[12px] uppercase" disabled={refreshing}>
                            {refreshing ? (
                                <><span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-ping mr-2" />SYNCING...</>
                            ) : (
                                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> SYNC NEWS</>
                            )}
                        </button>
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary shadow-lg font-mono text-[12px] uppercase">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            ADD TICKER
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Stat Widgets ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard title="TRACKED TICKERS" value={watchlist.length} subtext="Active Monitoring" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" color="var(--accent)" />
                <StatCard title="DETECTED PATTERNS" value={recent_patterns.length} subtext="Last 24 Hours" icon="M9 19v-6a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h3a2 2 0 002-2zm0 0V9a2 2 0 012-2h3a2 2 0 012 2v10m-6 0a2 2 0 002 2h3a2 2 0 002-2m0 0V5a2 2 0 012-2h3a2 2 0 012 2v14a2 2 0 01-2 2h-3a2 2 0 01-2-2z" color="var(--neutral)" />
                <StatCard title="AI PREDICTIONS" value={prediction_stats.total_predictions || 0} subtext={`${prediction_stats.accuracy || 0}% Accuracy`} icon="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" color="var(--ai-purple)" />
                <StatCard title="NEWS ARTICLES" value={recent_news.length} subtext="Processed Data" icon="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" color="var(--bullish)" />
            </div>

            {/* ─── Watchlist Terminal ──────────────────────────────────── */}
            <div className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-2xl bg-[var(--bg-card)]">
                <div className="flex items-center justify-between px-7 py-5 bg-gradient-to-r from-[#0A0E17] to-[var(--bg-elevated)] border-b border-[var(--border)]">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] animate-pulse" />
                        Live Watchlist
                    </h2>
                    <button onClick={() => setShowAddModal(true)} className="btn btn-ghost text-[12px] font-mono border border-[var(--border)] px-4 py-2 hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white transition-all rounded-lg">
                        + TICKER
                    </button>
                </div>

                {watchlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-4 bg-gradient-to-b from-[var(--bg-base)] to-[var(--bg-card)]">
                        <div className="w-20 h-20 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mb-6 shadow-lg">
                            <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        </div>
                        <p className="text-lg font-bold text-[var(--text-secondary)] mb-2">No Assets Tracked</p>
                        <p className="text-[12px] text-[var(--text-muted)] font-mono uppercase tracking-widest mb-8">Add your first ticker to start monitoring</p>
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary shadow-[0_0_30px_var(--accent-glow)] px-10 py-3.5 text-[14px] font-mono uppercase tracking-wider">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            Initialize Tracking
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#060910]">
                                <tr className="text-[10px] uppercase font-mono tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                                    <th className="py-4 px-7 font-semibold">Asset Symbol</th>
                                    <th className="py-4 px-6 text-right font-semibold">Last Price</th>
                                    <th className="py-4 px-6 text-right font-semibold">24h Change</th>
                                    <th className="py-4 px-6 text-right hidden sm:table-cell font-semibold">Volume</th>
                                    <th className="py-4 px-6 text-right font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody className="table-zebra font-mono">
                                {watchlist.map((stock) => (
                                    <tr key={stock.symbol}
                                        className="cursor-pointer group border-b border-[var(--border)] hover:bg-[var(--bg-surface)] transition-colors"
                                        onClick={() => navigate(`/stock/${stock.symbol}`)}>
                                        <td className="py-5 px-7">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-[15px] text-white group-hover:text-[var(--accent)] transition-colors">
                                                    {stock.symbol}
                                                </span>
                                                <span className="text-[11px] text-[var(--text-secondary)] mt-1 truncate max-w-[200px] uppercase font-sans">
                                                    {stock.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-5 px-6 text-right font-medium text-[15px] text-white">
                                            {stock.price != null ? `₹${stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                        </td>
                                        <td className="py-5 px-6 text-right">
                                            <PriceChange change={stock.change} percent={stock.change_percent} />
                                        </td>
                                        <td className="py-5 px-6 text-right text-[13px] hidden sm:table-cell text-[var(--text-secondary)]">
                                            {stock.volume ? formatVolume(stock.volume) : '—'}
                                        </td>
                                        <td className="py-5 px-6 text-right">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveStock(stock.symbol); }}
                                                className="btn btn-ghost text-[10px] font-mono tracking-widest border border-transparent hover:border-[var(--bearish-border)] hover:bg-[var(--bearish-bg)] hover:text-[var(--bearish)] opacity-0 group-hover:opacity-100 transition-all rounded-lg py-1.5 px-3">
                                                REMOVE
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── AI Insights Grid ─────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-6">

                {/* Patterns Radar */}
                <div className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl bg-[var(--bg-card)] flex flex-col min-h-[420px]">
                    <div className="bg-gradient-to-r from-[#0A0E17] to-[var(--bg-card)] px-7 py-5 flex items-center justify-between border-b border-[var(--border)]">
                        <h2 className="text-[12px] font-bold uppercase tracking-widest text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--neutral-bg)] border border-[var(--neutral-border)] flex items-center justify-center">
                                <svg className="w-4 h-4 text-[var(--neutral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h3a2 2 0 002-2zm0 0V9a2 2 0 012-2h3a2 2 0 012 2v10m-6 0a2 2 0 002 2h3a2 2 0 002-2m0 0V5a2 2 0 012-2h3a2 2 0 012 2v14a2 2 0 01-2 2h-3a2 2 0 01-2-2z" /></svg>
                            </div>
                            Technical Radar
                        </h2>
                    </div>
                    {recent_patterns.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 bg-gradient-to-b from-[var(--bg-base)] to-[var(--bg-card)]">
                            <div className="w-16 h-16 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mb-5">
                                <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h3a2 2 0 002-2zm0 0V9a2 2 0 012-2h3a2 2 0 012 2v10m-6 0a2 2 0 002 2h3a2 2 0 002-2m0 0V5a2 2 0 012-2h3a2 2 0 012 2v14a2 2 0 01-2 2h-3a2 2 0 01-2-2z" /></svg>
                            </div>
                            <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-2">Awaiting Signals</p>
                            <p className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-widest text-center">Analyze a stock to detect<br />chart patterns</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto max-h-[400px] p-3">
                            {recent_patterns.slice(0, 6).map((p, i) => {
                                const isBull = p.pattern_type?.includes('Bullish') || p.pattern_type?.includes('Golden') || p.pattern_type?.includes('Oversold');
                                const isBear = p.pattern_type?.includes('Bearish') || p.pattern_type?.includes('Death') || p.pattern_type?.includes('Overbought');
                                const clr = isBull ? 'var(--bullish)' : isBear ? 'var(--bearish)' : 'var(--neutral)';
                                return (
                                    <div key={i}
                                        className="flex items-center justify-between p-4 mb-2 rounded-xl border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] cursor-pointer transition-all group"
                                        onClick={() => navigate(`/stock/${p.symbol}`)}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center border" style={{ borderColor: isBull ? 'var(--bullish-border)' : isBear ? 'var(--bearish-border)' : 'var(--neutral-border)', backgroundColor: isBull ? 'var(--bullish-bg)' : isBear ? 'var(--bearish-bg)' : 'var(--neutral-bg)' }}>
                                                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px] animate-pulse" style={{ backgroundColor: clr, color: clr }} />
                                            </div>
                                            <div>
                                                <p className="text-[14px] font-bold text-white group-hover:text-[var(--accent)] transition-colors">{p.symbol}</p>
                                                <p className="text-[11px] font-medium uppercase tracking-wider mt-0.5" style={{ color: clr }}>{p.pattern_type}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <span className="mono text-[14px] font-bold text-white">{p.confidence}%</span>
                                            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5 font-mono">Confidence</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* News Feed */}
                <div className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl bg-[var(--bg-card)] flex flex-col min-h-[420px]">
                    <div className="bg-gradient-to-r from-[#0A0E17] to-[var(--bg-card)] px-7 py-5 flex items-center justify-between border-b border-[var(--border)]">
                        <h2 className="text-[12px] font-bold uppercase tracking-widest text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--ai-purple-bg)] border border-[var(--ai-purple-border)] flex items-center justify-center">
                                <svg className="w-4 h-4 text-[var(--ai-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                            </div>
                            AI Intel Stream
                        </h2>
                        {recent_news.length === 0 && (
                            <button onClick={handleFetchNews} className="text-[10px] text-[var(--accent)] hover:text-white font-mono uppercase tracking-widest transition-colors font-bold">
                                [ Execute Sync ]
                            </button>
                        )}
                    </div>
                    {recent_news.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 bg-gradient-to-b from-[var(--bg-base)] to-[var(--bg-card)]">
                            <div className="w-16 h-16 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mb-5">
                                <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                            </div>
                            <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-2">Data Stream Empty</p>
                            <p className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-widest text-center mb-6">Click sync to pull latest<br />market intelligence</p>
                            <button onClick={handleFetchNews} disabled={refreshing} className="btn btn-primary text-[12px] font-mono uppercase px-6">
                                {refreshing ? 'Syncing...' : 'Sync News'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-[var(--border)]">
                            {recent_news.slice(0, 6).map((n, i) => (
                                <div key={i}
                                    className="p-5 hover:bg-[var(--bg-surface)] cursor-pointer transition-colors group relative overflow-hidden"
                                    onClick={() => navigate('/news')}>
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-[var(--ai-purple)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <p className="text-[14px] font-semibold text-[var(--text-primary)] leading-relaxed group-hover:text-white transition-colors mb-3">
                                        {n.title}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-muted)] bg-[var(--bg-base)] px-2.5 py-1 rounded-md border border-[var(--border)]">
                                            {n.source}
                                        </span>
                                        <SentimentBadge sentiment={n.sentiment} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Add Stock Modal ─────────────────────────────────── */}
            {showAddModal && (
                <div className="fixed inset-0 flex items-center justify-center z-[100] p-4 bg-black/60 backdrop-blur-md"
                    onClick={() => setShowAddModal(false)}>
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 w-full max-w-lg shadow-[0_0_60px_rgba(0,0,0,0.8)] animate-up relative overflow-hidden"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="absolute -top-32 -right-32 w-64 h-64 bg-[var(--accent)] rounded-full blur-[100px] opacity-20 pointer-events-none" />
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-bg)] border border-[var(--accent)] flex items-center justify-center">
                                        <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    </div>
                                    Add Ticker
                                </h3>
                                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface)] transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--text-secondary)] mb-2.5 block">
                                        NSE Symbol
                                    </label>
                                    <input type="text" value={newSymbol}
                                        onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                                        placeholder="e.g. RELIANCE, TCS"
                                        className="input bg-[var(--bg-base)] text-lg py-3.5 font-mono border-2 border-[var(--border)] focus:border-[var(--accent)]"
                                        autoFocus />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--text-secondary)] mb-2.5 block">
                                        Company Name <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
                                    </label>
                                    <input type="text" value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="e.g. Reliance Industries Ltd."
                                        className="input bg-[var(--bg-base)] text-[14px] py-3.5 border-2 border-[var(--border)] focus:border-[var(--accent)]" />
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button onClick={() => setShowAddModal(false)} className="btn btn-secondary flex-1 py-3.5 text-[14px]">
                                        Cancel
                                    </button>
                                    <button onClick={handleAddStock} className="btn btn-primary flex-1 py-3.5 text-[14px] shadow-[0_0_20px_var(--accent-glow)]">
                                        Add to Watchlist
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatCard({ title, value, subtext, icon, color }) {
    return (
        <div className="rounded-2xl border border-[var(--border)] p-6 relative overflow-hidden group bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-card)] shadow-lg hover:shadow-xl hover:border-[var(--border-hover)] transition-all duration-300">
            {/* Background icon watermark */}
            <div className="absolute top-0 right-0 p-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                <svg className="w-28 h-28" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d={icon} />
                </svg>
            </div>
            {/* Glow */}
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none" style={{ background: color }} />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-5">
                    <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--text-muted)] line-clamp-1 break-all mr-2">{title}</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--border)] bg-[var(--bg-base)] shadow-sm shrink-0">
                        <svg className="w-4 h-4" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
                        </svg>
                    </div>
                </div>
                <p className="text-4xl font-black font-mono text-white tracking-tight mb-2">{value}</p>
                <p className="text-[12px] font-medium text-[var(--text-secondary)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
                    {subtext}
                </p>
            </div>
        </div>
    );
}

function PriceChange({ change, percent }) {
    if (change === undefined || change === null) return <span className="text-[14px] font-mono text-[var(--text-muted)]">—</span>;
    const isUp = change > 0;
    const isDown = change < 0;
    const color = isUp ? 'var(--bullish)' : isDown ? 'var(--bearish)' : 'var(--text-secondary)';
    const bgColor = isUp ? 'var(--bullish-bg)' : isDown ? 'var(--bearish-bg)' : 'transparent';
    const borderColor = isUp ? 'var(--bullish-border)' : isDown ? 'var(--bearish-border)' : 'var(--border)';

    return (
        <span className="mono text-[13px] font-bold px-3 py-1.5 rounded-lg inline-block border" style={{ color, backgroundColor: bgColor, borderColor }}>
            {isUp ? '+' : ''}{percent?.toFixed(2)}%
        </span>
    );
}

function SentimentBadge({ sentiment }) {
    if (!sentiment || sentiment === 'pending') {
        return <span className="badge text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border)]">PENDING AI</span>;
    }
    const BadgeClass = sentiment === 'bullish' ? 'badge-bullish' : sentiment === 'bearish' ? 'badge-bearish' : 'badge-neutral';
    return <span className={`badge ${BadgeClass} flex items-center gap-1.5`}>
        {sentiment === 'bullish' && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
        {sentiment === 'bearish' && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>}
        {sentiment === 'neutral' && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14" /></svg>}
        {sentiment}
    </span>;
}

function formatVolume(vol) {
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)}Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(2)}L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toLocaleString();
}

function LoadingSkeleton() {
    return (
        <div className="space-y-8 pt-2 w-full">
            <div className="skeleton h-36 rounded-2xl" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
            </div>
            <div className="skeleton h-72 rounded-2xl" />
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="skeleton h-96 rounded-2xl" />
                <div className="skeleton h-96 rounded-2xl" />
            </div>
        </div>
    );
}

function ErrorState({ message, onRetry }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="w-24 h-24 bg-[var(--bearish-bg)] rounded-2xl flex items-center justify-center mb-8 border-2 border-[var(--bearish-border)] shadow-[0_0_40px_var(--bearish-bg)]">
                <svg className="w-12 h-12 text-[var(--bearish)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h2 className="text-3xl font-black text-white mb-4">System Offline</h2>
            <p className="text-[14px] text-[var(--text-secondary)] font-mono mb-10 max-w-md leading-relaxed">{message}</p>
            <button onClick={onRetry} className="btn btn-primary shadow-[0_0_30px_var(--accent-glow)] px-10 py-3.5 text-[14px]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Re-initialize Connection
            </button>
        </div>
    );
}
