import { useState, useEffect } from 'react';
import { getNews, fetchNews, analyzeArticle, analyzeText } from '../api';

const SOURCES = [
    'All Sources', 'Moneycontrol', 'Economic Times', 'Business Standard',
    'LiveMint', 'Financial Express', 'NDTV Profit'
];
const SENTIMENTS = ['all', 'bullish', 'bearish', 'neutral'];

export default function NewsPage() {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [source, setSource] = useState('All Sources');
    const [sentiment, setSentiment] = useState('all');
    const [expandedArticle, setExpandedArticle] = useState(null);
    const [analyzingId, setAnalyzingId] = useState(null);
    const [showManualModal, setShowManualModal] = useState(false);

    // Manual Analysis State
    const [manualTitle, setManualTitle] = useState('');
    const [manualContent, setManualContent] = useState('');
    const [manualAnalysis, setManualAnalysis] = useState(null);
    const [analyzingManual, setAnalyzingManual] = useState(false);

    useEffect(() => {
        loadNews();
    }, [source, sentiment]);

    const loadNews = async () => {
        try {
            setLoading(true);
            const params = {};
            if (source !== 'All Sources') params.source = source;
            if (sentiment !== 'all') params.sentiment = sentiment;
            params.limit = 100;
            const res = await getNews(params);

            // If filtering by sentiment locally instead of just via backend (extra safety)
            let fetchedArticles = res.data.articles || [];
            if (sentiment !== 'all') {
                fetchedArticles = fetchedArticles.filter(a => a.sentiment === sentiment || (sentiment === 'neutral' && a.sentiment === 'pending'));
            }
            setArticles(fetchedArticles);
        } catch {
            setArticles([]);
        } finally {
            setLoading(false);
        }
    };

    const handleFetchNews = async () => {
        setRefreshing(true);
        try {
            await fetchNews();
            setTimeout(async () => {
                await loadNews();
                setRefreshing(false);
            }, 4000);
        } catch {
            setRefreshing(false);
        }
    };

    const handleAnalyze = async (articleId) => {
        setAnalyzingId(articleId);
        try {
            const res = await analyzeArticle(articleId);
            setArticles(prev => prev.map(a =>
                a.id === articleId ? {
                    ...a,
                    sentiment: res.data.analysis.sentiment,
                    analysis_confidence: res.data.analysis.confidence,
                    key_points: res.data.analysis.key_points || [],
                    impact: res.data.analysis.impact,
                    affected_stocks: res.data.analysis.affected_stocks || [],
                } : a
            ));
        } catch {
            alert('Analysis failed. Check Gemini API key.');
        } finally {
            setAnalyzingId(null);
        }
    };

    const handleManualAnalyze = async () => {
        if (!manualTitle.trim() || !manualContent.trim()) return;
        setAnalyzingManual(true);
        try {
            const res = await analyzeText(manualTitle, manualContent);
            setManualAnalysis(res.data.analysis);
        } catch {
            alert('Analysis failed. Please try again.');
        } finally {
            setAnalyzingManual(false);
        }
    };

    const toggleArticle = (id) => {
        setExpandedArticle(expandedArticle === id ? null : id);
    };

    return (
        <div className="space-y-6 animate-up max-w-[1200px] mx-auto">

            {/* ─── Header Header Widget ──────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 py-6 border-b border-[var(--border)] bg-gradient-to-r from-[var(--bg-elevated)] to-[var(--bg-base)] rounded-2xl px-6 border shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--ai-purple)] rounded-full blur-[100px] opacity-10 pointer-events-none" />

                <div className="relative z-10">
                    <h1 className="text-3xl font-black font-mono text-white tracking-tighter drop-shadow-md flex items-center gap-3">
                        <svg className="w-8 h-8 text-[var(--ai-purple)] drop-shadow-[0_0_10px_var(--ai-purple-bg)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        Global Market Intel
                    </h1>
                    <p className="text-[12px] mt-2 text-[var(--text-secondary)] font-mono uppercase tracking-widest font-bold">
                        Deep-scanning {SOURCES.length - 1} data sources via Gemini 2.0
                    </p>
                </div>

                <div className="flex flex-row lg:flex-col gap-3 self-stretch lg:self-center justify-center relative z-10 w-full sm:w-auto">
                    <button onClick={() => setShowManualModal(true)} className="btn btn-secondary font-mono text-[11px] tracking-widest uppercase flex-1 sm:flex-none">
                        + Custom Intel Scan
                    </button>
                    <button onClick={handleFetchNews} disabled={refreshing} className="btn btn-primary font-mono text-[11px] tracking-widest shadow-[0_0_15px_var(--accent-glow)] flex-1 sm:flex-none">
                        {refreshing ? 'EXECUTING...' : 'FORCE SYNC DB'}
                    </button>
                </div>
            </div>

            {/* ─── Filter Bar ─────────────────────────────────────────── */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 shadow-xl">
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                        <p className="text-[10px] uppercase font-mono tracking-widest font-bold mb-3 text-[var(--text-muted)] flex items-center gap-2">
                            <svg className="w-3 h-3 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            Data Provider
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {SOURCES.map(s => (
                                <button key={s} onClick={() => setSource(s)}
                                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold font-mono transition-all border shadow-sm ${source === s ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-mono tracking-widest font-bold mb-3 text-[var(--text-muted)] flex items-center gap-2">
                            <svg className="w-3 h-3 text-[var(--ai-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Detected Sentiment Mode
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {SENTIMENTS.map(s => {
                                const activeColors = {
                                    all: 'bg-[var(--accent)] text-white border-[var(--accent)]',
                                    bullish: 'bg-[var(--bullish)] text-[var(--bg-base)] border-[var(--bullish)]',
                                    bearish: 'bg-[var(--bearish)] text-[var(--bg-base)] border-[var(--bearish)]',
                                    neutral: 'bg-[var(--neutral)] text-[var(--bg-base)] border-[var(--neutral)]',
                                };
                                const inactiveColor = 'bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]';

                                return (
                                    <button key={s} onClick={() => setSentiment(s)}
                                        className={`px-4 py-1.5 rounded-md text-[11px] font-bold font-mono uppercase tracking-widest transition-all border shadow-sm ${sentiment === s ? activeColors[s] : inactiveColor}`}>
                                        {s}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Article Feed ──────────────────────────── */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="skeleton h-24 rounded-xl" />
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-xl">
                    <svg className="w-16 h-16 text-[var(--border)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                    <p className="text-[14px] font-mono text-[var(--text-secondary)] uppercase tracking-widest font-bold mb-4">No Intel Records Found</p>
                    <button onClick={handleFetchNews} className="btn btn-primary px-8 font-mono shadow-[0_0_15px_var(--accent-glow)]">Execute Fetch</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {articles.map((article) => (
                        <div key={article.id} className="card bg-[var(--bg-card)] border border-[var(--border)] shadow-lg overflow-hidden group">

                            {/* Summary View (Always visible) */}
                            <button
                                onClick={() => toggleArticle(article.id)}
                                className="w-full text-left p-5 cursor-pointer bg-transparent border-none transition-colors group-hover:bg-[var(--bg-surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <SentimentText sentiment={article.sentiment} confidence={article.analysis_confidence} />
                                        <span className="text-[10px] text-[var(--text-muted)]">|</span>
                                        <span className="text-[10px] uppercase font-bold tracking-widest font-mono text-[var(--text-secondary)]">
                                            {article.source}
                                        </span>
                                        <span className="text-[10px] text-[var(--text-muted)]">|</span>
                                        <span className="text-[10px] font-mono font-bold text-[var(--text-muted)]">
                                            {formatDate(article.published_date)}
                                        </span>
                                    </div>
                                    <h3 className="text-[16px] font-bold text-white group-hover:text-[var(--accent)] transition-colors leading-snug">
                                        {article.title}
                                    </h3>

                                    {article.symbols_mentioned?.length > 0 && (
                                        <div className="flex gap-2 mt-3 flex-wrap">
                                            {article.symbols_mentioned.map(s => (
                                                <span key={s} className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-widest border bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border)] shadow-sm">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="w-8 h-8 rounded-full bg-[var(--bg-base)] border border-[var(--border)] flex items-center justify-center shrink-0 self-end sm:self-center transition-colors group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                                    <svg className={`w-4 h-4 transition-transform ${expandedArticle === article.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </button>

                            {/* Deep Dive View */}
                            {expandedArticle === article.id && (
                                <div className="px-6 pb-6 pt-2 animate-in bg-[var(--bg-elevated)] border-t border-[var(--border)]">
                                    {article.content && (
                                        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] mb-6 py-4 border-b border-[var(--border)]">
                                            {article.content.slice(0, 500)}
                                            {article.content.length > 500 && '...'}
                                        </p>
                                    )}

                                    {/* AI Context Engine */}
                                    <div className="bg-[var(--bg-base)] border border-[var(--border)] rounded-xl p-5 mb-5 shadow-inner relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--ai-purple)]" />
                                        <p className="text-[10px] uppercase font-mono tracking-widest font-bold mb-3 flex items-center gap-2 text-[var(--ai-purple)]">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9V5h2v4h4v2h-4v4H9v-4H5V9h4z" clipRule="evenodd" /></svg>
                                            Gemini Context Synthesis
                                        </p>

                                        {article.key_points?.length > 0 ? (
                                            <ul className="space-y-2">
                                                {article.key_points.map((point, i) => (
                                                    <li key={i} className="text-[13px] flex items-start gap-3 text-[var(--text-primary)]">
                                                        <span className="text-[var(--ai-purple)] mt-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg></span>
                                                        <span className="leading-relaxed">{point}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-[12px] font-mono text-[var(--text-muted)] italic">No synthesis available.</p>
                                        )}
                                    </div>

                                    {/* Action Footers */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        {article.sentiment === 'pending' ? (
                                            <button
                                                onClick={() => handleAnalyze(article.id)}
                                                className="btn btn-ai px-6 py-2 shadow-[0_0_15px_var(--ai-purple-bg)]"
                                                disabled={analyzingId === article.id}>
                                                {analyzingId === article.id ? 'EXECUTING NEURAL SCAN...' : 'TRIGGER AI ANALYSIS'}
                                            </button>
                                        ) : <div />}

                                        {article.url && (
                                            <a href={article.url} target="_blank" rel="noopener noreferrer"
                                                className="btn btn-secondary border border-[var(--border)] font-mono text-[11px] uppercase tracking-widest hover:text-white group w-full sm:w-auto">
                                                Access Source Intel
                                                <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Manual Analysis Modal (Glassmorphism) ───────────────────────────── */}
            {showManualModal && (
                <div className="fixed inset-0 flex items-center justify-center z-[100] p-4 bg-black/60 backdrop-blur-md animate-in"
                    onClick={() => setShowManualModal(false)}>
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-up relative overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}>

                        {/* Decorative Gradient Blob */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--ai-purple)] rounded-full blur-[100px] opacity-10 pointer-events-none" />

                        <div className="flex justify-between items-center p-6 border-b border-[var(--border)] bg-[#0A0E17] relative z-10 shrink-0">
                            <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                <svg className="w-6 h-6 text-[var(--ai-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Custom Intel Upload
                            </h3>
                            <button onClick={() => setShowManualModal(false)} className="text-[var(--text-muted)] hover:text-white transition-colors p-1.5 rounded-md hover:bg-[var(--bg-surface)]">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 relative z-10 flex-1">
                            {!manualAnalysis ? (
                                <div className="space-y-5">
                                    <p className="text-[13px] text-[var(--text-secondary)]">
                                        Inject raw text data into the neural network for instant context and sentiment extraction.
                                    </p>
                                    <div>
                                        <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--text-muted)] mb-2 block">
                                            Intel Vector (Headline)
                                        </label>
                                        <input
                                            value={manualTitle}
                                            onChange={(e) => setManualTitle(e.target.value)}
                                            placeholder="Paste article headline..."
                                            className="input py-3 text-[14px] bg-[var(--bg-base)] border-2 border-[var(--border)] focus:border-[var(--ai-purple)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--text-muted)] mb-2 block">
                                            Raw Data Payload (Content)
                                        </label>
                                        <textarea
                                            value={manualContent}
                                            onChange={(e) => setManualContent(e.target.value)}
                                            placeholder="Paste full article content here..."
                                            className="input py-3 text-[14px] bg-[var(--bg-base)] border-2 border-[var(--border)] focus:border-[var(--ai-purple)] resize-y"
                                            style={{ minHeight: '200px' }}
                                        />
                                    </div>
                                    <div className="pt-4 flex justify-end">
                                        <button
                                            onClick={handleManualAnalyze}
                                            disabled={analyzingManual || !manualTitle || !manualContent}
                                            className="btn btn-ai py-3 px-8 shadow-[0_0_20px_var(--ai-purple-bg)] w-full sm:w-auto text-[13px]">
                                            {analyzingManual ? 'PROCESSING DATA...' : 'EXECUTE SCAN'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in">
                                    <div className="bg-[var(--bg-elevated)] p-5 rounded-xl border border-[var(--border)] flex items-center justify-between shadow-inner">
                                        <div>
                                            <p className="text-[10px] uppercase font-mono tracking-widest font-bold text-[var(--text-muted)] mb-2">Resulting Sentiment</p>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-4 py-1.5 rounded uppercase font-black font-mono tracking-widest text-[14px] ${manualAnalysis.sentiment === 'bullish' ? 'bg-[var(--bullish-bg)] text-[var(--bullish)] border border-[var(--bullish-border)]' : manualAnalysis.sentiment === 'bearish' ? 'bg-[var(--bearish-bg)] text-[var(--bearish)] border border-[var(--bearish-border)]' : 'bg-[var(--neutral-bg)] text-[var(--neutral)] border border-[var(--neutral-border)]'}`}>
                                                    {manualAnalysis.sentiment}
                                                </span>
                                                {manualAnalysis.impact && (
                                                    <span className="text-[10px] uppercase font-bold font-mono px-2 py-1 bg-[var(--bg-base)] text-[var(--text-secondary)] rounded border border-[var(--border)]">
                                                        {manualAnalysis.impact} Impact
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-mono tracking-widest font-bold text-[var(--text-muted)] mb-1">Confidence</p>
                                            <span className="mono text-2xl font-black text-white">{manualAnalysis.confidence}%</span>
                                        </div>
                                    </div>

                                    <div className="border border-[var(--ai-purple)] bg-[var(--ai-purple-bg)] rounded-xl p-5 relative overflow-hidden">
                                        <div className="absolute left-0 top-0 w-1 h-full bg-[var(--ai-purple)]" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--ai-purple)' }}>
                                            Synthesized Actionable Insights
                                        </p>
                                        <ul className="space-y-3">
                                            {manualAnalysis.key_points?.map((pt, i) => (
                                                <li key={i} className="text-[13px] flex items-start gap-3 text-white">
                                                    <span style={{ color: 'var(--ai-purple)' }} className="mt-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg></span>
                                                    <span className="leading-relaxed">{pt}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {manualAnalysis.affected_stocks?.length > 0 && (
                                        <div className="bg-[var(--bg-base)] p-4 rounded-xl border border-[var(--border)] text-center">
                                            <p className="text-[10px] uppercase font-mono tracking-widest font-bold mb-3 text-[var(--text-muted)]">Detected Asset Correlations</p>
                                            <div className="flex flex-wrap gap-2 justify-center">
                                                {manualAnalysis.affected_stocks.map(s => (
                                                    <span key={s} className="mono text-[12px] font-bold px-3 py-1.5 rounded shadow-sm"
                                                        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-5 border-t border-[var(--border)]">
                                        <button
                                            onClick={() => { setManualAnalysis(null); setManualTitle(''); setManualContent(''); }}
                                            className="btn btn-secondary border border-[var(--border)] py-3 px-6 shadow-sm">
                                            RESET FOR NEW SCAN
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SentimentText({ sentiment, confidence }) {
    if (!sentiment || sentiment === 'pending') {
        return <span className="badge badge-pending border-[var(--border)] bg-[var(--bg-card)]">AWAITING AI SCAN</span>;
    }
    const colors = {
        bullish: 'text-[var(--bullish)] bg-[var(--bullish-bg)] border-[var(--bullish-border)]',
        bearish: 'text-[var(--bearish)] bg-[var(--bearish-bg)] border-[var(--bearish-border)]',
        neutral: 'text-[var(--neutral)] bg-[var(--neutral-bg)] border-[var(--neutral-border)]'
    }
    const color = colors[sentiment];

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-widest border uppercase ${color}`}>
            {sentiment}{confidence ? ` • ${confidence}%` : ''}
        </span>
    );
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / (1000 * 60));
        if (diff < 60) return `-${diff}m`;
        if (diff < 1440) return `-${Math.floor(diff / 60)}H`;
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase();
    } catch {
        return dateStr;
    }
}
