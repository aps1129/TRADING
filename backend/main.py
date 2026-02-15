"""
AI-Powered Stock Analysis & News Tool — Main FastAPI Application
================================================================
Free tier only: yfinance + Gemini API + RSS feeds + SQLite
"""

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncio
import threading
import time
from datetime import datetime

import sys
import os

# Ensure the backend directory is in the python path for relative imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager

from database import init_db, add_to_watchlist, remove_from_watchlist, get_watchlist
from database import save_article, save_analysis, get_news
from database import save_pattern, get_patterns
from database import save_prediction, get_predictions, get_prediction_stats, update_prediction_outcome
from technical import fetch_stock_data, calculate_indicators, detect_patterns, get_quick_quote
from news_scraper import fetch_all_feeds, get_news_for_stock, scrape_article_content
from ai_analysis import explain_pattern, analyze_news_sentiment, generate_prediction, get_api_status

# Initialize database at module level (needed for serverless environments like Vercel)
init_db()

@asynccontextmanager
async def lifespan(app):
    # Startup
    init_db()
    yield
    # Shutdown (nothing to do)

# ─── App Setup ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Stock Analysis AI",
    description="AI-Powered Stock Analysis & News Tool for Indian Markets",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ────────────────────────────────────────────────────────────────

class WatchlistItem(BaseModel):
    symbol: str
    name: str
    notes: Optional[str] = ""

class PredictionOutcome(BaseModel):
    outcome: str  # "bullish", "bearish", "neutral"
    price: float


# ═══════════════════════════════════════════════════════════════════════════
# WATCHLIST ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/watchlist")
def api_get_watchlist():
    """Get all stocks in watchlist with current prices."""
    watchlist = get_watchlist()
    enriched = []
    for item in watchlist:
        quote = get_quick_quote(item["symbol"])
        enriched.append({**item, **quote})
    return {"watchlist": enriched}


@app.post("/api/watchlist")
def api_add_to_watchlist(item: WatchlistItem):
    """Add a stock to the watchlist."""
    result = add_to_watchlist(item.symbol, item.name, item.notes)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.delete("/api/watchlist/{symbol}")
def api_remove_from_watchlist(symbol: str):
    """Remove a stock from the watchlist."""
    result = remove_from_watchlist(symbol)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result


# ═══════════════════════════════════════════════════════════════════════════
# STOCK ANALYSIS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/stocks/{symbol}")
def api_get_stock(symbol: str, period: str = "6mo"):
    """Get stock data with price history."""
    data = fetch_stock_data(symbol, period)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data


@app.get("/api/stocks/{symbol}/analysis")
def api_analyze_stock(symbol: str, period: str = "6mo"):
    """Full technical analysis: data + indicators + patterns."""
    # Fetch stock data
    data = fetch_stock_data(symbol, period)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])

    # Calculate indicators
    indicators = calculate_indicators(data["history"])

    # Detect patterns
    patterns = detect_patterns(data["history"], indicators)

    # Save patterns to DB
    for pattern in patterns:
        save_pattern(
            symbol=symbol,
            pattern_type=pattern["type"],
            confidence=pattern["confidence"],
            ai_explanation="",
            price=data["current_price"],
        )

    return {
        "stock": data,
        "indicators": indicators,
        "patterns": patterns,
    }


@app.get("/api/stocks/{symbol}/explain-pattern")
def api_explain_pattern(symbol: str, pattern_type: str = Query(...)):
    """Get AI explanation for a specific pattern."""
    data = fetch_stock_data(symbol, "3mo")
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])

    pattern = {
        "type": pattern_type,
        "description": f"Detected {pattern_type} pattern",
        "signal": "neutral",
    }

    explanation = explain_pattern(symbol, pattern, data["current_price"])
    return {"symbol": symbol, "pattern": pattern_type, "explanation": explanation}


@app.get("/api/stocks/{symbol}/prediction")
def api_get_prediction(symbol: str):
    """Generate AI prediction for a stock."""
    # Get full analysis
    data = fetch_stock_data(symbol, "6mo")
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])

    indicators = calculate_indicators(data["history"])
    patterns = detect_patterns(data["history"], indicators)

    # Get related news
    all_news = get_news(limit=100, symbol=symbol)

    # Generate AI prediction
    prediction = generate_prediction(symbol, data, patterns, indicators, all_news)

    # Save prediction
    pred_id = save_prediction(
        symbol=symbol,
        direction=prediction["direction"],
        confidence=prediction["confidence"],
        reasoning=prediction.get("reasoning", ""),
        risk_factors=prediction.get("risk_factors", []),
        key_levels=prediction.get("key_levels", {}),
    )

    prediction["id"] = pred_id
    return prediction


# ═══════════════════════════════════════════════════════════════════════════
# NEWS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/news")
def api_get_news(
    limit: int = 50,
    source: Optional[str] = None,
    sentiment: Optional[str] = None,
    symbol: Optional[str] = None,
):
    """Get news articles with optional filters."""
    articles = get_news(limit=limit, source=source, sentiment=sentiment, symbol=symbol)
    return {"articles": articles, "count": len(articles)}


@app.post("/api/news/fetch")
def api_fetch_news(background_tasks: BackgroundTasks):
    """Trigger news fetching from all RSS sources."""
    background_tasks.add_task(fetch_and_store_news)
    return {"message": "News fetch started in background"}


@app.get("/api/news/{article_id}/analyze")
def api_analyze_article(article_id: int):
    """Trigger AI analysis for a specific article."""
    articles = get_news(limit=1000)
    article = next((a for a in articles if a.get("id") == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    analysis = analyze_news_sentiment(article["title"], article.get("content", ""))

    save_analysis(
        article_id=article_id,
        sentiment=analysis["sentiment"],
        confidence=analysis["confidence"],
        key_points=analysis["key_points"],
        impact=analysis["impact"],
        affected_stocks=analysis.get("affected_stocks", []),
    )

    return {"article_id": article_id, "analysis": analysis}


# ═══════════════════════════════════════════════════════════════════════════
# PREDICTIONS & ANALYTICS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/predictions")
def api_get_predictions(symbol: Optional[str] = None, limit: int = 50):
    """Get prediction history."""
    predictions = get_predictions(symbol=symbol, limit=limit)
    return {"predictions": predictions}


@app.put("/api/predictions/{prediction_id}/outcome")
def api_update_outcome(prediction_id: int, outcome: PredictionOutcome):
    """Update prediction outcome for accuracy tracking."""
    update_prediction_outcome(prediction_id, outcome.outcome, outcome.price)
    return {"message": "Prediction outcome updated"}


@app.get("/api/analytics")
def api_get_analytics():
    """Get prediction accuracy stats and pattern analytics."""
    pred_stats = get_prediction_stats()

    # Pattern distribution
    patterns = get_patterns(limit=500)
    pattern_counts = {}
    for p in patterns:
        pt = p["pattern_type"]
        pattern_counts[pt] = pattern_counts.get(pt, 0) + 1

    # News sentiment distribution
    news = get_news(limit=500)
    sentiment_counts = {"bullish": 0, "bearish": 0, "neutral": 0, "pending": 0}
    for n in news:
        s = n.get("sentiment", "pending")
        sentiment_counts[s] = sentiment_counts.get(s, 0) + 1

    return {
        "predictions": pred_stats,
        "patterns": {
            "total": len(patterns),
            "distribution": pattern_counts,
        },
        "news_sentiment": sentiment_counts,
    }


@app.get("/api/status")
def api_status():
    """API health check and usage status."""
    ai_status = get_api_status()
    return {
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "gemini_api": ai_status,
    }


# ═══════════════════════════════════════════════════════════════════════════
# DASHBOARD ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/dashboard")
def api_dashboard():
    """Get all data needed for the dashboard page."""
    # Watchlist with prices
    watchlist = get_watchlist()
    enriched_watchlist = []
    for item in watchlist:
        quote = get_quick_quote(item["symbol"])
        enriched_watchlist.append({**item, **quote})

    # Recent patterns
    recent_patterns = get_patterns(limit=10)

    # Recent news
    recent_news = get_news(limit=10)

    # Prediction stats
    pred_stats = get_prediction_stats()

    return {
        "watchlist": enriched_watchlist,
        "recent_patterns": recent_patterns,
        "recent_news": recent_news,
        "prediction_stats": pred_stats,
    }


# ═══════════════════════════════════════════════════════════════════════════
# BACKGROUND TASKS
# ═══════════════════════════════════════════════════════════════════════════

def fetch_and_store_news():
    """Background task: fetch news and store in database."""
    print("📰 Fetching news from all sources...")
    articles = fetch_all_feeds()
    stored = 0
    for article in articles:
        article_id = save_article(
            source=article["source"],
            title=article["title"],
            content=article.get("content", ""),
            url=article["url"],
            published_date=article["published_date"],
            symbols=article.get("symbols_mentioned", []),
        )
        if article_id:
            stored += 1
    print(f"✅ Stored {stored} new articles out of {len(articles)} fetched")


# ═══════════════════════════════════════════════════════════════════════════
# SEARCH ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/search/{query}")
def api_search_stock(query: str):
    """Search for Indian stocks by symbol or name."""
    from news_scraper import COMMON_STOCKS

    results = []
    query_upper = query.upper()

    for symbol, aliases in COMMON_STOCKS.items():
        if query_upper in symbol or any(query_upper in a.upper() for a in aliases):
            results.append({
                "symbol": symbol,
                "name": aliases[0] if aliases else symbol,
            })

    return {"results": results[:20]}


# ─── Run ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
