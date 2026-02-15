import { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid
} from 'recharts';
import { getAnalytics, getPredictions } from '../api';

const COLORS = {
    bullish: '#26A69A',
    bearish: '#EF5350',
    neutral: '#F59E0B',
    pending: '#4A4E5A',
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
            <div className="space-y-4 pt-4">
                <div className="skeleton h-8 w-40" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-20 rounded-lg" />)}
                </div>
                <div className="skeleton h-56 rounded-lg" />
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
        .slice(0, 10);

    const directionData = [
        { name: 'Bullish', value: predStats.by_direction?.bullish || 0, fill: COLORS.bullish },
        { name: 'Bearish', value: predStats.by_direction?.bearish || 0, fill: COLORS.bearish },
        { name: 'Neutral', value: predStats.by_direction?.neutral || 0, fill: COLORS.neutral },
    ];

    return (
        <div className="space-y-4 animate-up">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between py-2">
                <div>
                    <h1 className="text-base font-semibold" style={{ color: 'var(--text-white)' }}>Analytics</h1>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Track prediction accuracy and pattern performance
                    </p>
                </div>
                <button onClick={loadData} className="btn btn-secondary">
                    Refresh
                </button>
            </div>

            {/* ─── Prediction Stats ────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Predictions" value={predStats.total_predictions || 0} />
                <StatCard label="Accuracy"
                    value={`${predStats.accuracy || 0}%`}
                    sub={`${predStats.correct || 0} / ${predStats.resolved || 0} correct`}
                    highlight={predStats.accuracy >= 60 ? 'bullish' : predStats.accuracy >= 40 ? 'neutral' : 'bearish'} />
                <StatCard label="Resolved" value={predStats.resolved || 0} />
                <StatCard label="Pending" value={predStats.pending || 0} />
            </div>

            {/* ─── Charts Row ──────────────────────────────────────── */}
            <div className="grid lg:grid-cols-3 gap-3">
                {/* News Sentiment */}
                <div className="card">
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <h3 className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}>
                            News Sentiment
                        </h3>
                    </div>
                    {sentimentData.length > 0 ? (
                        <div className="p-4">
                            <div style={{ height: '180px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={sentimentData} dataKey="value" nameKey="name"
                                            cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                            paddingAngle={3} stroke="none">
                                            {sentimentData.map((entry) => (
                                                <Cell key={entry.name} fill={COLORS[entry.name] || '#4A4E5A'} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-4 mt-2">
                                {sentimentData.map(d => (
                                    <div key={d.name} className="flex items-center gap-1.5">
                                        <span className="inline-block w-2 h-2 rounded-full"
                                            style={{ background: COLORS[d.name] }} />
                                        <span className="text-[11px] capitalize" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                                        <span className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyChart />
                    )}
                </div>

                {/* Prediction Distribution */}
                <div className="card">
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <h3 className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}>
                            Prediction Distribution
                        </h3>
                    </div>
                    {directionData.some(d => d.value > 0) ? (
                        <div className="p-4">
                            <div style={{ height: '180px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={directionData.filter(d => d.value > 0)} dataKey="value" nameKey="name"
                                            cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                            paddingAngle={3} stroke="none">
                                            {directionData.filter(d => d.value > 0).map((entry) => (
                                                <Cell key={entry.name} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-4 mt-2">
                                {directionData.map(d => (
                                    <div key={d.name} className="flex items-center gap-1.5">
                                        <span className="inline-block w-2 h-2 rounded-full"
                                            style={{ background: d.fill }} />
                                        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                                        <span className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyChart />
                    )}
                </div>

                {/* Pattern Distribution */}
                <div className="card">
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <h3 className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}>
                            Top Patterns
                        </h3>
                    </div>
                    {patternData.length > 0 ? (
                        <div className="p-4">
                            <div style={{ height: '180px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={patternData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,123,134,0.08)" />
                                        <XAxis type="number" tick={{ fontSize: 10, fill: '#4A4E5A', fontFamily: 'Roboto Mono' }} />
                                        <YAxis type="category" dataKey="name" width={100}
                                            tick={{ fontSize: 9, fill: '#787B86' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="value" fill="#2962FF" radius={[0, 3, 3, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <EmptyChart />
                    )}
                </div>
            </div>

            {/* ─── Prediction History ──────────────────────────────── */}
            <div className="card">
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h2 className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}>
                        Prediction History
                    </h2>
                </div>

                {predictions.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            No predictions yet. Analyze a stock to generate AI predictions.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[10px] uppercase tracking-wider"
                                    style={{ color: 'var(--text-muted)' }}>
                                    <th className="pb-2 pt-3 pl-4 font-medium">Stock</th>
                                    <th className="pb-2 pt-3 font-medium">Direction</th>
                                    <th className="pb-2 pt-3 font-medium">Confidence</th>
                                    <th className="pb-2 pt-3 hidden sm:table-cell font-medium">Date</th>
                                    <th className="pb-2 pt-3 pr-4 font-medium">Outcome</th>
                                </tr>
                            </thead>
                            <tbody className="table-zebra">
                                {predictions.map((p) => (
                                    <tr key={p.id}
                                        style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="py-2.5 pl-4">
                                            <span className="mono font-semibold text-xs" style={{ color: 'var(--text-white)' }}>
                                                {p.symbol}
                                            </span>
                                        </td>
                                        <td className="py-2.5">
                                            <span className={`badge text-[11px] capitalize ${p.direction === 'bullish' ? 'badge-bullish'
                                                    : p.direction === 'bearish' ? 'badge-bearish'
                                                        : 'badge-neutral'}`}>
                                                {p.direction}
                                            </span>
                                        </td>
                                        <td className="py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="confidence-bar" style={{ width: '48px' }}>
                                                    <div className="confidence-bar-fill"
                                                        style={{
                                                            width: `${p.confidence}%`,
                                                            background: p.confidence > 70 ? 'var(--bullish)'
                                                                : p.confidence > 40 ? 'var(--neutral)' : 'var(--bearish)'
                                                        }} />
                                                </div>
                                                <span className="mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                                    {p.confidence}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 hidden sm:table-cell text-[11px] mono"
                                            style={{ color: 'var(--text-muted)' }}>
                                            {formatDate(p.created_date)}
                                        </td>
                                        <td className="py-2.5 pr-4">
                                            {p.actual_outcome ? (
                                                <span className="text-[11px] font-medium"
                                                    style={{ color: p.actual_outcome === p.direction ? 'var(--bullish)' : 'var(--bearish)' }}>
                                                    {p.actual_outcome === p.direction ? 'Correct' : 'Wrong'}
                                                </span>
                                            ) : (
                                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                    Pending
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

            {/* ─── Accuracy Ring ──────────────────────────────────── */}
            {predStats.resolved > 0 && (
                <div className="card p-6 text-center">
                    <p className="text-[11px] uppercase tracking-wider mb-3"
                        style={{ color: 'var(--text-muted)' }}>Overall Accuracy</p>
                    <div className="relative" style={{ width: '120px', height: '120px', margin: '0 auto' }}>
                        <svg className="w-full h-full" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="50" cy="50" r="42" fill="none"
                                stroke="var(--bg-surface)" strokeWidth="6" />
                            <circle cx="50" cy="50" r="42" fill="none"
                                stroke={predStats.accuracy >= 60 ? '#26A69A' : predStats.accuracy >= 40 ? '#F59E0B' : '#EF5350'}
                                strokeWidth="6" strokeLinecap="round"
                                strokeDasharray={`${predStats.accuracy * 2.64} 264`}
                                style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-bold mono" style={{ color: 'var(--text-white)' }}>
                                {predStats.accuracy}%
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>accuracy</span>
                        </div>
                    </div>
                    <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
                        {predStats.correct} correct out of {predStats.resolved} resolved
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value, sub, highlight }) {
    const highlightColor = highlight === 'bullish' ? 'var(--bullish)'
        : highlight === 'bearish' ? 'var(--bearish)'
            : highlight === 'neutral' ? 'var(--neutral)'
                : 'var(--text-white)';
    return (
        <div className="card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider font-medium"
                style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-lg font-bold mono mt-1" style={{ color: highlightColor }}>{value}</p>
            {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
        </div>
    );
}

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip">
            <p className="text-[11px] capitalize" style={{ color: 'var(--text-secondary)' }}>
                {payload[0]?.name || label}
            </p>
            <p className="mono text-xs font-bold" style={{ color: 'var(--text-white)' }}>{payload[0]?.value}</p>
        </div>
    );
}

function EmptyChart() {
    return (
        <div className="flex items-center justify-center py-12">
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No data yet</p>
        </div>
    );
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: '2-digit'
        });
    } catch { return dateStr; }
}
