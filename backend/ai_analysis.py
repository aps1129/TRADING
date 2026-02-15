"""
AI Analysis Module
Handles all Gemini API interactions for explanations, sentiment, and predictions.
Rate-limited to stay within free tier (15 req/min, 1500/day).
"""

import google.generativeai as genai
import json
import time
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ─── Configuration ────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-2.0-flash"

# Rate limiting
_last_request_time = 0
MIN_REQUEST_INTERVAL = 4.5  # ~13 requests per minute, under the 15/min limit
_daily_request_count = 0
_daily_reset_date = datetime.now().date()
MAX_DAILY_REQUESTS = 1400  # buffer below 1500 limit


def _configure():
    """Configure the Gemini API."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set. Set it in .env (local) or Vercel Environment Variables.")
    genai.configure(api_key=GEMINI_API_KEY)


def _rate_limit():
    """Enforce rate limiting."""
    global _last_request_time, _daily_request_count, _daily_reset_date

    today = datetime.now().date()
    if today != _daily_reset_date:
        _daily_request_count = 0
        _daily_reset_date = today

    if _daily_request_count >= MAX_DAILY_REQUESTS:
        raise Exception("Daily Gemini API limit reached. Try again tomorrow.")

    elapsed = time.time() - _last_request_time
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)

    _last_request_time = time.time()
    _daily_request_count += 1


def _generate(prompt: str) -> str:
    """Generate content using Gemini API with rate limiting."""
    _configure()
    _rate_limit()

    model = genai.GenerativeModel(MODEL_NAME)
    response = model.generate_content(prompt)
    return response.text


# ─── Pattern Explanation ──────────────────────────────────────────────────

def explain_pattern(symbol: str, pattern: dict, current_price: float) -> str:
    """Get AI explanation for a detected technical pattern."""
    prompt = f"""You are a friendly stock market analyst explaining technical patterns to beginners in India.

Stock: {symbol}
Current Price: ₹{current_price}
Pattern Detected: {pattern['type']}
Description: {pattern['description']}
Signal: {pattern['signal']}

Explain this pattern in simple, beginner-friendly language (150 words max):
1. What this pattern means
2. Why it matters for this stock
3. What investors should watch for next
4. Any important caveat

Keep it conversational and use Indian Rupee (₹) for prices. Do NOT give direct buy/sell advice."""

    try:
        return _generate(prompt)
    except Exception as e:
        return f"AI explanation unavailable: {str(e)}"


# ─── News Sentiment Analysis ─────────────────────────────────────────────

def analyze_news_sentiment(title: str, content: str) -> dict:
    """Analyze a news article's sentiment using Gemini."""
    prompt = f"""Analyze this Indian stock market news article and return ONLY valid JSON (no markdown, no backticks):

Title: {title}
Content: {content[:2000]}

Return this exact JSON structure:
{{
    "sentiment": "bullish" or "bearish" or "neutral",
    "confidence": <number 0-100>,
    "key_points": ["point1", "point2", "point3"],
    "affected_stocks": ["SYMBOL1", "SYMBOL2"],
    "impact": "high" or "medium" or "low",
    "summary": "one line summary"
}}

Use NSE stock symbols (e.g., RELIANCE, TCS, INFY). If no specific stocks are mentioned, return empty array.
Be accurate with sentiment - only mark bullish/bearish if there's clear evidence."""

    try:
        response = _generate(prompt)

        # Clean up the response - sometimes Gemini adds markdown
        response = response.strip()
        if response.startswith("```"):
            response = response.split("\n", 1)[1] if "\n" in response else response
        if response.endswith("```"):
            response = response.rsplit("```", 1)[0]
        response = response.replace("```json", "").replace("```", "").strip()

        result = json.loads(response)

        # Validate and set defaults
        valid_sentiments = ["bullish", "bearish", "neutral"]
        if result.get("sentiment") not in valid_sentiments:
            result["sentiment"] = "neutral"
        result["confidence"] = min(100, max(0, float(result.get("confidence", 50))))
        result["key_points"] = result.get("key_points", [])[:5]
        result["affected_stocks"] = result.get("affected_stocks", [])
        result["impact"] = result.get("impact", "medium")
        if result["impact"] not in ["high", "medium", "low"]:
            result["impact"] = "medium"
        result["summary"] = result.get("summary", "")

        return result

    except json.JSONDecodeError:
        return {
            "sentiment": "neutral",
            "confidence": 30,
            "key_points": ["AI analysis parsing failed"],
            "affected_stocks": [],
            "impact": "low",
            "summary": title,
        }
    except Exception as e:
        return {
            "sentiment": "neutral",
            "confidence": 0,
            "key_points": [f"Error: {str(e)}"],
            "affected_stocks": [],
            "impact": "low",
            "summary": title,
        }


# ─── Stock Prediction ────────────────────────────────────────────────────

def generate_prediction(symbol: str, stock_data: dict, patterns: list,
                        indicators: dict, news_articles: list = None) -> dict:
    """Generate AI prediction by combining technical analysis and news sentiment."""

    # Build context
    pattern_text = "\n".join([
        f"- {p['type']}: {p['description']} (Signal: {p['signal']}, Confidence: {p['confidence']}%)"
        for p in patterns
    ]) if patterns else "No significant patterns detected."

    indicator_text = f"""
RSI: {indicators.get('current_rsi', 'N/A')}
MACD: {indicators.get('current_macd', 'N/A')}
SMA 50: {indicators.get('current_sma_50', 'N/A')}
SMA 200: {indicators.get('current_sma_200', 'N/A')}
Support: ₹{indicators.get('support', 'N/A')}
Resistance: ₹{indicators.get('resistance', 'N/A')}
"""

    news_text = ""
    if news_articles:
        for article in news_articles[:5]:
            news_text += f"- {article.get('title', '')} (Sentiment: {article.get('sentiment', 'unknown')})\n"
    else:
        news_text = "No recent news available."

    prompt = f"""You are an expert Indian stock market analyst. Analyze the following data and provide a prediction.

Stock: {symbol}
Current Price: ₹{stock_data.get('current_price', 'N/A')}
Change Today: {stock_data.get('change_percent', 0)}%

Technical Patterns:
{pattern_text}

Technical Indicators:
{indicator_text}

Recent News:
{news_text}

Based on this analysis, return ONLY valid JSON (no markdown, no backticks):
{{
    "direction": "bullish" or "bearish" or "neutral",
    "confidence": <number 0-100>,
    "short_term_outlook": "1-2 weeks outlook in 1-2 sentences",
    "reasoning": "2-3 sentences explaining why",
    "risk_factors": ["risk1", "risk2", "risk3"],
    "key_levels": {{
        "support": <price number>,
        "resistance": <price number>,
        "stop_loss": <price number>,
        "target": <price number>
    }},
    "recommendation_summary": "One line for beginners"
}}

Important: Use Indian Rupee (₹). Be balanced and honest. Do NOT give direct buy/sell advice.
State this is AI analysis, not financial advice."""

    try:
        response = _generate(prompt)

        # Clean up
        response = response.strip()
        if response.startswith("```"):
            response = response.split("\n", 1)[1] if "\n" in response else response
        if response.endswith("```"):
            response = response.rsplit("```", 1)[0]
        response = response.replace("```json", "").replace("```", "").strip()

        result = json.loads(response)

        # Validate
        if result.get("direction") not in ["bullish", "bearish", "neutral"]:
            result["direction"] = "neutral"
        result["confidence"] = min(100, max(0, float(result.get("confidence", 50))))
        result["risk_factors"] = result.get("risk_factors", [])[:5]
        result["key_levels"] = result.get("key_levels", {})
        result["reasoning"] = result.get("reasoning", "Unable to generate detailed reasoning.")
        result["short_term_outlook"] = result.get("short_term_outlook", "")
        result["recommendation_summary"] = result.get("recommendation_summary", "")
        result["disclaimer"] = "This is AI-generated analysis for educational purposes only. Not financial advice."

        return result

    except json.JSONDecodeError:
        return {
            "direction": "neutral",
            "confidence": 30,
            "reasoning": "AI prediction parsing failed. Please retry.",
            "short_term_outlook": "Unable to determine.",
            "risk_factors": ["AI analysis error"],
            "key_levels": {},
            "recommendation_summary": "Analysis temporarily unavailable.",
            "disclaimer": "This is AI-generated analysis. Not financial advice.",
        }
    except Exception as e:
        return {
            "direction": "neutral",
            "confidence": 0,
            "reasoning": f"Error: {str(e)}",
            "short_term_outlook": "Unable to determine.",
            "risk_factors": [str(e)],
            "key_levels": {},
            "recommendation_summary": "Analysis temporarily unavailable.",
            "disclaimer": "This is AI-generated analysis. Not financial advice.",
        }


def get_api_status() -> dict:
    """Get current API usage status."""
    return {
        "daily_requests_used": _daily_request_count,
        "daily_limit": MAX_DAILY_REQUESTS,
        "remaining": MAX_DAILY_REQUESTS - _daily_request_count,
        "api_configured": bool(GEMINI_API_KEY),
    }
