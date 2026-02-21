import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
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
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in mt-10">
            <div className="w-16 h-16 bg-[var(--bg-elevated)] text-[var(--text-muted)] rounded-full flex items-center justify-center mb-6 border border-[var(--border)]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Terminal Error</h2>
            <p className="text-[14px] font-mono text-[var(--text-secondary)] mb-6 tracking-widest uppercase">{error}</p>
            <button onClick={() => navigate('/')} className="btn btn-secondary border border-[var(--border)]">
                &larr; Return to Dashboard
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
        <div className="space-y-6 animate-up">
            {/* ─── Header Header Widget ──────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 py-6 border-b border-[var(--border)] mb-6 bg-gradient-to-r from-[var(--bg-elevated)] to-transparent rounded-2xl px-6 border">
                <div>
                    <button onClick={() => navigate('/')} className="text-[12px] flex items-center gap-1 mb-4 text-[var(--accent)] hover:text-white transition-colors font-mono tracking-widest uppercase">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Dashboard
                    </button>
                    <div className="flex items-center gap-4 flex-wrap">
                        <h1 className="text-4xl font-black mono text-white tracking-tighter drop-shadow-md">{stock?.symbol}</h1>
                        <span className="badge badge-ai shadow-none bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border)]">{stock?.name}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                        <span className="text-3xl font-bold mono text-white">
                            ₹{stock?.current_price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className={`px-3 py-1.5 rounded flex items-center gap-2 border font-mono font-bold text-[14px] shadow-lg ${isUp ? 'bg-[var(--bullish-bg)] border-[var(--bullish-border)] text-[var(--bullish)]' : 'bg-[var(--bearish-bg)] border-[var(--bearish-border)] text-[var(--bearish)]'}`}>
                            {isUp ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>}
                            {isUp ? '+' : ''}{stock?.change?.toFixed(2)} ({isUp ? '+' : ''}{stock?.change_percent?.toFixed(2)}%)
                        </div>
                    </div>
                    <div className="flex gap-4 mt-4 font-mono text-[12px] text-[var(--text-secondary)] bg-[var(--bg-base)] px-4 py-2 rounded-lg border border-[var(--border)] shadow-inner w-fit">
                        {stock?.sector && stock.sector !== 'N/A' && <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> {stock.sector}</span>}
                        {stock?.pe_ratio > 0 && <span>PE: <b className="text-white">{stock.pe_ratio.toFixed(2)}</b></span>}
                        {stock?.market_cap > 0 && <span>MCAP: <b className="text-white">₹{formatMarketCap(stock.market_cap)}</b></span>}
                    </div>
                </div>
                <div className="flex flex-row lg:flex-col gap-3 self-stretch lg:self-center justify-center">
                    <button onClick={handleAddToWatchlist} className="btn btn-primary font-mono text-[12px] tracking-widest uppercase">
                        + Watchlist
                    </button>
                    <button onClick={loadAnalysis} className="btn btn-secondary font-mono text-[12px] tracking-widest uppercase">
                        Refresh Sync
                    </button>
                </div>
            </div>

            {/* ─── Price Chart Widget ─────────────────────────────────────── */}
            <div className="card shadow-2xl relative overflow-visible border-t-2 border-t-[var(--accent)]">
                {/* Chart Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-[var(--bg-elevated)] border-b border-[var(--border)] z-10 relative">
                    <h2 className="text-[13px] font-bold uppercase tracking-widest text-white flex items-center gap-3">
                        <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                        Technical Chart
                    </h2>

                    {/* Period Selector inside chart header */}
                    <div className="flex bg-[var(--bg-base)] p-1 rounded-lg border border-[var(--border)] shadow-inner mt-4 sm:mt-0">
                        {periods.map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-4 py-1.5 rounded-md text-[11px] font-bold font-mono transition-all ${period === p ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-surface)]'}`}>
                                {p.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chart Legends */}
                <div className="px-6 py-2 flex gap-4 text-[10px] font-mono font-bold tracking-widest text-[var(--text-muted)] border-b border-[var(--border)] bg-[#0A0E17]">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-0.5 bg-[#F59E0B]" /> SMA 50</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-0.5 bg-[#06B6D4]" /> SMA 200</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.05)]" /> Bollinger Bands</span>
                </div>

                <div className="p-4 bg-[var(--bg-base)]" style={{ height: '420px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartSlice} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'Roboto Mono' }}
                                tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickFormatter={(d) => d.slice(5)}
                                interval="preserveStartEnd" dy={10} />
                            <YAxis domain={['auto', 'auto']}
                                tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'Roboto Mono' }}
                                tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickFormatter={(v) => `₹${v.toLocaleString()}`}
                                width={80} dx={-10} />
                            <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />

                            {/* Bollinger Bands */}
                            <Area type="monotone" dataKey="bbUpper" stroke="rgba(255,255,255,0.1)" fill="rgba(255,255,255,0.02)" strokeWidth={1} dot={false} />
                            <Area type="monotone" dataKey="bbLower" stroke="rgba(255,255,255,0.1)" fill="none" strokeWidth={1} dot={false} />

                            {/* Moving Averages */}
                            <Line type="monotone" dataKey="sma50" stroke="#F59E0B" strokeWidth={2} dot={false} connectNulls opacity={0.8} />
                            <Line type="monotone" dataKey="sma200" stroke="#06B6D4" strokeWidth={2} dot={false} connectNulls opacity={0.8} />

                            {/* Price Area */}
                            <Area type="monotone" dataKey="close"
                                stroke={isUp ? '#00E676' : '#FF1744'}
                                fill={isUp ? 'url(#colorBull)' : 'url(#colorBear)'}
                                strokeWidth={2} dot={false} />

                            <defs>
                                <linearGradient id="colorBull" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00E676" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorBear" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#FF1744" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#FF1744" stopOpacity={0} />
                                </linearGradient>
                            </defs>

                            {/* Support & Resistance */}
                            {indicators?.support && (
                                <ReferenceLine y={indicators.support} stroke="#00E676" strokeDasharray="3 3" opacity={0.5} strokeWidth={1.5} label={{ position: 'left', value: 'SUP', fill: '#00E676', fontSize: 10, fontFamily: 'monospace' }} />
                            )}
                            {indicators?.resistance && (
                                <ReferenceLine y={indicators.resistance} stroke="#FF1744" strokeDasharray="3 3" opacity={0.5} strokeWidth={1.5} label={{ position: 'left', value: 'RES', fill: '#FF1744', fontSize: 10, fontFamily: 'monospace' }} />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ─── Grid Dashboard ───────────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-6">

                {/* Panel 1: AI Prediction Card */}
                <div className="card shadow-xl border border-[var(--border)] overflow-hidden flex flex-col relative">
                    <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-[var(--ai-purple)] to-transparent" />
                    <div className="bg-[#0A0E17] px-6 py-4 flex items-center justify-between border-b border-[var(--border)]">
                        <h2 className="text-[12px] font-bold uppercase tracking-widest text-white flex items-center gap-2">
                            <svg className="w-4 h-4 text-[var(--ai-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            AI Neural Prediction
                        </h2>
                        <button onClick={loadPrediction}
                            className="btn btn-ai px-4 py-1.5 text-[11px] font-mono tracking-widest shadow-[0_0_15px_var(--ai-purple-bg)]"
                            disabled={predLoading}>
                            {predLoading ? 'PROCESSING...' : 'INITIALIZE AI'}
                        </button>
                    </div>

                    {!prediction && !predLoading && (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[var(--bg-base)]">
                            <svg className="w-12 h-12 text-[var(--border)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            <p className="text-[12px] font-mono text-[var(--text-white)] uppercase tracking-widest mb-1">Awaiting Execution Command</p>
                            <p className="text-[11px] font-sans text-[var(--text-muted)]">Cross-references technicals, sentiment, & patterns via Gemini 2.0</p>
                        </div>
                    )}

                    {prediction && !prediction.error && (
                        <div className="p-6 space-y-6 flex-1 bg-[var(--bg-card)]">
                            {/* Direction + Confidence Header */}
                            <div className="flex items-end gap-6 bg-[var(--bg-elevated)] p-5 rounded-xl border border-[var(--border)] relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--ai-purple)] opacity-[0.03] rounded-full blur-2xl pointer-events-none" />
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-mono mb-2">Signal Vector</p>
                                    <span className={`text-2xl font-black font-mono px-4 py-1 rounded inline-block ${prediction.direction === 'bullish' ? 'bg-[var(--bullish-bg)] text-[var(--bullish)] border border-[var(--bullish-border)]' : prediction.direction === 'bearish' ? 'bg-[var(--bearish-bg)] text-[var(--bearish)] border border-[var(--bearish-border)]' : 'bg-[var(--neutral-bg)] text-[var(--neutral)] border border-[var(--neutral-border)]'}`}>
                                        {prediction.direction?.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-mono mb-2">Model Confidence Score</p>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-3 bg-[var(--bg-base)] rounded-full overflow-hidden border border-[var(--border)] shadow-inner">
                                            <div className="h-full rounded-full transition-all duration-1000 relative"
                                                style={{
                                                    width: `${prediction.confidence}%`,
                                                    background: prediction.confidence > 70 ? 'var(--bullish)' : prediction.confidence > 40 ? 'var(--neutral)' : 'var(--bearish)',
                                                    boxShadow: 'inset 0 0 10px rgba(255,255,255,0.2)'
                                                }}>
                                                <div className="absolute inset-0 bg-white opacity-20 w-full animate-pulse" />
                                            </div>
                                        </div>
                                        <span className="mono text-[16px] font-bold text-white">
                                            {prediction.confidence}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Gemini Analysis Context */}
                            <div className="pl-4 border-l-2 border-[var(--ai-purple)] relative">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ai-purple)] mb-2 font-mono flex items-center gap-2">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9V5h2v4h4v2h-4v4H9v-4H5V9h4z" /></svg>
                                    Gemini Synthesis Context
                                </p>
                                <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">
                                    {prediction.reasoning}
                                </p>
                                {prediction.short_term_outlook && (
                                    <p className="text-[12px] mt-3 font-semibold text-[var(--text-white)] bg-[var(--ai-purple-bg)] p-3 rounded-md border border-[var(--ai-purple-border)] inline-block">
                                        Horizon: {prediction.short_term_outlook}
                                    </p>
                                )}
                            </div>

                            {/* Generated Support/Resistance Levels */}
                            {prediction.key_levels && Object.keys(prediction.key_levels).length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 font-mono">Critical Levels</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {prediction.key_levels.support && <LevelWidget label="Support (Local)" value={prediction.key_levels.support} type="bullish" />}
                                        {prediction.key_levels.resistance && <LevelWidget label="Resistance (Local)" value={prediction.key_levels.resistance} type="bearish" />}
                                        {prediction.key_levels.target && <LevelWidget label="AI Target Price" value={prediction.key_levels.target} type="accent" />}
                                        {prediction.key_levels.stop_loss && <LevelWidget label="Suggested Stop" value={prediction.key_levels.stop_loss} type="neutral" />}
                                    </div>
                                </div>
                            )}

                            {/* Risk Board */}
                            {prediction.risk_factors?.length > 0 && (
                                <div className="bg-[#0A0E17] p-4 rounded-xl border border-[var(--border)]">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--bearish)] mb-3 font-mono">Risk Vectors</p>
                                    <ul className="space-y-2">
                                        {prediction.risk_factors.map((r, i) => (
                                            <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--text-secondary)]">
                                                <span className="text-[var(--bearish)] mt-0.5 opacity-80 mt-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></span>
                                                <span>{r}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <p className="text-[10px] text-center font-mono text-[var(--text-muted)] opacity-50 uppercase tracking-widest">
                                {prediction.disclaimer || 'AI-generated analysis. Not financial advice. Validate execution.'}
                            </p>
                        </div>
                    )}

                    {prediction?.error && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--bearish-bg)] text-center">
                            <p className="text-[12px] font-mono text-[var(--bearish)] uppercase tracking-widest">{prediction.error}</p>
                        </div>
                    )}
                </div>

                {/* Right Column: Indicators + Patterns */}
                <div className="flex flex-col gap-6">

                    {/* Technical Telemetry Grid */}
                    <div className="card shadow-xl border border-[var(--border)] overflow-hidden">
                        <div className="bg-[#0A0E17] px-6 py-4 border-b border-[var(--border)]">
                            <h2 className="text-[12px] font-bold uppercase tracking-widest text-white flex items-center gap-2">
                                <svg className="w-4 h-4 text-[var(--neutral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h3a2 2 0 002-2zm0 0V9a2 2 0 012-2h3a2 2 0 012 2v10m-6 0a2 2 0 002 2h3a2 2 0 002-2m0 0V5a2 2 0 012-2h3a2 2 0 012 2v14a2 2 0 01-2 2h-3a2 2 0 01-2-2z" /></svg>
                                Technical Telemetry
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)]">
                            <IndicatorCell label="RSI (14)" value={indicators?.current_rsi?.toFixed(1)} signal={indicators?.current_rsi > 70 ? 'bearish' : indicators?.current_rsi < 30 ? 'bullish' : 'neutral'} />
                            <IndicatorCell label="MACD" value={indicators?.current_macd?.toFixed(2)} signal={indicators?.current_macd > 0 ? 'bullish' : 'bearish'} />
                            <IndicatorCell label="SMA 50" value={`₹${indicators?.current_sma_50?.toFixed(0) || '—'}`} signal={stock?.current_price > (indicators?.current_sma_50 || 0) ? 'bullish' : 'bearish'} />
                            <IndicatorCell label="SMA 200" value={`₹${indicators?.current_sma_200?.toFixed(0) || '—'}`} signal={stock?.current_price > (indicators?.current_sma_200 || 0) ? 'bullish' : 'bearish'} />
                        </div>

                        {/* Interactive RSI Scale */}
                        {indicators?.current_rsi && (
                            <div className="px-6 py-5 bg-[var(--bg-base)]">
                                <div className="flex justify-between text-[10px] font-bold font-mono mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    <span>Strong Buy (30)</span>
                                    <span className="text-white">RSI Heat</span>
                                    <span>Strong Sell (70)</span>
                                </div>
                                <div className="h-2 w-full bg-gradient-to-r from-[var(--bullish)] via-[var(--neutral)] to-[var(--bearish)] rounded-full relative shadow-inner">
                                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] border-2 border-[var(--bg-card)] transition-all duration-1000"
                                        style={{ left: `calc(${Math.min(100, Math.max(0, indicators.current_rsi))}% - 8px)` }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Detected Signatures / Patterns */}
                    <div className="card shadow-xl border border-[var(--border)] overflow-hidden flex-1 flex flex-col">
                        <div className="bg-[#0A0E17] px-6 py-4 flex items-center justify-between border-b border-[var(--border)]">
                            <h2 className="text-[12px] font-bold uppercase tracking-widest text-white flex items-center gap-2">
                                <svg className="w-4 h-4 text-[#06B6D4]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                                Pattern Signatures
                            </h2>
                            <span className="badge border-[var(--border)] bg-[var(--bg-base)]">
                                {patterns?.length || 0} MATCHES
                            </span>
                        </div>

                        {(!patterns || patterns.length === 0) ? (
                            <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg-base)]">
                                <p className="text-[12px] font-mono text-[var(--text-muted)] uppercase tracking-widest text-center">No Signatures Detected</p>
                            </div>
                        ) : (
                            <div className="flex-1 bg-[var(--bg-base)] divide-y divide-[rgba(255,255,255,0.02)]">
                                {patterns.map((p, i) => (
                                    <div key={i} className="bg-[var(--bg-card)]">
                                        <button
                                            onClick={() => loadPatternExplanation(p.type)}
                                            className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer hover:bg-[var(--bg-surface)] transition-colors group">
                                            <div className="flex items-center gap-4 border-l-2 pl-3" style={{ borderColor: p.signal === 'bullish' ? 'var(--bullish)' : p.signal === 'bearish' ? 'var(--bearish)' : 'var(--neutral)' }}>
                                                <div>
                                                    <p className="text-[13px] font-bold text-white group-hover:text-[var(--accent)] transition-colors">{p.type}</p>
                                                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 font-mono">{p.description}</p>
                                                </div>
                                            </div>
                                            <div className="w-6 h-6 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">
                                                {expandedPattern === p.type ? '-' : '+'}
                                            </div>
                                        </button>

                                        {/* Dropdown AI context */}
                                        {expandedPattern === p.type && (
                                            <div className="px-6 pb-5 pt-1 animate-in bg-[var(--bg-elevated)] border-b border-[var(--border)] shadow-inner">
                                                <div className="border-l-2 border-[var(--ai-purple)] pl-4">
                                                    <p className="text-[10px] font-bold uppercase font-mono tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--ai-purple)' }}>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--ai-purple)] animate-pulse" />
                                                        Context Engine
                                                    </p>
                                                    <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">
                                                        {explainLoading === p.type ? <span className="text-[var(--text-muted)] animate-pulse font-mono tracking-widest uppercase">Executing query...</span>
                                                            : patternExplanations[p.type] || 'Analysis unavailable.'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
        <div className="chart-tooltip bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--border)] !p-4 !rounded-xl !shadow-2xl">
            <p className="text-[10px] uppercase font-mono tracking-widest mb-2 text-[var(--text-muted)] border-b border-[var(--border)] pb-1">{label}</p>
            <p className="mono text-[18px] font-black text-white mb-2">₹{d?.close?.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</p>
            <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] mono text-[var(--text-secondary)]">
                <span className="bg-[rgba(255,255,255,0.05)] px-2 py-1 rounded">O: {d?.open?.toFixed(0)}</span>
                <span className="bg-[rgba(255,255,255,0.05)] px-2 py-1 rounded text-green-400">H: {d?.high?.toFixed(0)}</span>
                <span className="bg-[rgba(255,255,255,0.05)] px-2 py-1 rounded text-red-400">L: {d?.low?.toFixed(0)}</span>
            </div>
            {d?.volume && (
                <div className="mt-3 pt-2 border-t border-[var(--border)] flex justify-between items-center text-[10px] mono">
                    <span className="text-[var(--text-muted)] uppercase tracking-widest">Volume Axis</span>
                    <span className="font-bold text-white">{(d.volume / 100000).toFixed(2)}L</span>
                </div>
            )}
        </div>
    );
}

function IndicatorCell({ label, value, signal }) {
    const signalColor = signal === 'bullish' ? 'var(--bullish)' : signal === 'bearish' ? 'var(--bearish)' : 'var(--text-primary)';
    return (
        <div className="px-6 py-5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] transition-colors group">
            <p className="text-[10px] uppercase tracking-widest font-mono font-bold text-[var(--text-muted)] group-hover:text-white transition-colors">{label}</p>
            <div className="flex items-center justify-between mt-2">
                <p className="mono text-xl font-bold text-white">{value || '—'}</p>
                {signal && signal !== 'neutral' && <span className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: signalColor, color: signalColor }} />}
            </div>
        </div>
    );
}

function LevelWidget({ label, value, type }) {
    const colors = {
        bullish: 'var(--bullish)',
        bearish: 'var(--bearish)',
        neutral: 'var(--text-secondary)',
        accent: 'var(--accent)',
    };
    return (
        <div className="px-4 py-3 bg-[var(--bg-base)] rounded-lg border border-[var(--border)] shadow-inner">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-mono font-bold">{label}</p>
            <p className="mono text-[14px] font-bold mt-1" style={{ color: colors[type] }}>
                ₹{typeof value === 'number' ? value.toLocaleString('en-IN') : value}
            </p>
        </div>
    );
}

function formatMarketCap(mc) {
    if (mc >= 1e12) return `${(mc / 1e12).toFixed(2)}T`;
    if (mc >= 1e9) return `${(mc / 1e9).toFixed(2)}B`;
    if (mc >= 1e7) return `${(mc / 10000000).toFixed(1)}Cr`;
    return mc.toLocaleString();
}

function StockSkeleton() {
    return (
        <div className="space-y-6 pt-6 w-full animate-in">
            <div className="skeleton h-24 rounded-2xl w-full" />
            <div className="skeleton h-[500px] rounded-2xl w-full" />
            <div className="grid lg:grid-cols-2 gap-6 w-full">
                <div className="skeleton h-[400px] rounded-2xl" />
                <div className="skeleton h-[400px] rounded-2xl" />
            </div>
        </div>
    );
}
