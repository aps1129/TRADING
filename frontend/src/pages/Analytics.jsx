import { useState, useEffect } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown, Target, RefreshCw,
    CheckCircle, XCircle, Clock, Minus, AlertTriangle, Award
} from 'lucide-react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid
} from 'recharts';
import { getAnalytics, getPredictions } from '../api';

const COLORS = {
    bullish: '#10b981',
    bearish: '#ef4444',
    neutral: '#f59e0b',
    pending: '#64748b',
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
            <div className="space-y-6">
                <div className="skeleton h-10 w-48" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
                </div>
                <div className="skeleton h-64 rounded-2xl" />
            </div>
        );
    }

    const predStats = analytics?.predictions || {};
    const patterns = analytics?.patterns || {};
    const sentiment = analytics?.news_sentiment || {};

    // Data for charts
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
        <div className="space-y-6 animate-fade-in-up">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
                    <p className="text-slate-500 text-sm mt-1">Track prediction accuracy & pattern performance</p>
                </div>
                <button onClick={loadData} className="btn btn-secondary text-xs">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* ─── Prediction Stats ────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
                <StatCard
                    label="Total Predictions"
                    value={predStats.total_predictions || 0}
                    icon={Target}
                    color="blue"
                />
                <StatCard
                    label="Accuracy"
                    value={`${predStats.accuracy || 0}%`}
                    icon={Award}
                    color={predStats.accuracy >= 60 ? 'green' : predStats.accuracy >= 40 ? 'amber' : 'red'}
                    sub={`${predStats.correct || 0} / ${predStats.resolved || 0} correct`}
                />
                <StatCard
                    label="Resolved"
                    value={predStats.resolved || 0}
                    icon={CheckCircle}
                    color="green"
                />
                <StatCard
                    label="Pending"
                    value={predStats.pending || 0}
                    icon={Clock}
                    color="amber"
                />
            </div>

            {/* ─── Charts Row ──────────────────────────────────────── */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* News Sentiment Distribution */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 size={14} className="text-blue-400" />
                        News Sentiment
                    </h3>
                    {sentimentData.length > 0 ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={sentimentData} dataKey="value" nameKey="name"
                                        cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                                        paddingAngle={4} stroke="none">
                                        {sentimentData.map((entry) => (
                                            <Cell key={entry.name} fill={COLORS[entry.name] || '#64748b'} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyChart />
                    )}
                    <div className="flex justify-center gap-4 mt-3">
                        {sentimentData.map(d => (
                            <div key={d.name} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[d.name] }} />
                                <span className="text-xs text-slate-400 capitalize">{d.name}</span>
                                <span className="text-xs text-slate-600 font-mono">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Prediction Distribution */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <Target size={14} className="text-purple-400" />
                        Prediction Distribution
                    </h3>
                    {directionData.some(d => d.value > 0) ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={directionData.filter(d => d.value > 0)} dataKey="value" nameKey="name"
                                        cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                                        paddingAngle={4} stroke="none">
                                        {directionData.filter(d => d.value > 0).map((entry) => (
                                            <Cell key={entry.name} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyChart />
                    )}
                    <div className="flex justify-center gap-4 mt-3">
                        {directionData.map(d => (
                            <div key={d.name} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                                <span className="text-xs text-slate-400">{d.name}</span>
                                <span className="text-xs text-slate-600 font-mono">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pattern Distribution */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp size={14} className="text-cyan-400" />
                        Top Patterns
                    </h3>
                    {patternData.length > 0 ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={patternData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <YAxis type="category" dataKey="name" width={100}
                                        tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyChart />
                    )}
                </div>
            </div>

            {/* ─── Prediction History ──────────────────────────────── */}
            <div className="glass-card p-5 sm:p-6">
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-amber-400" />
                    Prediction History
                </h2>

                {predictions.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                            <Target size={28} className="text-slate-600" />
                        </div>
                        <p className="text-sm text-slate-500">
                            No predictions yet. Analyze a stock to generate AI predictions.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                                    <th className="pb-3 pl-2">Stock</th>
                                    <th className="pb-3">Direction</th>
                                    <th className="pb-3">Confidence</th>
                                    <th className="pb-3 hidden sm:table-cell">Date</th>
                                    <th className="pb-3">Outcome</th>
                                </tr>
                            </thead>
                            <tbody>
                                {predictions.map((p) => (
                                    <tr key={p.id}
                                        className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 pl-2">
                                            <span className="font-semibold text-sm">{p.symbol}</span>
                                        </td>
                                        <td className="py-3">
                                            <span className={`badge text-[10px]
                        ${p.direction === 'bullish' ? 'badge-bullish'
                                                    : p.direction === 'bearish' ? 'badge-bearish'
                                                        : 'badge-neutral'}`}>
                                                {p.direction === 'bullish' ? <TrendingUp size={10} /> :
                                                    p.direction === 'bearish' ? <TrendingDown size={10} /> :
                                                        <Minus size={10} />}
                                                {p.direction}
                                            </span>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full"
                                                        style={{
                                                            width: `${p.confidence}%`,
                                                            background: p.confidence > 70 ? '#10b981'
                                                                : p.confidence > 40 ? '#fbbf24' : '#ef4444'
                                                        }} />
                                                </div>
                                                <span className="text-xs font-mono text-slate-400">{p.confidence}%</span>
                                            </div>
                                        </td>
                                        <td className="py-3 hidden sm:table-cell text-xs text-slate-500">
                                            {formatDate(p.created_date)}
                                        </td>
                                        <td className="py-3">
                                            {p.actual_outcome ? (
                                                <span className={`inline-flex items-center gap-1 text-xs font-medium
                          ${p.actual_outcome === p.direction ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {p.actual_outcome === p.direction
                                                        ? <CheckCircle size={12} />
                                                        : <XCircle size={12} />}
                                                    {p.actual_outcome === p.direction ? 'Correct' : 'Wrong'}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-600 flex items-center gap-1">
                                                    <Clock size={11} /> Pending
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

            {/* ─── Accuracy Meter ──────────────────────────────────── */}
            {predStats.resolved > 0 && (
                <div className="glass-card p-6 text-center">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Overall Accuracy</p>
                    <div className="relative w-40 h-40 mx-auto">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none"
                                stroke="rgba(148,163,184,0.08)" strokeWidth="8" />
                            <circle cx="50" cy="50" r="42" fill="none"
                                stroke={predStats.accuracy >= 60 ? '#10b981' : predStats.accuracy >= 40 ? '#fbbf24' : '#ef4444'}
                                strokeWidth="8" strokeLinecap="round"
                                strokeDasharray={`${predStats.accuracy * 2.64} 264`}
                                className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold font-mono">{predStats.accuracy}%</span>
                            <span className="text-xs text-slate-500">accuracy</span>
                        </div>
                    </div>
                    <p className="text-sm text-slate-400 mt-4">
                        {predStats.correct} correct out of {predStats.resolved} resolved predictions
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub }) {
    const colorMap = {
        blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
        green: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
        amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
        red: 'from-red-500/10 to-red-500/5 border-red-500/20 text-red-400',
    };
    const [bg, ...rest] = colorMap[color].split(' ');
    const textColor = rest.pop();

    return (
        <div className={`rounded-2xl border bg-gradient-to-br p-4 sm:p-5 ${colorMap[color]}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1.5">{value}</p>
                    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
                </div>
                <Icon size={20} className={textColor} />
            </div>
        </div>
    );
}

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip">
            <p className="text-xs text-slate-400 capitalize">{payload[0]?.name || label}</p>
            <p className="text-sm font-mono font-bold">{payload[0]?.value}</p>
        </div>
    );
}

function EmptyChart() {
    return (
        <div className="h-[200px] flex items-center justify-center">
            <p className="text-xs text-slate-600">No data yet</p>
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
