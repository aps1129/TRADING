import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, TrendingUp, TrendingDown, Zap, Brain, RefreshCw,
    ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, ChevronDown, ChevronUp,
    Target, Shield, BarChart3, Activity
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Line, ComposedChart, ReferenceLine
} from 'recharts';
import { analyzeStock, getPrediction, explainPattern, addToWatchlist } from '../api';

export default function StockDetail() {
    const { symbol } = useParams();
    const navigate = useNavigate();
    const [analysis, setAnalysis] = useState(null);
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [predLoading, setPredLoading] = useState(false);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState('6mo');
    const [expandedPattern, setExpandedPattern] = useState(null);
    const [patternExplanations, setPatternExplanations] = useState({});
    const [explainLoading, setExplainLoading] = useState('');

    useEffect(() => {
        loadAnalysis();
    }, [symbol, period]);

    const loadAnalysis = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await analyzeStock(symbol, period);
            setAnalysis(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || `Failed to load data for ${symbol}`);
        } finally {
            setLoading(false);
        }
    };

    const loadPrediction = async () => {
        try {
            setPredLoading(true);
            const res = await getPrediction(symbol);
            setPrediction(res.data);
        } catch (err) {
            setPrediction({ error: err.response?.data?.detail || 'Prediction failed' });
        } finally {
            setPredLoading(false);
        }
    };

    const loadPatternExplanation = async (patternType) => {
        if (patternExplanations[patternType]) {
            setExpandedPattern(expandedPattern === patternType ? null : patternType);
            return;
        }
        try {
            setExplainLoading(patternType);
            setExpandedPattern(patternType);
            const res = await explainPattern(symbol, patternType);
            setPatternExplanations(prev => ({ ...prev, [patternType]: res.data.explanation }));
        } catch {
            setPatternExplanations(prev => ({ ...prev, [patternType]: 'Explanation unavailable.' }));
        } finally {
            setExplainLoading('');
        }
    };

    const handleAddToWatchlist = async () => {
        try {
            await addToWatchlist(symbol, analysis?.stock?.name || symbol);
            alert(`${symbol} added to watchlist!`);
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to add');
        }
    };

    if (loading) return <StockSkeleton />;
    if (error) return (
        <div className="text-center py-20 animate-fade-in">
            <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} className="text-red-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Stock Not Found</h2>
            <p className="text-sm text-slate-500 mb-4">{error}</p>
            <button onClick={() => navigate('/')} className="btn btn-primary">
                <ArrowLeft size={16} /> Go Back
            </button>
        </div>
    );

    const { stock, indicators, patterns } = analysis || {};
    const chartData = stock?.history?.map(d => ({
        ...d,
        sma50: indicators?.sma_50?.[stock.history.indexOf(d)] ?? null,
        sma200: indicators?.sma_200?.[stock.history.indexOf(d)] ?? null,
        bbUpper: indicators?.bb_upper?.[stock.history.indexOf(d)] ?? null,
        bbLower: indicators?.bb_lower?.[stock.history.indexOf(d)] ?? null,
    })) || [];

    // Keep only recent data for clean chart
    const chartSlice = chartData.slice(-90);

    const isUp = stock?.change >= 0;
    const periods = ['1mo', '3mo', '6mo', '1y', '2y'];

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <button onClick={() => navigate('/')}
                        className="text-xs text-slate-500 hover:text-white flex items-center gap-1 mb-2 transition-colors">
                        <ArrowLeft size={14} />
                        Back to Dashboard
                    </button>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl sm:text-3xl font-bold">{stock?.symbol}</h1>
                        <span className="text-sm text-slate-500">{stock?.name}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                        <span className="text-3xl sm:text-4xl font-bold font-mono">
                            ₹{stock?.current_price?.toLocaleString('en-IN')}
                        </span>
                        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold
              ${isUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                            {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                            {isUp ? '+' : ''}{stock?.change?.toFixed(2)} ({isUp ? '+' : ''}{stock?.change_percent?.toFixed(2)}%)
                        </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        {stock?.sector !== 'N/A' && <span>{stock?.sector}</span>}
                        {stock?.pe_ratio > 0 && <span>PE: {stock?.pe_ratio?.toFixed(1)}</span>}
                        {stock?.market_cap > 0 && <span>MCap: ₹{formatMarketCap(stock.market_cap)}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleAddToWatchlist} className="btn btn-secondary text-xs">
                        + Watchlist
                    </button>
                    <button onClick={loadAnalysis} className="btn btn-ghost text-xs">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* ─── Period Selector ─────────────────────────────────── */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] w-fit border border-white/[0.05]">
                {periods.map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${period === p ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-white'}`}>
                        {p.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* ─── Price Chart ─────────────────────────────────────── */}
            <div className="glass-card p-4 sm:p-6">
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-blue-400" />
                    Price Chart
                    <span className="text-xs text-slate-600 font-normal ml-2">
                        SMA 50 (yellow) • SMA 200 (cyan) • Bollinger Bands (purple)
                    </span>
                </h2>
                <div className="h-[350px] sm:h-[420px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartSlice}>
                            <defs>
                                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }}
                                tickFormatter={(d) => d.slice(5)}
                                interval="preserveStartEnd" />
                            <YAxis domain={['auto', 'auto']}
                                tick={{ fontSize: 10, fill: '#64748b' }}
                                tickFormatter={(v) => `₹${v}`}
                                width={60} />
                            <Tooltip content={<ChartTooltip />} />

                            {/* Bollinger Bands */}
                            <Area type="monotone" dataKey="bbUpper" stroke="rgba(139,92,246,0.3)"
                                fill="none" strokeWidth={1} dot={false} />
                            <Area type="monotone" dataKey="bbLower" stroke="rgba(139,92,246,0.3)"
                                fill="none" strokeWidth={1} dot={false} />

                            {/* Moving Averages */}
                            <Line type="monotone" dataKey="sma50" stroke="#fbbf24"
                                strokeWidth={1.5} dot={false} connectNulls />
                            <Line type="monotone" dataKey="sma200" stroke="#06b6d4"
                                strokeWidth={1.5} dot={false} connectNulls />

                            {/* Price */}
                            <Area type="monotone" dataKey="close" stroke="#3b82f6"
                                fill="url(#priceGrad)" strokeWidth={2} dot={false} />

                            {/* Support & Resistance */}
                            {indicators?.support && (
                                <ReferenceLine y={indicators.support} stroke="#10b981"
                                    strokeDasharray="5 5" opacity={0.5} />
                            )}
                            {indicators?.resistance && (
                                <ReferenceLine y={indicators.resistance} stroke="#ef4444"
                                    strokeDasharray="5 5" opacity={0.5} />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ─── Indicators + Patterns ───────────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Technical Indicators */}
                <div className="glass-card p-5 sm:p-6">
                    <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 size={16} className="text-cyan-400" />
                        Technical Indicators
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <IndicatorCard label="RSI (14)" value={indicators?.current_rsi?.toFixed(1)}
                            status={indicators?.current_rsi > 70 ? 'danger' : indicators?.current_rsi < 30 ? 'success' : 'neutral'} />
                        <IndicatorCard label="MACD" value={indicators?.current_macd?.toFixed(2)}
                            status={indicators?.current_macd > 0 ? 'success' : 'danger'} />
                        <IndicatorCard label="SMA 50" value={`₹${indicators?.current_sma_50?.toFixed(0) || '—'}`}
                            status={stock?.current_price > (indicators?.current_sma_50 || 0) ? 'success' : 'danger'} />
                        <IndicatorCard label="SMA 200" value={`₹${indicators?.current_sma_200?.toFixed(0) || '—'}`}
                            status={stock?.current_price > (indicators?.current_sma_200 || 0) ? 'success' : 'danger'} />
                        <IndicatorCard label="Support" value={`₹${indicators?.support?.toLocaleString('en-IN') || '—'}`}
                            status="success" />
                        <IndicatorCard label="Resistance" value={`₹${indicators?.resistance?.toLocaleString('en-IN') || '—'}`}
                            status="danger" />
                    </div>

                    {/* RSI Gauge */}
                    {indicators?.current_rsi && (
                        <div className="mt-5 p-3 rounded-xl bg-white/[0.02]">
                            <div className="flex justify-between text-xs text-slate-500 mb-2">
                                <span>Oversold (30)</span>
                                <span className="font-medium text-white">RSI: {indicators.current_rsi.toFixed(1)}</span>
                                <span>Overbought (70)</span>
                            </div>
                            <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${indicators.current_rsi}%`,
                                        background: indicators.current_rsi > 70 ? 'linear-gradient(90deg, #fbbf24, #ef4444)'
                                            : indicators.current_rsi < 30 ? 'linear-gradient(90deg, #10b981, #06b6d4)'
                                                : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Detected Patterns */}
                <div className="glass-card p-5 sm:p-6">
                    <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                        <Zap size={16} className="text-purple-400" />
                        Detected Patterns
                        <span className="text-xs text-slate-600 font-normal ml-auto">
                            {patterns?.length || 0} found
                        </span>
                    </h2>
                    {(!patterns || patterns.length === 0) ? (
                        <p className="text-sm text-slate-500 text-center py-8">
                            No significant patterns detected for this period.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {patterns.map((p, i) => (
                                <div key={i} className="rounded-xl bg-white/[0.02] overflow-hidden">
                                    <button
                                        onClick={() => loadPatternExplanation(p.type)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors text-left">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                        ${p.signal === 'bullish' ? 'bg-emerald-500/15' : p.signal === 'bearish' ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                                                {p.signal === 'bullish' ? <TrendingUp size={14} className="text-emerald-400" /> :
                                                    p.signal === 'bearish' ? <TrendingDown size={14} className="text-red-400" /> :
                                                        <Minus size={14} className="text-amber-400" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{p.type}</p>
                                                <p className="text-xs text-slate-500">{p.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`badge text-[10px]
                        ${p.signal === 'bullish' ? 'badge-bullish' : p.signal === 'bearish' ? 'badge-bearish' : 'badge-neutral'}`}>
                                                {p.signal}
                                            </span>
                                            {expandedPattern === p.type ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                                        </div>
                                    </button>
                                    {expandedPattern === p.type && (
                                        <div className="px-3 pb-3 animate-fade-in">
                                            <div className="p-3 rounded-lg bg-white/[0.03] text-sm text-slate-300 leading-relaxed">
                                                {explainLoading === p.type ? (
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <RefreshCw size={14} className="animate-spin" />
                                                        <span className="text-xs">Getting AI explanation...</span>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="flex items-center gap-1.5 mb-2 text-xs text-blue-400">
                                                            <Brain size={12} />
                                                            AI Explanation
                                                        </div>
                                                        {patternExplanations[p.type] || 'Click to get AI explanation'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── AI Prediction Card ──────────────────────────────── */}
            <div className="glass-card p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                        <Brain size={16} className="text-purple-400" />
                        AI Prediction
                    </h2>
                    <button onClick={loadPrediction}
                        className="btn btn-primary text-xs"
                        disabled={predLoading}>
                        {predLoading ? (
                            <><RefreshCw size={14} className="animate-spin" /> Analyzing...</>
                        ) : (
                            <><Zap size={14} /> Generate Prediction</>
                        )}
                    </button>
                </div>

                {!prediction && !predLoading && (
                    <div className="text-center py-10">
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4 animate-float">
                            <Brain size={28} className="text-purple-400" />
                        </div>
                        <p className="text-sm text-slate-500 mb-1">
                            Click "Generate Prediction" to get AI-powered analysis
                        </p>
                        <p className="text-xs text-slate-600">
                            Combines technical patterns, indicators, and news sentiment
                        </p>
                    </div>
                )}

                {prediction && !prediction.error && (
                    <div className="animate-fade-in-up space-y-5">
                        {/* Direction + Confidence */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-lg
                ${prediction.direction === 'bullish' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                    : prediction.direction === 'bearish' ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'}`}>
                                {prediction.direction === 'bullish' ? <TrendingUp size={22} /> :
                                    prediction.direction === 'bearish' ? <TrendingDown size={22} /> :
                                        <Minus size={22} />}
                                {prediction.direction?.toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Confidence</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${prediction.confidence}%`,
                                                background: prediction.confidence > 70 ? '#10b981'
                                                    : prediction.confidence > 40 ? '#fbbf24' : '#ef4444',
                                            }} />
                                    </div>
                                    <span className="text-sm font-mono font-bold">{prediction.confidence}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Reasoning */}
                        <div className="p-4 rounded-xl bg-white/[0.02]">
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Analysis</p>
                            <p className="text-sm text-slate-300 leading-relaxed">{prediction.reasoning}</p>
                            {prediction.short_term_outlook && (
                                <p className="text-sm text-slate-400 mt-2 italic">
                                    📊 {prediction.short_term_outlook}
                                </p>
                            )}
                        </div>

                        {/* Key Levels */}
                        {prediction.key_levels && Object.keys(prediction.key_levels).length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {prediction.key_levels.support && (
                                    <LevelCard label="Support" value={prediction.key_levels.support} color="green" icon={Shield} />
                                )}
                                {prediction.key_levels.resistance && (
                                    <LevelCard label="Resistance" value={prediction.key_levels.resistance} color="red" icon={Target} />
                                )}
                                {prediction.key_levels.stop_loss && (
                                    <LevelCard label="Stop Loss" value={prediction.key_levels.stop_loss} color="amber" icon={AlertTriangle} />
                                )}
                                {prediction.key_levels.target && (
                                    <LevelCard label="Target" value={prediction.key_levels.target} color="blue" icon={TrendingUp} />
                                )}
                            </div>
                        )}

                        {/* Risk Factors */}
                        {prediction.risk_factors?.length > 0 && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Risk Factors</p>
                                <div className="space-y-1.5">
                                    {prediction.risk_factors.map((r, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                                            <AlertTriangle size={12} className="text-amber-500 mt-1 shrink-0" />
                                            <span>{r}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Disclaimer */}
                        <p className="text-xs text-slate-600 p-3 rounded-lg bg-white/[0.01] border border-white/[0.03]">
                            ⚠️ {prediction.disclaimer || 'AI-generated analysis for educational purposes only. Not financial advice.'}
                        </p>
                    </div>
                )}

                {prediction?.error && (
                    <div className="text-center py-6 text-red-400 text-sm">
                        {prediction.error}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
        <div className="chart-tooltip">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className="text-sm font-mono font-bold">₹{d?.close?.toLocaleString('en-IN')}</p>
            <div className="flex gap-3 mt-1 text-xs text-slate-500">
                <span>O: ₹{d?.open?.toFixed(0)}</span>
                <span>H: ₹{d?.high?.toFixed(0)}</span>
                <span>L: ₹{d?.low?.toFixed(0)}</span>
            </div>
            {d?.sma50 && <p className="text-xs text-amber-400 mt-1">SMA50: ₹{d.sma50.toFixed(0)}</p>}
        </div>
    );
}

function IndicatorCard({ label, value, status }) {
    const statusColors = {
        success: 'border-emerald-500/20 bg-emerald-500/5',
        danger: 'border-red-500/20 bg-red-500/5',
        neutral: 'border-slate-500/20 bg-white/[0.02]',
    };
    return (
        <div className={`p-3 rounded-xl border ${statusColors[status]}`}>
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-sm font-mono font-semibold">{value || '—'}</p>
        </div>
    );
}

function LevelCard({ label, value, color, icon: Icon }) {
    const colors = {
        green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        red: 'bg-red-500/10 text-red-400 border-red-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };
    return (
        <div className={`p-3 rounded-xl border ${colors[color]}`}>
            <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} />
                <span className="text-xs uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-sm font-mono font-bold">₹{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p>
        </div>
    );
}

function formatMarketCap(mc) {
    if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`;
    if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`;
    if (mc >= 1e7) return `${(mc / 10000000).toFixed(0)}Cr`;
    return mc.toLocaleString();
}

function StockSkeleton() {
    return (
        <div className="space-y-6">
            <div className="skeleton h-8 w-48" />
            <div className="skeleton h-12 w-64" />
            <div className="skeleton h-[400px] rounded-2xl" />
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="skeleton h-64 rounded-2xl" />
                <div className="skeleton h-64 rounded-2xl" />
            </div>
        </div>
    );
}
