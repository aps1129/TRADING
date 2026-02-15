import { useState, useEffect } from 'react';
import {
    Newspaper, RefreshCw, ExternalLink, Brain, Filter,
    TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertCircle, FileText
} from 'lucide-react';
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
    const [showFilters, setShowFilters] = useState(false);
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
            setArticles(res.data.articles || []);
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
        <div className="space-y-6 animate-fade-in-up">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        Market News
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Aggregated from {SOURCES.length - 1} sources with AI sentiment analysis
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setShowManualModal(true)}
                        className="btn btn-secondary text-xs">
                        <FileText size={14} />
                        Analyze Article (ET Prime)
                    </button>
                    <button onClick={() => setShowFilters(!showFilters)}
                        className="btn btn-secondary text-xs sm:hidden">
                        <Filter size={14} />
                        Filters
                    </button>
                    <button onClick={handleFetchNews}
                        className="btn btn-primary text-xs"
                        disabled={refreshing}>
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Fetching...' : 'Fetch Latest'}
                    </button>
                </div>
            </div>

            {/* ─── Filters ─────────────────────────────────────────── */}
            <div className={`glass-card p-4 ${showFilters ? '' : 'hidden sm:block'}`}>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Source</p>
                        <div className="flex flex-wrap gap-1.5">
                            {SOURCES.map(s => (
                                <button key={s} onClick={() => setSource(s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                        ${source === s ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-white/[0.03] text-slate-500 hover:text-white border border-transparent'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Sentiment</p>
                        <div className="flex gap-1.5">
                            {SENTIMENTS.map(s => (
                                <button key={s} onClick={() => setSentiment(s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize
                                        ${sentiment === s
                                            ? s === 'bullish' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : s === 'bearish' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                    : s === 'neutral' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-white/[0.03] text-slate-500 hover:text-white border border-transparent'
                                        }`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Manual Analysis Modal ───────────────────────────── */}
            {showManualModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
                    onClick={() => setShowManualModal(false)}>
                    <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        style={{ background: 'rgba(15, 23, 42, 0.98)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="p-5 sm:p-6 border-b border-white/[0.1] flex justify-between items-center">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Brain size={20} className="text-purple-400" />
                                Custom Article Analysis
                            </h3>
                            <button onClick={() => setShowManualModal(false)} className="text-slate-500 hover:text-white">
                                <Minus size={20} className="rotate-45" />
                            </button>
                        </div>

                        <div className="p-5 sm:p-6 space-y-4">
                            {!manualAnalysis ? (
                                <>
                                    <p className="text-sm text-slate-400">
                                        Paste any news article (e.g. from ET Prime, Bloomberg) to get instant AI sentiment analysis.
                                    </p>
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 block">Headline</label>
                                        <input
                                            value={manualTitle}
                                            onChange={(e) => setManualTitle(e.target.value)}
                                            placeholder="Paste article headline..."
                                            className="input mb-3"
                                        />
                                        <label className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 block">Content</label>
                                        <textarea
                                            value={manualContent}
                                            onChange={(e) => setManualContent(e.target.value)}
                                            placeholder="Paste full article content here..."
                                            className="input min-h-[150px] resize-y"
                                        />
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={handleManualAnalyze}
                                            disabled={analyzingManual || !manualTitle || !manualContent}
                                            className="btn btn-primary w-full sm:w-auto">
                                            {analyzingManual ? (
                                                <><RefreshCw size={16} className="animate-spin" /> Analyzing...</>
                                            ) : (
                                                <><Brain size={16} /> Analyze Text</>
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <SentimentBadge sentiment={manualAnalysis.sentiment} />
                                            <span className={`badge text-xs badge-${manualAnalysis.impact}`}>
                                                {manualAnalysis.impact} impact
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            Confidence: {manualAnalysis.confidence}%
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-white/[0.03] space-y-3">
                                        <p className="text-xs text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Brain size={12} /> Key Takeaways
                                        </p>
                                        <ul className="space-y-2">
                                            {manualAnalysis.key_points?.map((pt, i) => (
                                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                    <span className="text-slate-600 mt-1">•</span>
                                                    {pt}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {manualAnalysis.affected_stocks?.length > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Affected Stocks</p>
                                            <div className="flex flex-wrap gap-2">
                                                {manualAnalysis.affected_stocks.map(s => (
                                                    <span key={s} className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-mono border border-blue-500/20">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-4 border-t border-white/[0.1]">
                                        <button
                                            onClick={() => { setManualAnalysis(null); setManualTitle(''); setManualContent(''); }}
                                            className="btn btn-secondary text-xs">
                                            Analyze Another
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Articles ────────────────────────────────────────── */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="skeleton h-24 rounded-2xl" />
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <div className="text-center py-16 glass-card">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                        <Newspaper size={28} className="text-amber-400" />
                    </div>
                    <p className="text-sm text-slate-500 mb-4">No news articles found</p>
                    <button onClick={handleFetchNews} className="btn btn-primary text-sm">
                        <RefreshCw size={16} /> Fetch News Now
                    </button>
                </div>
            ) : (
                <div className="space-y-3 stagger-children">
                    {articles.map((article) => (
                        <div key={article.id} className="glass-card overflow-hidden">
                            {/* Article Header */}
                            <button
                                onClick={() => toggleArticle(article.id)}
                                className="w-full text-left p-4 sm:p-5 hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm sm:text-base font-medium leading-snug line-clamp-2 mb-2">
                                            {article.title}
                                        </h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs text-slate-600 font-medium">{article.source}</span>
                                            <span className="text-xs text-slate-700">•</span>
                                            <span className="text-xs text-slate-600">
                                                {formatDate(article.published_date)}
                                            </span>
                                            <SentimentBadge sentiment={article.sentiment} />
                                            {article.impact && article.impact !== 'unknown' && (
                                                <span className={`badge text-[10px] badge-${article.impact}`}>
                                                    {article.impact}
                                                </span>
                                            )}
                                            {article.symbols_mentioned?.length > 0 && (
                                                <div className="flex gap-1">
                                                    {article.symbols_mentioned.slice(0, 3).map(s => (
                                                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {expandedArticle === article.id
                                        ? <ChevronUp size={16} className="text-slate-500 shrink-0 mt-1" />
                                        : <ChevronDown size={16} className="text-slate-500 shrink-0 mt-1" />}
                                </div>
                            </button>

                            {/* Expanded Content */}
                            {expandedArticle === article.id && (
                                <div className="px-4 sm:px-5 pb-4 sm:pb-5 animate-fade-in border-t border-white/[0.04] pt-4">
                                    {/* Content */}
                                    {article.content && (
                                        <p className="text-sm text-slate-400 leading-relaxed mb-4">
                                            {article.content.slice(0, 500)}
                                            {article.content.length > 500 && '...'}
                                        </p>
                                    )}

                                    {/* AI Analysis */}
                                    {article.key_points?.length > 0 && (
                                        <div className="p-4 rounded-xl bg-white/[0.02] mb-4">
                                            <p className="text-xs text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <Brain size={12} /> AI Analysis
                                            </p>
                                            <ul className="space-y-1.5">
                                                {article.key_points.map((point, i) => (
                                                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                        <span className="text-slate-600 mt-0.5">•</span>
                                                        {point}
                                                    </li>
                                                ))}
                                            </ul>
                                            {article.analysis_confidence > 0 && (
                                                <p className="text-xs text-slate-500 mt-3">
                                                    Confidence: {article.analysis_confidence}%
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-3">
                                        {article.sentiment === 'pending' && (
                                            <button
                                                onClick={() => handleAnalyze(article.id)}
                                                className="btn btn-primary text-xs"
                                                disabled={analyzingId === article.id}>
                                                {analyzingId === article.id ? (
                                                    <><RefreshCw size={12} className="animate-spin" /> Analyzing...</>
                                                ) : (
                                                    <><Brain size={12} /> Analyze with AI</>
                                                )}
                                            </button>
                                        )}
                                        {article.url && (
                                            <a href={article.url} target="_blank" rel="noopener noreferrer"
                                                className="btn btn-secondary text-xs">
                                                <ExternalLink size={12} /> Read Full Article
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SentimentBadge({ sentiment }) {
    if (!sentiment || sentiment === 'pending') {
        return <span className="badge text-[10px] bg-white/[0.05] text-slate-500 border border-white/[0.08]">pending</span>;
    }
    const cls = sentiment === 'bullish' ? 'badge-bullish'
        : sentiment === 'bearish' ? 'badge-bearish'
            : 'badge-neutral';
    return (
        <span className={`badge text-[10px] flex items-center gap-1 ${cls}`}>
            {sentiment === 'bullish' ? <TrendingUp size={10} /> :
                sentiment === 'bearish' ? <TrendingDown size={10} /> :
                    <Minus size={10} />}
            {sentiment}
        </span>
    );
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / (1000 * 60));
        if (diff < 60) return `${diff}m ago`;
        if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
        return dateStr;
    }
}
