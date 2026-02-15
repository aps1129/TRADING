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
        <div className="space-y-4 animate-up">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2">
                <div>
                    <h1 className="text-base font-semibold" style={{ color: 'var(--text-white)' }}>
                        Market News
                    </h1>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Aggregated from {SOURCES.length - 1} sources with AI sentiment analysis
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowManualModal(true)}
                        className="btn btn-secondary">
                        Analyze Article
                    </button>
                    <button onClick={handleFetchNews}
                        className="btn btn-primary"
                        disabled={refreshing}>
                        {refreshing ? 'Fetching...' : 'Fetch Latest'}
                    </button>
                </div>
            </div>

            {/* ─── Filters ─────────────────────────────────────────── */}
            <div className="card p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-wider mb-1.5 font-medium"
                            style={{ color: 'var(--text-muted)' }}>Source</p>
                        <div className="flex flex-wrap gap-1">
                            {SOURCES.map(s => (
                                <button key={s} onClick={() => setSource(s)}
                                    className="px-2.5 py-1 rounded text-[11px] font-medium"
                                    style={{
                                        background: source === s ? 'var(--accent-bg)' : 'var(--bg-surface)',
                                        color: source === s ? 'var(--accent)' : 'var(--text-secondary)',
                                        border: source === s ? '1px solid var(--accent-border)' : '1px solid transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.1s',
                                    }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider mb-1.5 font-medium"
                            style={{ color: 'var(--text-muted)' }}>Sentiment</p>
                        <div className="flex gap-1">
                            {SENTIMENTS.map(s => {
                                const activeColors = {
                                    all: { bg: 'var(--accent-bg)', color: 'var(--accent)', border: 'var(--accent-border)' },
                                    bullish: { bg: 'var(--bullish-bg)', color: 'var(--bullish)', border: 'var(--bullish-border)' },
                                    bearish: { bg: 'var(--bearish-bg)', color: 'var(--bearish)', border: 'var(--bearish-border)' },
                                    neutral: { bg: 'var(--neutral-bg)', color: 'var(--neutral)', border: 'var(--neutral-border)' },
                                };
                                const active = activeColors[s];
                                return (
                                    <button key={s} onClick={() => setSentiment(s)}
                                        className="px-2.5 py-1 rounded text-[11px] font-medium capitalize"
                                        style={{
                                            background: sentiment === s ? active.bg : 'var(--bg-surface)',
                                            color: sentiment === s ? active.color : 'var(--text-secondary)',
                                            border: sentiment === s ? `1px solid ${active.border}` : '1px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.1s',
                                        }}>
                                        {s}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Manual Analysis Modal ───────────────────────────── */}
            {showManualModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-in"
                    style={{ background: 'rgba(0, 0, 0, 0.7)' }}
                    onClick={() => setShowManualModal(false)}>
                    <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-up"
                        style={{ background: 'var(--bg-elevated)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex justify-between items-center"
                            style={{ borderBottom: '1px solid var(--border)' }}>
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-white)' }}>
                                Custom Article Analysis
                            </h3>
                            <button onClick={() => setShowManualModal(false)}
                                className="btn btn-ghost text-[11px]">Close</button>
                        </div>

                        <div className="p-5 space-y-4">
                            {!manualAnalysis ? (
                                <>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        Paste any news article to get instant AI sentiment analysis.
                                    </p>
                                    <div>
                                        <label className="text-[11px] uppercase tracking-wider mb-1 block"
                                            style={{ color: 'var(--text-muted)' }}>Headline</label>
                                        <input
                                            value={manualTitle}
                                            onChange={(e) => setManualTitle(e.target.value)}
                                            placeholder="Paste article headline..."
                                            className="input mb-3"
                                        />
                                        <label className="text-[11px] uppercase tracking-wider mb-1 block"
                                            style={{ color: 'var(--text-muted)' }}>Content</label>
                                        <textarea
                                            value={manualContent}
                                            onChange={(e) => setManualContent(e.target.value)}
                                            placeholder="Paste full article content here..."
                                            className="input"
                                            style={{ minHeight: '120px' }}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleManualAnalyze}
                                            disabled={analyzingManual || !manualTitle || !manualContent}
                                            className="btn btn-ai">
                                            {analyzingManual ? 'Analyzing...' : 'Analyze Text'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4 animate-in">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <SentimentBadge sentiment={manualAnalysis.sentiment} />
                                            {manualAnalysis.impact && (
                                                <span className="badge badge-neutral text-[11px]">
                                                    {manualAnalysis.impact} impact
                                                </span>
                                            )}
                                        </div>
                                        <span className="mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                            Confidence: {manualAnalysis.confidence}%
                                        </span>
                                    </div>

                                    <div className="ai-border">
                                        <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--ai-purple)' }}>
                                            Key Takeaways
                                        </p>
                                        <ul className="space-y-1">
                                            {manualAnalysis.key_points?.map((pt, i) => (
                                                <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>*</span>
                                                    {pt}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {manualAnalysis.affected_stocks?.length > 0 && (
                                        <div>
                                            <p className="text-[11px] uppercase tracking-wider mb-1.5"
                                                style={{ color: 'var(--text-muted)' }}>Affected Stocks</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {manualAnalysis.affected_stocks.map(s => (
                                                    <span key={s} className="mono text-[11px] px-2 py-0.5 rounded"
                                                        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                                        <button
                                            onClick={() => { setManualAnalysis(null); setManualTitle(''); setManualContent(''); }}
                                            className="btn btn-secondary">
                                            Analyze Another
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Articles (List View) ──────────────────────────── */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="skeleton h-16 rounded-lg" />
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <div className="card text-center py-12">
                    <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>No news articles found</p>
                    <button onClick={handleFetchNews} className="btn btn-primary">
                        Fetch News Now
                    </button>
                </div>
            ) : (
                <div className="card">
                    {articles.map((article, idx) => (
                        <div key={article.id}
                            style={idx > 0 ? { borderTop: '1px solid var(--border)' } : {}}>
                            {/* Article Row */}
                            <button
                                onClick={() => toggleArticle(article.id)}
                                className="w-full text-left px-4 py-3 cursor-pointer"
                                style={{ background: 'transparent', border: 'none', transition: 'background 0.1s' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xs font-medium leading-snug mb-1"
                                            style={{ color: 'var(--text-primary)' }}>
                                            {article.title}
                                        </h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                                {article.source}
                                            </span>
                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>|</span>
                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                {formatDate(article.published_date)}
                                            </span>
                                            <SentimentText sentiment={article.sentiment}
                                                confidence={article.analysis_confidence} />
                                            {article.symbols_mentioned?.length > 0 && (
                                                <div className="flex gap-1">
                                                    {article.symbols_mentioned.slice(0, 3).map(s => (
                                                        <span key={s} className="mono text-[10px] px-1 py-0.5 rounded"
                                                            style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                        {expandedArticle === article.id ? '-' : '+'}
                                    </span>
                                </div>
                            </button>

                            {/* Expanded Content */}
                            {expandedArticle === article.id && (
                                <div className="px-4 pb-4 animate-in" style={{ borderTop: '1px solid var(--border)' }}>
                                    <div className="pt-3">
                                        {/* Content */}
                                        {article.content && (
                                            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                                                {article.content.slice(0, 500)}
                                                {article.content.length > 500 && '...'}
                                            </p>
                                        )}

                                        {/* AI Analysis */}
                                        {article.key_points?.length > 0 && (
                                            <div className="ai-border mb-3">
                                                <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--ai-purple)' }}>
                                                    AI Analysis
                                                </p>
                                                <ul className="space-y-1">
                                                    {article.key_points.map((point, i) => (
                                                        <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                                                            <span style={{ color: 'var(--text-muted)' }}>*</span>
                                                            {point}
                                                        </li>
                                                    ))}
                                                </ul>
                                                {article.analysis_confidence > 0 && (
                                                    <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                                                        Confidence: {article.analysis_confidence}%
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {article.sentiment === 'pending' && (
                                                <button
                                                    onClick={() => handleAnalyze(article.id)}
                                                    className="btn btn-ai"
                                                    disabled={analyzingId === article.id}>
                                                    {analyzingId === article.id ? 'Analyzing...' : 'Analyze with AI'}
                                                </button>
                                            )}
                                            {article.url && (
                                                <a href={article.url} target="_blank" rel="noopener noreferrer"
                                                    className="btn btn-secondary">
                                                    Read Full Article
                                                </a>
                                            )}
                                        </div>
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
        return <span className="badge badge-pending text-[11px]">Pending</span>;
    }
    const cls = sentiment === 'bullish' ? 'badge-bullish'
        : sentiment === 'bearish' ? 'badge-bearish'
            : 'badge-neutral';
    return <span className={`badge text-[11px] capitalize ${cls}`}>{sentiment}</span>;
}

function SentimentText({ sentiment, confidence }) {
    if (!sentiment || sentiment === 'pending') {
        return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Pending</span>;
    }
    const color = sentiment === 'bullish' ? 'var(--bullish)'
        : sentiment === 'bearish' ? 'var(--bearish)'
            : 'var(--neutral)';
    return (
        <span className="text-[11px] font-medium capitalize" style={{ color }}>
            {sentiment}{confidence ? ` ${confidence}%` : ''}
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
