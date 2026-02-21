import { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid
} from 'recharts';
import { getAnalytics, getPredictions } from '../api';

// Strict terminal colors
const COLORS = {
    bullish: '#00E676',
    bearish: '#FF1744',
    neutral: '#FFD600',
    pending: '#64748B',
    accent: '#2962FF'
};

export default function Analytics() {
    const [analytics, setAnalytics] = useState(null);
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [analyticsRes, predRes] = await Promise.all([
                getAnalytics(),
                getPredictions({ limit: 50 }),
            ]);
            setAnalytics(analyticsRes.data);
            setPredictions(predRes.data.predictions || []);
        } catch {
            // silently handle
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 pt-6">
                <div className="skeleton h-24 rounded-2xl" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
                </div>
                <div className="grid lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton h-64 rounded-xl" />)}
                </div>
            </div>
        );
    }

    const predStats = analytics?.predictions || {};
    const patterns = analytics?.patterns || {};
    const sentiment = analytics?.news_sentiment || {};

    const sentimentData = Object.entries(sentiment)
        .filter(([k]) => k !== 'pending')
        .map(([name, value]) => ({ name, value }));

    const patternData = Object.entries(patterns.distribution || {})
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const directionData = [
        { name: 'Bullish', value: predStats.by_direction?.bullish || 0, fill: COLORS.bullish },
        { name: 'Bearish', value: predStats.by_direction?.bearish || 0, fill: COLORS.bearish },
        { name: 'Neutral', value: predStats.by_direction?.neutral || 0, fill: COLORS.neutral },
    ];

    return (
        <div className="space-y-6 animate-up max-w-[1200px] mx-auto">
            {/* ─── Premium Header Widget ──────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 py-6 border-b border-[var(--border)] bg-gradient-to-r from-[var(--bg-elevated)] to-transparent rounded-2xl px-6 border shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)] rounded-full blur-[120px] opacity-10 pointer-events-none" />
                <div className="relative z-10">
                    <h1 className="text-3xl font-black font-mono text-white tracking-tighter drop-shadow-md flex items-center gap-3">
                        <svg className="w-8 h-8 text-[var(--accent)] drop-shadow-[0_0_10px_var(--accent-glow)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Performance Telemetry
                    </h1>
                    <p className="text-[12px] mt-2 text-[var(--text-secondary)] font-mono uppercase tracking-widest font-bold flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)] animate-pulse" />
                        Live tracking model accuracy & neural distribution metrics
                    </p>
                </div>
                <button onClick={loadData} className="btn btn-primary shadow-[0_0_15px_var(--accent-glow)] font-mono text-[11px] tracking-widest uppercase relative z-10 self-stretch sm:self-auto">
                    SYNC DATA
                </button>
            </div>

            {/* ─── Metric Grid ────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Volume"
                    value={predStats.total_predictions || 0}
                    sub="Total Dispatched"
                    glowColor="var(--accent)"
                    icon="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
                <StatCard
                    label="Hit Rate"
                    value={`${predStats.accuracy || 0}%`}
                    sub={`${predStats.correct || 0} / ${predStats.resolved || 0} Validated`}
                    glowColor={predStats.accuracy >= 60 ? 'var(--bullish)' : predStats.accuracy >= 40 ? 'var(--neutral)' : 'var(--bearish)'}
                    icon="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
                <StatCard
                    label="Resolved"
                    value={predStats.resolved || 0}
                    sub="Completed Targets"
                    glowColor="var(--neutral)"
                    icon="M5 13l4 4L19 7"
                />
                <StatCard
                    label="Pending"
                    value={predStats.pending || 0}
                    sub="Open Positions"
                    glowColor="var(--text-muted)"
                    icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </div>

            {/* ─── Visual Analytics Layout ──────────────────────────────────────── */}
            <div className="grid lg:grid-cols-3 gap-6">

                {/* News Sentiment Donut */}
                <div className="card shadow-xl border border-[var(--border)] flex flex-col relative overflow-hidden">
                    <div className="bg-[#0A0E17] px-5 py-4 flex items-center justify-between border-b border-[var(--border)] z-10">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#D500F9] flex items-center gap-2 font-mono">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                            Sentiment Net
                        </h3>
                    </div>
                    {sentimentData.length > 0 ? (
                        <div className="p-6 flex-1 flex flex-col bg-[var(--bg-base)] z-10">
                            <div className="flex-1 min-h-[160px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={sentimentData} dataKey="value" nameKey="name"
                                            cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                                            paddingAngle={4} stroke="var(--bg-card)" strokeWidth={2}>
                                            {sentimentData.map((entry) => (
                                                <Cell key={entry.name} fill={COLORS[entry.name] || '#64748B'} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="mono text-2xl font-black text-white">{sentimentData.reduce((a, b) => a + b.value, 0)}</span>
                                </div>
                            </div>
                            <div className="flex justify-center flex-wrap gap-x-5 gap-y-2 mt-4 pt-4 border-t border-[var(--border)]">
                                {sentimentData.map(d => (
                                    <div key={d.name} className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase font-bold text-[var(--text-secondary)]">
                                        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[d.name] }} />
                                        {d.name} <span className="text-white ml-1">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyChart />
                    )}
                </div>

                {/* Prediction Distribution Donut */}
                <div className="card shadow-xl border border-[var(--border)] flex flex-col relative overflow-hidden">
                    <div className="bg-[#0A0E17] px-5 py-4 flex items-center justify-between border-b border-[var(--border)] z-10">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--accent)] flex items-center gap-2 font-mono">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            Model Forecast Array
                        </h3>
                    </div>
                    {directionData.some(d => d.value > 0) ? (
                        <div className="p-6 flex-1 flex flex-col bg-[var(--bg-base)] z-10">
                            <div className="flex-1 min-h-[160px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={directionData.filter(d => d.value > 0)} dataKey="value" nameKey="name"
                                            cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                                            paddingAngle={4} stroke="var(--bg-card)" strokeWidth={2}>
                                            {directionData.filter(d => d.value > 0).map((entry) => (
                                                <Cell key={entry.name} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="mono text-2xl font-black text-white">{directionData.reduce((a, b) => a + b.value, 0)}</span>
                                </div>
                            </div>
                            <div className="flex justify-center flex-wrap gap-x-5 gap-y-2 mt-4 pt-4 border-t border-[var(--border)]">
                                {directionData.map(d => (
                                    <div key={d.name} className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase font-bold text-[var(--text-secondary)]">
                                        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
                                        {d.name} <span className="text-white ml-1">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyChart />
                    )}
                </div>

                {/* Pattern Distribution Bar */}
                <div className="card shadow-xl border border-[var(--border)] flex flex-col relative overflow-hidden">
                    <div className="bg-[#0A0E17] px-5 py-4 flex items-center justify-between border-b border-[var(--border)] z-10">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#06B6D4] flex items-center gap-2 font-mono">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                            Volume By Signature
                        </h3>
                    </div>
                    {patternData.length > 0 ? (
                        <div className="p-6 flex-1 bg-[var(--bg-base)] z-10 flex flex-col justify-center">
                            <div style={{ height: '200px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={patternData} layout="vertical" margin={{ left: -10, p: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'Roboto Mono' }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                        <Bar dataKey="value" fill="url(#colorBarBase)" radius={[0, 4, 4, 0]} barSize={20} />
                                        <defs>
                                            <linearGradient id="colorBarBase" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.6} />
                                                <stop offset="100%" stopColor="#06B6D4" stopOpacity={1} />
                                            </linearGradient>
                                        </defs>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <EmptyChart />
                    )}
                </div>
            </div>

            {/* ─── High-Density Terminal Log (History) ──────────────────────────────── */}
            <div className="card shadow-2xl border flex flex-col md:flex-row border-[var(--border)] overflow-hidden">

                {/* Accuracy Gauge Box */}
                {predStats.resolved > 0 && (
                    <div className="bg-[#0A0E17] md:w-64 p-8 flex flex-col justify-center items-center border-b md:border-b-0 md:border-r border-[var(--border)] relative overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-[var(--accent)] rounded-full blur-[80px] opacity-10 pointer-events-none" />
                        <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] font-mono mb-4 text-center">Net Precision Index</p>
                        <div className="relative" style={{ width: '130px', height: '130px' }}>
                            <svg className="w-full h-full drop-shadow-lg" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                <circle cx="50" cy="50" r="42" fill="none"
                                    stroke={predStats.accuracy >= 60 ? COLORS.bullish : predStats.accuracy >= 40 ? COLORS.neutral : COLORS.bearish}
                                    strokeWidth="8" strokeLinecap="round"
                                    strokeDasharray={`${predStats.accuracy * 2.64} 264`}
                                    style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                                <span className="text-3xl font-black mono text-white tracking-tighter drop-shadow-md">
                                    {predStats.accuracy}%
                                </span>
                            </div>
                        </div>
                        <p className="text-[11px] font-mono mt-6 text-[var(--accent)] font-bold uppercase tracking-widest">
                            {predStats.correct} Validated
                        </p>
                    </div>
                )}

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 bg-[var(--bg-elevated)] border-b border-[var(--border)] flex justify-between items-center">
                        <h2 className="text-[12px] font-bold uppercase tracking-widest text-white flex items-center gap-2 font-mono">
                            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Log: Historical Operations
                        </h2>
                    </div>

                    {predictions.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center py-16 bg-[var(--bg-base)]">
                            <p className="text-[12px] font-mono font-bold uppercase tracking-widest text-[var(--text-muted)]">No Target Operations Logged</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto bg-[var(--bg-card)]">
                            <table className="w-full">
                                <thead className="bg-[#06090F]">
                                    <tr className="text-left text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                                        <th className="py-4 px-6 whitespace-nowrap">Asset ID</th>
                                        <th className="py-4 px-6 whitespace-nowrap">Identified Setup</th>
                                        <th className="py-4 px-6 whitespace-nowrap">System Conviction</th>
                                        <th className="py-4 px-6 whitespace-nowrap hidden sm:table-cell">Init Date</th>
                                        <th className="py-4 px-6 whitespace-nowrap text-right">Settlement</th>
                                    </tr>
                                </thead>
                                <tbody className="table-zebra font-mono">
                                    {predictions.map((p) => (
                                        <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-surface)] transition-colors">
                                            <td className="py-3 px-6">
                                                <span className="font-bold text-[14px] text-white">
                                                    {p.symbol}
                                                </span>
                                            </td>
                                            <td className="py-3 px-6">
                                                <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-widest border ${p.direction === 'bullish' ? 'bg-[var(--bullish-bg)] text-[var(--bullish)] border-[var(--bullish-border)]' : p.direction === 'bearish' ? 'bg-[var(--bearish-bg)] text-[var(--bearish)] border-[var(--bearish-border)]' : 'bg-[var(--neutral-bg)] text-[var(--neutral)] border-[var(--neutral-border)]'}`}>
                                                    {p.direction}
                                                </span>
                                            </td>
                                            <td className="py-3 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-16 h-1.5 bg-[var(--bg-base)] rounded-full overflow-hidden border border-[var(--border)] shadow-inner">
                                                        <div className="h-full rounded-full"
                                                            style={{
                                                                width: `${p.confidence}%`,
                                                                background: p.confidence > 70 ? COLORS.bullish : p.confidence > 40 ? COLORS.neutral : COLORS.bearish
                                                            }} />
                                                    </div>
                                                    <span className="text-[12px] font-bold text-[var(--text-secondary)]">
                                                        {p.confidence}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-6 hidden sm:table-cell text-[11px] text-[var(--text-muted)]">
                                                {formatDate(p.created_date)}
                                            </td>
                                            <td className="py-3 px-6 text-right">
                                                {p.actual_outcome ? (
                                                    <span className={`text-[12px] font-bold ${p.actual_outcome === p.direction ? 'text-[var(--bullish)] drop-shadow-[0_0_8px_var(--bullish)]' : 'text-[var(--bearish)] drop-shadow-[0_0_8px_var(--bearish)]'}`}>
                                                        {p.actual_outcome === p.direction ? 'CONFIRMED' : 'REJECTED'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[12px] text-[var(--text-muted)] italic">
                                                        Resolving...
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value, sub, glowColor, icon }) {
    return (
        <div className="card px-6 py-5 bg-gradient-to-tr from-[var(--bg-elevated)] to-[var(--bg-card)] border border-[var(--border)] relative overflow-hidden group">
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-[30px] opacity-20 pointer-events-none transition-opacity duration-500 group-hover:opacity-40" style={{ background: glowColor }} />

            <div className="flex justify-between items-start mb-4 relative z-10">
                <p className="text-[10px] uppercase font-mono tracking-widest font-bold text-[var(--text-muted)]">{label}</p>
                <div className="w-6 h-6 rounded bg-[var(--bg-base)] border border-[var(--border)] flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[var(--text-secondary)]" style={{ color: glowColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
                    </svg>
                </div>
            </div>
            <div className="relative z-10">
                <p className="text-3xl font-black font-mono text-white mb-1 tracking-tight" style={{ color: glowColor }}>{value}</p>
                {sub && <p className="text-[11px] font-medium text-[var(--text-secondary)]">{sub}</p>}
            </div>
        </div>
    );
}

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--border)] p-3 rounded-lg shadow-2xl">
            <p className="text-[10px] uppercase font-mono tracking-widest font-bold text-[var(--text-muted)] mb-1 border-b border-[var(--border)] pb-1">
                {payload[0]?.name || label}
            </p>
            <p className="mono font-black text-white text-[16px]">{payload[0]?.value}</p>
        </div>
    );
}

function EmptyChart() {
    return (
        <div className="flex-1 flex items-center justify-center py-12 bg-[var(--bg-base)]">
            <p className="text-[10px] font-mono tracking-widest uppercase font-bold text-[var(--text-muted)] flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--border)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Insufficient Metrics
            </p>
        </div>
    );
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    } catch { return dateStr; }
}
