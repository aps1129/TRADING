import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
});

// ─── Watchlist ────────────────────────────────────────────────
export const getWatchlist = () => api.get('/watchlist');
export const addToWatchlist = (symbol, name, notes = '') =>
    api.post('/watchlist', { symbol, name, notes });
export const removeFromWatchlist = (symbol) =>
    api.delete(`/watchlist/${symbol}`);

// ─── Stock Analysis ──────────────────────────────────────────
export const getStock = (symbol, period = '6mo') =>
    api.get(`/stocks/${symbol}`, { params: { period } });
export const analyzeStock = (symbol, period = '6mo') =>
    api.get(`/stocks/${symbol}/analysis`, { params: { period } });
export const explainPattern = (symbol, patternType) =>
    api.get(`/stocks/${symbol}/explain-pattern`, { params: { pattern_type: patternType } });
export const getPrediction = (symbol) =>
    api.get(`/stocks/${symbol}/prediction`);

// ─── News ────────────────────────────────────────────────────
export const getNews = (params = {}) =>
    api.get('/news', { params });
export const fetchNews = () =>
    api.post('/news/fetch');
export const analyzeArticle = (articleId) =>
    api.get(`/news/${articleId}/analyze`);
export const analyzeText = (title, content) =>
    api.post('/api/analyze-text', { title, content });

// ─── Predictions & Analytics ─────────────────────────────────
export const getPredictions = (params = {}) =>
    api.get('/predictions', { params });
export const updatePredictionOutcome = (id, outcome, price) =>
    api.put(`/predictions/${id}/outcome`, { outcome, price });
export const getAnalytics = () =>
    api.get('/analytics');

// ─── Dashboard ───────────────────────────────────────────────
export const getDashboard = () => api.get('/dashboard');

// ─── Search ──────────────────────────────────────────────────
export const searchStocks = (query) => api.get(`/search/${query}`);

// ─── Status ──────────────────────────────────────────────────
export const getStatus = () => api.get('/status');

export default api;
