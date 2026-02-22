import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { analyzeStock, getPrediction, explainPattern, addToWatchlist, getIntraday } from '../api';

// ═══════════════════════════════════════════════════════════════════════
// TradingView Lightweight Charts — proper OHLC candlestick rendering
// ═══════════════════════════════════════════════════════════════════════

function TradingViewChart({ data, chartMode, indicators, stock, patterns, activePatternDate }) {
    const containerRef = useRef(null);
    const chartRef = useRef(null);
    const candleSeriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);
    const sma50Ref = useRef(null);
    const sma200Ref = useRef(null);
    const timeMapRef = useRef(new Map());

    useEffect(() => {
        if (!containerRef.current || !data || data.length === 0) return;

        // Destroy previous chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            layout: {
                background: { color: '#030508' },
                textColor: '#64748B',
                fontFamily: "'Roboto Mono', monospace",
                fontSize: 10,
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.03)' },
                horzLines: { color: 'rgba(255,255,255,0.04)' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 3, labelBackgroundColor: '#1a1f2e' },
                horzLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 3, labelBackgroundColor: '#1a1f2e' },
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.08)',
                scaleMargins: { top: 0.1, bottom: 0.2 },
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.08)',
                timeVisible: chartMode === 'intraday',
                secondsVisible: false,
                rightOffset: 5,
                barSpacing: data.length > 300 ? 3 : data.length > 100 ? 5 : 8,
            },
            localization: {
                priceFormatter: (p) => '₹' + p.toFixed(2),
            },
        });

        chartRef.current = chart;

        // ─── Candlestick series ──────────────────────────────────────
        const candleSeries = chart.addCandlestickSeries({
            upColor: '#00E676',
            downColor: '#FF1744',
            borderUpColor: '#00E676',
            borderDownColor: '#FF1744',
            wickUpColor: '#00E67699',
            wickDownColor: '#FF174499',
        });

        // Convert data to lightweight-charts format
        const ohlcData = data.map((d, i) => {
            let time;
            if (chartMode === 'intraday' && d.time) {
                const dt = new Date(d.time.replace(' ', 'T') + '+05:30');
                time = Math.floor(dt.getTime() / 1000);
            } else if (d.date) {
                time = d.date.substring(0, 10);
            } else {
                time = i;
            }
            timeMapRef.current.set(d.time || d.date, time);
            return { time, open: d.open, high: d.high, low: d.low, close: d.close };
        });

        candleSeries.setData(ohlcData);
        candleSeriesRef.current = candleSeries;

        // ─── Volume histogram ────────────────────────────────────────
        const volumeSeries = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
            drawTicks: false,
        });

        const volData = data.map((d, i) => ({
            time: ohlcData[i].time,
            value: d.volume || 0,
            color: d.close >= d.open ? 'rgba(0,230,118,0.15)' : 'rgba(255,23,68,0.15)',
        }));

        volumeSeries.setData(volData);
        volumeSeriesRef.current = volumeSeries;

        // ─── SMA lines (historical mode) ─────────────────────────────
        if (chartMode === 'historical') {
            // SMA 50
            const sma50Data = data
                .map((d, i) => d.sma50 != null ? { time: ohlcData[i].time, value: d.sma50 } : null)
                .filter(Boolean);

            if (sma50Data.length > 0) {
                const sma50 = chart.addLineSeries({
                    color: '#F59E0B',
                    lineWidth: 2,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
                sma50.setData(sma50Data);
                sma50Ref.current = sma50;
            }

            // SMA 200
            const sma200Data = data
                .map((d, i) => d.sma200 != null ? { time: ohlcData[i].time, value: d.sma200 } : null)
                .filter(Boolean);

            if (sma200Data.length > 0) {
                const sma200 = chart.addLineSeries({
                    color: '#06B6D4',
                    lineWidth: 2,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
                sma200.setData(sma200Data);
                sma200Ref.current = sma200;
            }

            // Support & Resistance price lines
            if (indicators?.support) {
                candleSeries.createPriceLine({
                    price: indicators.support,
                    color: '#00E67666',
                    lineWidth: 1,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: 'SUP',
                });
            }
            if (indicators?.resistance) {
                candleSeries.createPriceLine({
                    price: indicators.resistance,
                    color: '#FF174466',
                    lineWidth: 1,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: 'RES',
                });
            }
        }

        // Fit content
        chart.timeScale().fitContent();

        // ─── Resize handler ──────────────────────────────────────────
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                chart.applyOptions({ width, height });
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
        };
    }, [data, chartMode, indicators]);

    // Update markers independently so we don't recreate the chart
    useEffect(() => {
        if (!candleSeriesRef.current || !patterns || !data) return;

        const markers = [];
        let targetIndex = null;

        for (const p of patterns) {
            const time = timeMapRef.current.get(p.date);
            if (time !== undefined) {
                // Determine if this is the pattern the user just clicked
                const isActive = activePatternDate === p.date && p.type === window.lastClickedPatternType;

                if (isActive) {
                    targetIndex = data.findIndex(d => (d.time || d.date) === p.date);
                }

                markers.push({
                    time: time,
                    position: isActive ? 'aboveBar' : (p.signal === 'bullish' ? 'belowBar' : p.signal === 'bearish' ? 'aboveBar' : 'aboveBar'),
                    color: isActive ? '#FFFFFF' : (p.signal === 'bullish' ? '#00E676' : p.signal === 'bearish' ? '#FF1744' : '#F59E0B'),
                    shape: isActive ? 'arrowDown' : (p.signal === 'bullish' ? 'arrowUp' : p.signal === 'bearish' ? 'arrowDown' : 'square'),
                    text: isActive ? `【  ${p.type.toUpperCase()}  】` : p.type,
                    size: isActive ? 2 : 1
                });
            }
        }

        // Sort markers by time as required by lightweight-charts
        markers.sort((a, b) => {
            if (typeof a.time === 'string' && typeof b.time === 'string') return a.time.localeCompare(b.time);
            return a.time - b.time;
        });

        candleSeriesRef.current.setMarkers(markers);

        // Cinematic smooth pan to center the active pattern
        if (targetIndex !== null && targetIndex !== -1 && chartRef.current) {
            const currentRange = chartRef.current.timeScale().getVisibleLogicalRange();
            if (currentRange) {
                const width = currentRange.to - currentRange.from;
                const newFrom = targetIndex - width / 2;
                const newTo = targetIndex + width / 2;

                let start = null;
                const duration = 700; // ms transition

                const animateScroll = (timestamp) => {
                    if (!start) start = timestamp;
                    const progress = Math.min((timestamp - start) / duration, 1);
                    // easeOutQuart for super smooth deceleration
                    const ease = 1 - Math.pow(1 - progress, 4);

                    const f = currentRange.from + (newFrom - currentRange.from) * ease;
                    const t = currentRange.to + (newTo - currentRange.to) * ease;

                    if (chartRef.current) {
                        chartRef.current.timeScale().setVisibleLogicalRange({ from: f, to: t });
                    }

                    if (progress < 1) {
                        window.requestAnimationFrame(animateScroll);
                    }
                };
                window.requestAnimationFrame(animateScroll);
            }
        }
    }, [patterns, activePatternDate, data]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

export default function StockDetail() {
    const { symbol } = useParams();
    const navigate = useNavigate();
    const [analysis, setAnalysis] = useState(null);
    const [intraday, setIntraday] = useState(null);
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [intradayLoading, setIntradayLoading] = useState(false);
    const [predLoading, setPredLoading] = useState(false);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState('6mo');
    const [interval, setInterval] = useState('5m');
    const [chartMode, setChartMode] = useState('intraday'); // 'intraday' or 'historical'
    const [expandedPattern, setExpandedPattern] = useState(null);
    const [activePatternDate, setActivePatternDate] = useState(null);
    const [patternExplanations, setPatternExplanations] = useState({});
    const [explainLoading, setExplainLoading] = useState('');

    useEffect(() => {
        loadAnalysis();
        loadIntraday();
    }, [symbol]);

    useEffect(() => {
        if (chartMode === 'historical') loadAnalysis();
    }, [period]);

    useEffect(() => {
        if (chartMode === 'intraday') loadIntraday();
    }, [interval]);

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

    const loadIntraday = async () => {
        try {
            setIntradayLoading(true);
            const res = await getIntraday(symbol, interval);
            setIntraday(res.data);
        } catch (err) {
            console.error('Intraday error:', err);
        } finally {
            setIntradayLoading(false);
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

    const loadPatternExplanation = async (p) => {
        const patternType = p.type;
        window.lastClickedPatternType = patternType; // Quick hack for markers
        if (expandedPattern === patternType) {
            setExpandedPattern(null);
            setActivePatternDate(null);
            return;
        }

        setActivePatternDate(p.date); // Highlight on chart
        if (patternExplanations[patternType]) {
            setExpandedPattern(patternType);
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

    const { stock, indicators, patterns } = analysis || {};
    const isUp = stock?.change >= 0;
    const periods = ['1mo', '3mo', '6mo', '1y', '2y'];
    const intervals = ['1m', '5m', '15m', '30m', '1h'];

    // Merge patterns from both analysis and intraday
    const allPatterns = [
        ...(patterns || []),
        ...(intraday?.patterns || []).map(p => ({ ...p, source: 'intraday' }))
    ];

    // Deduplicate patterns by type
    const uniquePatterns = [];
    const seenTypes = new Set();
    for (const p of allPatterns) {
        if (!seenTypes.has(p.type)) {
            seenTypes.add(p.type);
            uniquePatterns.push(p);
        }
    }

    // Prepare candlestick chart data (MUST be before early returns — React hooks rule)
    const candleData = useMemo(() => {
        if (chartMode === 'intraday' && intraday?.candles) {
            return intraday.candles.map(c => ({
                ...c,
                label: c.time.split(' ')[1] || c.time,
                range: c.high - c.low,
                isBull: c.close >= c.open,
            }));
        }
        if (chartMode === 'historical' && stock?.history) {
            return stock.history.slice(-90).map((d, i) => ({
                ...d,
                label: d.date.slice(5),
                range: d.high - d.low,
                isBull: d.close >= d.open,
                sma50: indicators?.sma_50?.[stock.history.length - 90 + i] ?? null,
                sma200: indicators?.sma_200?.[stock.history.length - 90 + i] ?? null,
            }));
        }
        return [];
    }, [chartMode, intraday, stock, indicators]);

    // Pattern markers for chart annotation
    const patternMarkers = useMemo(() => {
        const markers = {};
        for (const p of (chartMode === 'intraday' ? (intraday?.patterns || []) : (patterns || []))) {
            const date = p.date;
            if (!markers[date]) markers[date] = [];
            markers[date].push(p);
        }
        return markers;
    }, [chartMode, intraday, patterns]);

    // Early returns AFTER all hooks
    if (loading && !analysis) return <StockSkeleton />;
    if (error && !analysis) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-up mt-10">
            <div className="w-20 h-20 bg-[var(--bearish-bg)] rounded-2xl flex items-center justify-center mb-6 border-2 border-[var(--bearish-border)]">
                <svg className="w-10 h-10 text-[var(--bearish)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-white mb-3">Terminal Error</h2>
            <p className="text-[13px] font-mono text-[var(--text-secondary)] mb-8 max-w-md text-center">{error}</p>
            <button onClick={() => navigate('/')} className="btn btn-secondary">← Return to Dashboard</button>
        </div>
    );

    return (
        <div className="space-y-6 animate-up">
            {/* ─── Header ──────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-elevated)] via-[var(--bg-card)] to-[var(--bg-base)] p-8 shadow-2xl">
                <div className="absolute top-0 right-0 w-72 h-72 bg-[var(--accent)] rounded-full blur-[120px] opacity-[0.05] pointer-events-none" />
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div>
                        <button onClick={() => navigate('/')} className="text-[11px] flex items-center gap-1.5 mb-4 text-[var(--accent)] hover:text-white transition-colors font-mono tracking-widest uppercase">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            Dashboard
                        </button>
                        <div className="flex items-center gap-4 flex-wrap">
                            <h1 className="text-4xl font-black mono text-white tracking-tighter">{stock?.symbol}</h1>
                            <span className="text-[12px] font-mono px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)]">{stock?.name}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                            <span className="text-3xl font-bold mono text-white">
                                ₹{stock?.current_price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 border font-mono font-bold text-[14px] ${isUp ? 'bg-[var(--bullish-bg)] border-[var(--bullish-border)] text-[var(--bullish)]' : 'bg-[var(--bearish-bg)] border-[var(--bearish-border)] text-[var(--bearish)]'}`}>
                                {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{stock?.change?.toFixed(2)} ({isUp ? '+' : ''}{stock?.change_percent?.toFixed(2)}%)
                            </div>
                        </div>
                        <div className="flex gap-4 mt-3 font-mono text-[11px] text-[var(--text-muted)]">
                            {stock?.sector && stock.sector !== 'N/A' && <span>◆ {stock.sector}</span>}
                            {stock?.pe_ratio > 0 && <span>PE: <b className="text-white">{stock.pe_ratio.toFixed(2)}</b></span>}
                            {stock?.market_cap > 0 && <span>MCAP: <b className="text-white">₹{formatMarketCap(stock.market_cap)}</b></span>}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleAddToWatchlist} className="btn btn-primary font-mono text-[11px] tracking-widest uppercase">+ Watchlist</button>
                        <button onClick={() => { loadAnalysis(); loadIntraday(); }} className="btn btn-secondary font-mono text-[11px] tracking-widest uppercase">⟳ Refresh</button>
                    </div>
                </div>
            </div>

            {/* ─── Candlestick Chart ──────────────────────── */}
            <div className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-2xl bg-[var(--bg-card)]">
                {/* Chart Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-7 py-5 bg-gradient-to-r from-[#060910] to-[var(--bg-elevated)] border-b border-[var(--border)]">
                    <h2 className="text-[13px] font-bold uppercase tracking-widest text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] border border-[var(--accent)] flex items-center justify-center" style={{ borderColor: 'rgba(41,98,255,0.3)', background: 'rgba(41,98,255,0.1)' }}>
                            <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                        </div>
                        {chartMode === 'intraday' ? 'Live Candlestick Chart' : 'Historical Chart'}
                    </h2>

                    <div className="flex items-center gap-3 mt-4 sm:mt-0">
                        {/* Mode Toggle */}
                        <div className="flex bg-[var(--bg-base)] p-1 rounded-lg border border-[var(--border)]">
                            <button onClick={() => setChartMode('intraday')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold font-mono transition-all ${chartMode === 'intraday' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                                INTRADAY
                            </button>
                            <button onClick={() => setChartMode('historical')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold font-mono transition-all ${chartMode === 'historical' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                                HISTORICAL
                            </button>
                        </div>

                        {/* Interval/Period Selector */}
                        <div className="flex bg-[var(--bg-base)] p-1 rounded-lg border border-[var(--border)]">
                            {chartMode === 'intraday' ? intervals.map(i => (
                                <button key={i} onClick={() => setInterval(i)}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold font-mono transition-all ${interval === i ? 'bg-[var(--bullish)] text-black shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                                    {i.toUpperCase()}
                                </button>
                            )) : periods.map(p => (
                                <button key={p} onClick={() => setPeriod(p)}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold font-mono transition-all ${period === p ? 'bg-[var(--bullish)] text-black shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                                    {p.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="px-7 py-2.5 flex flex-wrap gap-5 text-[10px] font-mono font-bold tracking-widest text-[var(--text-muted)] border-b border-[var(--border)] bg-[#050810]">
                    <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#00E676]" /> BULLISH</span>
                    <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#FF1744]" /> BEARISH</span>
                    {chartMode === 'historical' && <>
                        <span className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[#F59E0B]" /> SMA 50</span>
                        <span className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[#06B6D4]" /> SMA 200</span>
                    </>}
                    {uniquePatterns.length > 0 && <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--ai-purple)] opacity-60" /> PATTERN DETECTED</span>}
                </div>

                {/* Chart — TradingView Lightweight Charts */}
                <div className="bg-[#030508]" style={{ height: '480px', position: 'relative' }}>
                    {intradayLoading && chartMode === 'intraday' ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="text-[var(--text-muted)] font-mono text-[12px] uppercase tracking-widest animate-pulse">Loading candlestick data...</div>
                        </div>
                    ) : (
                        <TradingViewChart
                            data={candleData}
                            chartMode={chartMode}
                            indicators={indicators}
                            stock={stock}
                            patterns={allPatterns}
                            activePatternDate={activePatternDate}
                        />
                    )}
                </div>

                {/* Stats Bar */}
                {candleData.length > 0 && (
                    <div className="px-7 py-3 flex flex-wrap gap-6 text-[11px] font-mono text-[var(--text-muted)] border-t border-[var(--border)] bg-[#050810]">
                        <span>CANDLES: <b className="text-white">{candleData.length}</b></span>
                        <span>HIGH: <b className="text-[var(--bullish)]">₹{Math.max(...candleData.map(c => c.high)).toLocaleString('en-IN')}</b></span>
                        <span>LOW: <b className="text-[var(--bearish)]">₹{Math.min(...candleData.map(c => c.low)).toLocaleString('en-IN')}</b></span>
                        <span>VOL: <b className="text-white">{formatVolume(candleData.reduce((s, c) => s + (c.volume || 0), 0))}</b></span>
                        {chartMode === 'intraday' && <span className="ml-auto text-[var(--neutral)]">⚡ ~15 min delayed (yfinance free tier)</span>}
                    </div>
                )}
            </div>

            {/* ─── Pattern Detection & AI Analysis ──────── */}
            <div className="grid lg:grid-cols-2 gap-6">

                {/* Detected Candlestick Patterns */}
                <div className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl bg-[var(--bg-card)] flex flex-col min-h-[400px]">
                    <div className="bg-gradient-to-r from-[#060910] to-[var(--bg-card)] px-7 py-5 flex items-center justify-between border-b border-[var(--border)]">
                        <h2 className="text-[12px] font-bold uppercase tracking-widest text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--neutral-bg)] border border-[var(--neutral-border)] flex items-center justify-center">
                                <svg className="w-4 h-4 text-[var(--neutral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                            </div>
                            Detected Patterns
                        </h2>
                        <span className="text-[11px] font-bold font-mono px-3 py-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-white">
                            {uniquePatterns.length} FOUND
                        </span>
                    </div>

                    {uniquePatterns.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 bg-gradient-to-b from-[var(--bg-base)] to-[var(--bg-card)]">
                            <div className="w-16 h-16 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mb-5">
                                <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h3a2 2 0 002-2zm0 0V9a2 2 0 012-2h3a2 2 0 012 2v10m-6 0a2 2 0 002 2h3a2 2 0 002-2m0 0V5a2 2 0 012-2h3a2 2 0 012 2v14a2 2 0 01-2 2h-3a2 2 0 01-2-2z" /></svg>
                            </div>
                            <p className="text-[13px] font-semibold text-[var(--text-secondary)]">No Patterns Detected</p>
                            <p className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-widest text-center mt-2">Try different timeframes or<br />wait for new candle formations</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto max-h-[500px] bg-[var(--bg-base)]">
                            {uniquePatterns.map((p, i) => {
                                const clr = p.signal === 'bullish' ? 'var(--bullish)' : p.signal === 'bearish' ? 'var(--bearish)' : 'var(--neutral)';
                                const bgClr = p.signal === 'bullish' ? 'var(--bullish-bg)' : p.signal === 'bearish' ? 'var(--bearish-bg)' : 'var(--neutral-bg)';
                                return (
                                    <div key={i} className={`border-b border-[var(--border)] transition-colors ${activePatternDate === p.date && expandedPattern === p.type ? 'bg-[var(--bg-surface)]' : ''}`}>
                                        <button onClick={() => loadPatternExplanation(p)}
                                            className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer hover:bg-[var(--bg-surface)] transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center border" style={{ borderColor: clr + '40', backgroundColor: bgClr }}>
                                                    {p.signal === 'bullish' ? <span className="text-[16px]">📈</span> : p.signal === 'bearish' ? <span className="text-[16px]">📉</span> : <span className="text-[16px]">📊</span>}
                                                </div>
                                                <div>
                                                    <p className="text-[14px] font-bold text-white group-hover:text-[var(--accent)] transition-colors">{p.type}</p>
                                                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 font-mono leading-relaxed max-w-md">{p.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="text-right">
                                                    <p className="font-mono text-[15px] font-bold text-white">{p.confidence}%</p>
                                                    <p className="text-[9px] uppercase tracking-widest font-mono font-bold" style={{ color: clr }}>{p.signal}</p>
                                                </div>
                                                <div className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all text-[12px]">
                                                    {expandedPattern === p.type ? '−' : '+'}
                                                </div>
                                            </div>
                                        </button>

                                        {/* AI Explanation Dropdown */}
                                        {expandedPattern === p.type && (
                                            <div className="px-6 pb-6 pt-2 bg-[var(--bg-elevated)] border-t border-[var(--border)]">
                                                <div className="border-l-2 border-[var(--ai-purple)] pl-4">
                                                    <p className="text-[10px] font-bold uppercase font-mono tracking-widest mb-3 flex items-center gap-2 text-[var(--ai-purple)]">
                                                        <div className="w-2 h-2 rounded-full bg-[var(--ai-purple)] animate-pulse" />
                                                        AI Pattern Analysis — What This Means
                                                    </p>
                                                    <p className="text-[13px] text-[var(--text-primary)] leading-[1.8]">
                                                        {explainLoading === p.type ? <span className="text-[var(--text-muted)] animate-pulse font-mono tracking-widest uppercase">Analyzing via Llama 3.3 70B...</span>
                                                            : patternExplanations[p.type] || 'Click to get AI explanation.'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* AI Prediction Panel */}
                <div className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl bg-[var(--bg-card)] flex flex-col min-h-[400px] relative">
                    <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-[var(--ai-purple)] via-[var(--ai-purple)] to-transparent" />
                    <div className="bg-gradient-to-r from-[#060910] to-[var(--bg-card)] px-7 py-5 flex items-center justify-between border-b border-[var(--border)]">
                        <h2 className="text-[12px] font-bold uppercase tracking-widest text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--ai-purple-bg)] border border-[var(--ai-purple-border)] flex items-center justify-center">
                                <svg className="w-4 h-4 text-[var(--ai-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            </div>
                            AI Neural Prediction
                        </h2>
                        <button onClick={loadPrediction}
                            className="btn btn-ai px-5 py-2 text-[11px] font-mono tracking-widest shadow-[0_0_15px_var(--ai-purple-bg)]"
                            disabled={predLoading}>
                            {predLoading ? '⏳ PROCESSING...' : '⚡ RUN AI'}
                        </button>
                    </div>

                    {!prediction && !predLoading && (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-b from-[var(--bg-base)] to-[var(--bg-card)]">
                            <div className="w-16 h-16 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mb-5">
                                <svg className="w-8 h-8 text-[var(--ai-purple)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <p className="text-[13px] font-semibold text-[var(--text-secondary)] mb-2">Awaiting Analysis Command</p>
                            <p className="text-[11px] text-[var(--text-muted)] font-mono max-w-xs">Cross-references {uniquePatterns.length} detected patterns + technicals + sentiment via Llama 3.3 70B</p>
                        </div>
                    )}

                    {prediction && !prediction.error && (
                        <div className="p-6 space-y-5 flex-1 bg-[var(--bg-card)] overflow-y-auto">
                            {/* Direction Badge */}
                            <div className="flex items-end gap-5 bg-[var(--bg-elevated)] p-5 rounded-xl border border-[var(--border)]">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-mono mb-2">Signal</p>
                                    <span className={`text-2xl font-black font-mono px-5 py-1.5 rounded-lg inline-block ${prediction.direction === 'bullish' ? 'bg-[var(--bullish-bg)] text-[var(--bullish)] border border-[var(--bullish-border)]' : prediction.direction === 'bearish' ? 'bg-[var(--bearish-bg)] text-[var(--bearish)] border border-[var(--bearish-border)]' : 'bg-[var(--neutral-bg)] text-[var(--neutral)] border border-[var(--neutral-border)]'}`}>
                                        {prediction.direction?.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-mono mb-2">Confidence</p>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-3 bg-[var(--bg-base)] rounded-full overflow-hidden border border-[var(--border)]">
                                            <div className="h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${prediction.confidence}%`, background: prediction.confidence > 70 ? 'var(--bullish)' : prediction.confidence > 40 ? 'var(--neutral)' : 'var(--bearish)' }} />
                                        </div>
                                        <span className="mono text-[16px] font-bold text-white">{prediction.confidence}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Reasoning */}
                            <div className="pl-4 border-l-2 border-[var(--ai-purple)]">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ai-purple)] mb-2 font-mono">Analysis</p>
                                <p className="text-[13px] leading-[1.8] text-[var(--text-primary)]">{prediction.reasoning}</p>
                                {prediction.short_term_outlook && (
                                    <p className="text-[12px] mt-3 font-semibold bg-[var(--ai-purple-bg)] p-3 rounded-lg border border-[var(--ai-purple-border)] text-[var(--text-white)]">
                                        📅 {prediction.short_term_outlook}
                                    </p>
                                )}
                            </div>

                            {/* Key Levels */}
                            {prediction.key_levels && Object.keys(prediction.key_levels).length > 0 && (
                                <div className="grid grid-cols-2 gap-3">
                                    {prediction.key_levels.support && <LevelWidget label="Support" value={prediction.key_levels.support} type="bullish" />}
                                    {prediction.key_levels.resistance && <LevelWidget label="Resistance" value={prediction.key_levels.resistance} type="bearish" />}
                                    {prediction.key_levels.target && <LevelWidget label="AI Target" value={prediction.key_levels.target} type="accent" />}
                                    {prediction.key_levels.stop_loss && <LevelWidget label="Stop Loss" value={prediction.key_levels.stop_loss} type="neutral" />}
                                </div>
                            )}

                            {/* Risk Factors */}
                            {prediction.risk_factors?.length > 0 && (
                                <div className="bg-[#0A0E14] p-4 rounded-xl border border-[var(--border)]">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--bearish)] mb-3 font-mono">⚠ Risk Vectors</p>
                                    <ul className="space-y-2">
                                        {prediction.risk_factors.map((r, i) => (
                                            <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--text-secondary)]">
                                                <span className="text-[var(--bearish)] mt-0.5">•</span>
                                                <span>{r}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <p className="text-[9px] text-center font-mono text-[var(--text-muted)] opacity-50 uppercase tracking-widest pt-2">
                                {prediction.disclaimer || 'AI-generated analysis. Not financial advice.'}
                            </p>
                        </div>
                    )}

                    {prediction?.error && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--bearish-bg)]">
                            <p className="text-[12px] font-mono text-[var(--bearish)] uppercase tracking-widest">{prediction.error}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Technical Indicators Grid ──────────────── */}
            {indicators && (
                <div className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl bg-[var(--bg-card)]">
                    <div className="bg-gradient-to-r from-[#060910] to-[var(--bg-card)] px-7 py-5 border-b border-[var(--border)]">
                        <h2 className="text-[12px] font-bold uppercase tracking-widest text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--neutral-bg)] border border-[var(--neutral-border)] flex items-center justify-center">
                                <svg className="w-4 h-4 text-[var(--neutral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h3a2 2 0 002-2zm0 0V9a2 2 0 012-2h3a2 2 0 012 2v10m-6 0a2 2 0 002 2h3a2 2 0 002-2m0 0V5a2 2 0 012-2h3a2 2 0 012 2v14a2 2 0 01-2 2h-3a2 2 0 01-2-2z" /></svg>
                            </div>
                            Technical Telemetry
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-[var(--border)]">
                        <IndicatorCell label="RSI (14)" value={indicators?.current_rsi?.toFixed(1)} signal={indicators?.current_rsi > 70 ? 'bearish' : indicators?.current_rsi < 30 ? 'bullish' : 'neutral'} />
                        <IndicatorCell label="MACD" value={indicators?.current_macd?.toFixed(2)} signal={indicators?.current_macd > 0 ? 'bullish' : 'bearish'} />
                        <IndicatorCell label="SMA 50" value={`₹${indicators?.current_sma_50?.toFixed(0) || '—'}`} signal={stock?.current_price > (indicators?.current_sma_50 || 0) ? 'bullish' : 'bearish'} />
                        <IndicatorCell label="SMA 200" value={`₹${indicators?.current_sma_200?.toFixed(0) || '—'}`} signal={stock?.current_price > (indicators?.current_sma_200 || 0) ? 'bullish' : 'bearish'} />
                    </div>

                    {/* RSI Gauge */}
                    {indicators?.current_rsi && (
                        <div className="px-7 py-5 bg-[#050810] border-t border-[var(--border)]">
                            <div className="flex justify-between text-[9px] font-bold font-mono mb-2 uppercase tracking-widest text-[var(--text-muted)]">
                                <span>OVERSOLD (30)</span>
                                <span className="text-white">RSI GAUGE</span>
                                <span>OVERBOUGHT (70)</span>
                            </div>
                            <div className="h-2.5 w-full bg-gradient-to-r from-[var(--bullish)] via-[var(--neutral)] to-[var(--bearish)] rounded-full relative shadow-inner">
                                <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)] border-2 border-[var(--bg-card)] transition-all duration-1000"
                                    style={{ left: `calc(${Math.min(100, Math.max(0, indicators.current_rsi))}% - 10px)` }} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════

function CandlestickTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const isBull = d.close >= d.open;
    return (
        <div className="bg-[rgba(6,9,15,0.95)] backdrop-blur-md border border-[var(--border)] p-4 rounded-xl shadow-2xl min-w-[200px]">
            <p className="text-[10px] uppercase font-mono tracking-widest mb-2 text-[var(--text-muted)] border-b border-[var(--border)] pb-2">{d.time || d.date}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] mono">
                <span className="text-[var(--text-muted)]">Open</span>
                <span className="text-right text-white font-bold">₹{d.open?.toLocaleString('en-IN')}</span>
                <span className="text-[var(--bullish)]">High</span>
                <span className="text-right text-[var(--bullish)] font-bold">₹{d.high?.toLocaleString('en-IN')}</span>
                <span className="text-[var(--bearish)]">Low</span>
                <span className="text-right text-[var(--bearish)] font-bold">₹{d.low?.toLocaleString('en-IN')}</span>
                <span className="text-[var(--text-muted)]">Close</span>
                <span className={`text-right font-bold ${isBull ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'}`}>₹{d.close?.toLocaleString('en-IN')}</span>
            </div>
            {d.volume > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--border)] flex justify-between text-[10px] mono">
                    <span className="text-[var(--text-muted)] uppercase tracking-widest">Volume</span>
                    <span className="font-bold text-white">{formatVolume(d.volume)}</span>
                </div>
            )}
            <div className={`mt-2 text-center text-[10px] font-bold uppercase tracking-widest py-1 rounded ${isBull ? 'bg-[var(--bullish-bg)] text-[var(--bullish)]' : 'bg-[var(--bearish-bg)] text-[var(--bearish)]'}`}>
                {isBull ? '▲ BULLISH' : '▼ BEARISH'} CANDLE
            </div>
        </div>
    );
}

function IndicatorCell({ label, value, signal }) {
    const clr = signal === 'bullish' ? 'var(--bullish)' : signal === 'bearish' ? 'var(--bearish)' : 'var(--text-primary)';
    return (
        <div className="px-6 py-5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] transition-colors group">
            <p className="text-[10px] uppercase tracking-widest font-mono font-bold text-[var(--text-muted)]">{label}</p>
            <div className="flex items-center justify-between mt-2">
                <p className="mono text-xl font-bold text-white">{value || '—'}</p>
                {signal && signal !== 'neutral' && <span className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: clr, color: clr }} />}
            </div>
        </div>
    );
}

function LevelWidget({ label, value, type }) {
    const colors = { bullish: 'var(--bullish)', bearish: 'var(--bearish)', neutral: 'var(--text-secondary)', accent: 'var(--accent)' };
    return (
        <div className="px-4 py-3 bg-[var(--bg-base)] rounded-xl border border-[var(--border)]">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-mono font-bold">{label}</p>
            <p className="mono text-[15px] font-bold mt-1" style={{ color: colors[type] }}>
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

function formatVolume(vol) {
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)}Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(2)}L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol?.toLocaleString() || '0';
}

function StockSkeleton() {
    return (
        <div className="space-y-6 pt-6 w-full animate-up">
            <div className="skeleton h-36 rounded-2xl w-full" />
            <div className="skeleton h-[520px] rounded-2xl w-full" />
            <div className="grid lg:grid-cols-2 gap-6 w-full">
                <div className="skeleton h-[400px] rounded-2xl" />
                <div className="skeleton h-[400px] rounded-2xl" />
            </div>
        </div>
    );
}
