import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Line, ComposedChart, ReferenceLine
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
        <div className="text-center py-16 animate-in">
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-white)' }}>Stock Not Found</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{error}</p>
            <button onClick={() => navigate('/')} className="btn btn-primary">
                Back to Dashboard
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

    const chartSlice = chartData.slice(-90);
    const isUp = stock?.change >= 0;
    const periods = ['1mo', '3mo', '6mo', '1y', '2y'];

    return (
        <div className="space-y-4 animate-up">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-3 py-2">
                <div>
                    <button onClick={() => navigate('/')}
                        className="text-[11px] flex items-center gap-1 mb-1.5"
                        style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                        &larr; Dashboard
                    </button>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-lg font-bold mono" style={{ color: 'var(--text-white)' }}>{stock?.symbol}</h1>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{stock?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-2xl font-bold mono" style={{ color: 'var(--text-white)' }}>
                            ₹{stock?.current_price?.toLocaleString('en-IN')}
                        </span>
                        <span className={`badge text-xs ${isUp ? 'badge-bullish' : 'badge-bearish'}`}>
                            {isUp ? '+' : ''}{stock?.change?.toFixed(2)} ({isUp ? '+' : ''}{stock?.change_percent?.toFixed(2)}%)
                        </span>
                    </div>
                    <div className="flex gap-3 mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {stock?.sector !== 'N/A' && <span>{stock?.sector}</span>}
                        {stock?.pe_ratio > 0 && <span>PE: {stock?.pe_ratio?.toFixed(1)}</span>}
                        {stock?.market_cap > 0 && <span>MCap: ₹{formatMarketCap(stock.market_cap)}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleAddToWatchlist} className="btn btn-secondary">
                        + Watchlist
                    </button>
                    <button onClick={loadAnalysis} className="btn btn-ghost">
                        Refresh
                    </button>
                </div>
            </div>

            {/* ─── Period Selector ─────────────────────────────────── */}
            <div className="flex gap-0.5 p-0.5 rounded w-fit"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {periods.map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                        className="px-3 py-1 rounded text-[11px] font-medium"
                        style={{
                            background: period === p ? 'var(--accent-bg)' : 'transparent',
                            color: period === p ? 'var(--accent)' : 'var(--text-secondary)',
                            transition: 'all 0.1s',
                            cursor: 'pointer',
                            border: 'none',
                        }}>
                        {p.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* ─── Price Chart ─────────────────────────────────────── */}
            <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}>
                        Price Chart
                    </h2>
                    <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>SMA 50</span>
                        <span>SMA 200</span>
                        <span>BB</span>
                    </div>
                </div>
                <div style={{ height: '360px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartSlice}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,123,134,0.08)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4A4E5A', fontFamily: 'Roboto Mono' }}
                                tickFormatter={(d) => d.slice(5)}
                                interval="preserveStartEnd" />
                            <YAxis domain={['auto', 'auto']}
                                tick={{ fontSize: 10, fill: '#4A4E5A', fontFamily: 'Roboto Mono' }}
                                tickFormatter={(v) => `₹${v}`}
                                width={60} />
                            <Tooltip content={<ChartTooltip />} />

                            {/* Bollinger Bands */}
                            <Area type="monotone" dataKey="bbUpper" stroke="rgba(120,123,134,0.2)"
                                fill="none" strokeWidth={1} dot={false} />
                            <Area type="monotone" dataKey="bbLower" stroke="rgba(120,123,134,0.2)"
                                fill="none" strokeWidth={1} dot={false} />

                            {/* Moving Averages */}
                            <Line type="monotone" dataKey="sma50" stroke="#F59E0B"
                                strokeWidth={1} dot={false} connectNulls opacity={0.6} />
                            <Line type="monotone" dataKey="sma200" stroke="#06B6D4"
                                strokeWidth={1} dot={false} connectNulls opacity={0.6} />

                            {/* Price */}
                            <Area type="monotone" dataKey="close" stroke={isUp ? '#26A69A' : '#EF5350'}
                                fill={isUp ? 'rgba(38,166,154,0.08)' : 'rgba(239,83,80,0.08)'}
                                strokeWidth={1.5} dot={false} />

                            {/* Support & Resistance */}
                            {indicators?.support && (
                                <ReferenceLine y={indicators.support} stroke="#26A69A"
                                    strokeDasharray="4 4" opacity={0.4} />
                            )}
                            {indicators?.resistance && (
                                <ReferenceLine y={indicators.resistance} stroke="#EF5350"
                                    strokeDasharray="4 4" opacity={0.4} />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ─── Indicators + Patterns ───────────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-3">
                {/* Technical Indicators */}
                <div className="card">
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <h2 className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}>
                            Technical Indicators
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-px p-px" style={{ background: 'var(--border)' }}>
                        <IndicatorCell label="RSI (14)" value={indicators?.current_rsi?.toFixed(1)}
                            signal={indicators?.current_rsi > 70 ? 'bearish' : indicators?.current_rsi < 30 ? 'bullish' : 'neutral'} />
                        <IndicatorCell label="MACD" value={indicators?.current_macd?.toFixed(2)}
                            signal={indicators?.current_macd > 0 ? 'bullish' : 'bearish'} />
                        <IndicatorCell label="SMA 50" value={`₹${indicators?.current_sma_50?.toFixed(0) || '—'}`}
                            signal={stock?.current_price > (indicators?.current_sma_50 || 0) ? 'bullish' : 'bearish'} />
                        <IndicatorCell label="SMA 200" value={`₹${indicators?.current_sma_200?.toFixed(0) || '—'}`}
                            signal={stock?.current_price > (indicators?.current_sma_200 || 0) ? 'bullish' : 'bearish'} />
                        <IndicatorCell label="Support" value={`₹${indicators?.support?.toLocaleString('en-IN') || '—'}`} signal="bullish" />
                        <IndicatorCell label="Resistance" value={`₹${indicators?.resistance?.toLocaleString('en-IN') || '—'}`} signal="bearish" />
                    </div>

                    {/* RSI Bar */}
                    {indicators?.current_rsi && (
                        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                <span>Oversold (30)</span>
                                <span className="mono" style={{ color: 'var(--text-primary)' }}>RSI: {indicators.current_rsi.toFixed(1)}</span>
                                <span>Overbought (70)</span>
                            </div>
                            <div className="confidence-bar">
                                <div className="confidence-bar-fill"
                                    style={{
                                        width: `${indicators.current_rsi}%`,
                                        background: indicators.current_rsi > 70 ? 'var(--bearish)'
                                            : indicators.current_rsi < 30 ? 'var(--bullish)'
                                                : 'var(--accent)',
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Detected Patterns */}
                <div className="card">
                    <div className="px-4 py-3 flex items-center justify-between"
                        style={{ borderBottom: '1px solid var(--border)' }}>
                        <h2 className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}>
                            Detected Patterns
                        </h2>
                        <span className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {patterns?.length || 0} found
                        </span>
                    </div>
                    {(!patterns || patterns.length === 0) ? (
                        <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                            No significant patterns detected for this period.
                        </p>
                    ) : (
                        <div>
                            {patterns.map((p, i) => (
                                <div key={i} style={i > 0 ? { borderTop: '1px solid var(--border)' } : {}}>
                                    <button
                                        onClick={() => loadPatternExplanation(p.type)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 text-left cursor-pointer"
                                        style={{ background: 'transparent', border: 'none', transition: 'background 0.1s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                        <div className="flex items-center gap-3">
                                            <span className={`badge text-[11px] ${p.signal === 'bullish' ? 'badge-bullish' : p.signal === 'bearish' ? 'badge-bearish' : 'badge-neutral'}`}>
                                                {p.signal}
                                            </span>
                                            <div>
                                                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.type}</p>
                                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{p.description}</p>
                                            </div>
                                        </div>
                                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                            {expandedPattern === p.type ? '-' : '+'}
                                        </span>
                                    </button>
                                    {expandedPattern === p.type && (
                                        <div className="px-4 pb-3 animate-in">
                                            <div className="ai-border text-xs leading-relaxed"
                                                style={{ color: 'var(--text-secondary)' }}>
                                                <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--ai-purple)' }}>
                                                    AI Analysis
                                                </p>
                                                {explainLoading === p.type ? (
                                                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                        Generating explanation...
                                                    </span>
                                                ) : (
                                                    patternExplanations[p.type] || 'Click to get AI explanation'
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
            <div className="card">
                <div className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <h2 className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--ai-purple)' }}>
                        AI Prediction
                    </h2>
                    <button onClick={loadPrediction}
                        className="btn btn-ai"
                        disabled={predLoading}>
                        {predLoading ? 'Analyzing...' : 'Generate Prediction'}
                    </button>
                </div>

                {!prediction && !predLoading && (
                    <div className="text-center py-10 px-4">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                            Click "Generate Prediction" to get AI-powered analysis
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Combines technical patterns, indicators, and news sentiment
                        </p>
                    </div>
                )}

                {prediction && !prediction.error && (
                    <div className="p-4 space-y-4 animate-up">
                        {/* Direction + Confidence */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className={`badge text-sm font-bold px-4 py-1.5 ${prediction.direction === 'bullish' ? 'badge-bullish'
                                : prediction.direction === 'bearish' ? 'badge-bearish'
                                    : 'badge-neutral'}`}>
                                {prediction.direction?.toUpperCase()}
                            </span>
                            <div>
                                <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Confidence</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="confidence-bar" style={{ width: '80px' }}>
                                        <div className="confidence-bar-fill"
                                            style={{
                                                width: `${prediction.confidence}%`,
                                                background: prediction.confidence > 70 ? 'var(--bullish)'
                                                    : prediction.confidence > 40 ? 'var(--neutral)' : 'var(--bearish)',
                                            }} />
                                    </div>
                                    <span className="mono text-xs font-bold" style={{ color: 'var(--text-white)' }}>
                                        {prediction.confidence}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Reasoning */}
                        <div className="ai-border">
                            <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--ai-purple)' }}>
                                AI Analysis
                            </p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {prediction.reasoning}
                            </p>
                            {prediction.short_term_outlook && (
                                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                                    Short-term: {prediction.short_term_outlook}
                                </p>
                            )}
                        </div>

                        {/* Key Levels */}
                        {prediction.key_levels && Object.keys(prediction.key_levels).length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded overflow-hidden"
                                style={{ background: 'var(--border)' }}>
                                {prediction.key_levels.support && (
                                    <LevelCell label="Support" value={prediction.key_levels.support} type="bullish" />
                                )}
                                {prediction.key_levels.resistance && (
                                    <LevelCell label="Resistance" value={prediction.key_levels.resistance} type="bearish" />
                                )}
                                {prediction.key_levels.stop_loss && (
                                    <LevelCell label="Stop Loss" value={prediction.key_levels.stop_loss} type="neutral" />
                                )}
                                {prediction.key_levels.target && (
                                    <LevelCell label="Target" value={prediction.key_levels.target} type="accent" />
                                )}
                            </div>
                        )}

                        {/* Risk Factors */}
                        {prediction.risk_factors?.length > 0 && (
                            <div>
                                <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    Risk Factors
                                </p>
                                <div className="space-y-1">
                                    {prediction.risk_factors.map((r, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            <span style={{ color: 'var(--neutral)' }}>*</span>
                                            <span>{r}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Disclaimer */}
                        <p className="text-[11px] p-3 rounded" style={{
                            color: 'var(--text-muted)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                        }}>
                            {prediction.disclaimer || 'AI-generated analysis for educational purposes only. Not financial advice.'}
                        </p>
                    </div>
                )}

                {prediction?.error && (
                    <div className="text-center py-6 text-xs" style={{ color: 'var(--bearish)' }}>
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
            <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="mono text-xs font-bold" style={{ color: 'var(--text-white)' }}>₹{d?.close?.toLocaleString('en-IN')}</p>
            <div className="flex gap-3 mt-1 text-[10px] mono" style={{ color: 'var(--text-secondary)' }}>
                <span>O: ₹{d?.open?.toFixed(0)}</span>
                <span>H: ₹{d?.high?.toFixed(0)}</span>
                <span>L: ₹{d?.low?.toFixed(0)}</span>
            </div>
            {d?.volume && (
                <p className="text-[10px] mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Vol: {(d.volume / 100000).toFixed(1)}L
                </p>
            )}
        </div>
    );
}

function IndicatorCell({ label, value, signal }) {
    const signalColor = signal === 'bullish' ? 'var(--bullish)' : signal === 'bearish' ? 'var(--bearish)' : 'var(--text-secondary)';
    return (
        <div className="px-4 py-3" style={{ background: 'var(--bg-card)' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="mono text-xs font-semibold mt-0.5" style={{ color: signalColor }}>{value || '—'}</p>
        </div>
    );
}

function LevelCell({ label, value, type }) {
    const colors = {
        bullish: 'var(--bullish)',
        bearish: 'var(--bearish)',
        neutral: 'var(--neutral)',
        accent: 'var(--accent)',
    };
    return (
        <div className="px-4 py-3" style={{ background: 'var(--bg-card)' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="mono text-xs font-bold mt-0.5" style={{ color: colors[type] }}>
                ₹{typeof value === 'number' ? value.toLocaleString('en-IN') : value}
            </p>
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
        <div className="space-y-4 pt-4">
            <div className="skeleton h-6 w-40" />
            <div className="skeleton h-10 w-56" />
            <div className="skeleton h-[360px] rounded-lg" />
            <div className="grid lg:grid-cols-2 gap-3">
                <div className="skeleton h-52 rounded-lg" />
                <div className="skeleton h-52 rounded-lg" />
            </div>
        </div>
    );
}
