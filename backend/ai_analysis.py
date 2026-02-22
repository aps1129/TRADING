"""
AI Analysis Module — Multi-Provider Architecture
==================================================
Primary:  Groq (Llama 3.3 70B) — 14,400 req/day free, blazing fast
Fallback: Gemini 2.0 Flash — 1,500 req/day free
Local:    Financial NLP lexicon — no API needed, instant

Includes retry logic, response caching, and graceful degradation.
"""

import json
import time
import os
import re
import hashlib
import requests as http_requests
from datetime import datetime
from dotenv import load_dotenv
from collections import Counter

# Load .env from the backend directory
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)
else:
    load_dotenv()

# ─── Configuration ────────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Groq — Primary provider
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

# Gemini — Fallback provider
GEMINI_MODEL = "gemini-2.0-flash"

# Rate limiting
_last_request_time = 0
MIN_REQUEST_INTERVAL = 2.5  # seconds between requests
_daily_request_count = 0
_daily_reset_date = datetime.now().date()
MAX_DAILY_REQUESTS = 14000  # Groq allows 14,400

# Response Cache
_cache = {}
CACHE_TTL = 3600  # 1 hour


# ═══════════════════════════════════════════════════════════════════════════
# FINANCIAL NLP LEXICON — Rule-based sentiment (no API needed)
# Based on Loughran-McDonald Financial Sentiment Dictionary
# ═══════════════════════════════════════════════════════════════════════════

BULLISH_WORDS = {
    # Strong bullish
    "surge": 3, "soar": 3, "rally": 3, "breakout": 3, "boom": 3,
    "skyrocket": 3, "outperform": 3, "upgrade": 3, "record high": 3,
    "all-time high": 3, "bullish": 3, "golden cross": 3, "accumulate": 3,
    # Medium bullish
    "gain": 2, "rise": 2, "jump": 2, "climb": 2, "advance": 2,
    "recover": 2, "rebound": 2, "uptick": 2, "growth": 2, "profit": 2,
    "positive": 2, "strong": 2, "beat": 2, "exceed": 2, "upbeat": 2,
    "optimistic": 2, "momentum": 2, "buy": 2, "overweight": 2,
    "expand": 2, "dividend": 2, "bonus": 2, "buyback": 2,
    "acquisition": 2, "partnership": 2, "innovation": 2,
    # Mild bullish
    "up": 1, "higher": 1, "increase": 1, "improve": 1, "steady": 1,
    "stable": 1, "support": 1, "resilient": 1, "opportunity": 1,
    "favorable": 1, "promising": 1, "robust": 1, "healthy": 1,
}

BEARISH_WORDS = {
    # Strong bearish
    "crash": -3, "plunge": -3, "collapse": -3, "slump": -3,
    "freefall": -3, "death cross": -3, "bankruptcy": -3, "default": -3,
    "scam": -3, "fraud": -3, "sell-off": -3, "bear market": -3,
    "crisis": -3, "recession": -3,
    # Medium bearish
    "fall": -2, "drop": -2, "decline": -2, "loss": -2, "sell": -2,
    "downgrade": -2, "underperform": -2, "bearish": -2, "weak": -2,
    "negative": -2, "miss": -2, "concern": -2, "risk": -2,
    "volatility": -2, "uncertainty": -2, "headwind": -2, "warning": -2,
    "layoff": -2, "cut": -2, "penalty": -2, "investigation": -2,
    "deficit": -2, "debt": -2, "downside": -2,
    # Mild bearish
    "down": -1, "lower": -1, "decrease": -1, "pressure": -1,
    "caution": -1, "challenge": -1, "slow": -1, "flat": -1,
    "resistance": -1, "correction": -1, "pullback": -1, "fade": -1,
}

INTENSITY_MODIFIERS = {
    "very": 1.5, "extremely": 2.0, "significantly": 1.5, "sharply": 1.8,
    "massive": 2.0, "huge": 1.8, "major": 1.5, "big": 1.3,
    "slightly": 0.5, "marginally": 0.4, "modest": 0.6, "minor": 0.5,
}

NEGATION_WORDS = {"not", "no", "never", "neither", "nor", "hardly", "barely", "unlikely", "despite", "without"}

SECTOR_KEYWORDS = {
    "RELIANCE": ["reliance", "ril", "jio", "mukesh ambani"],
    "TCS": ["tcs", "tata consultancy"],
    "INFY": ["infosys", "infy", "narayana murthy"],
    "HDFCBANK": ["hdfc bank", "hdfcbank"],
    "ICICIBANK": ["icici bank", "icicibank"],
    "SBIN": ["sbi", "state bank"],
    "BHARTIARTL": ["airtel", "bharti airtel"],
    "ITC": ["itc"],
    "WIPRO": ["wipro"],
    "HINDUNILVR": ["hindustan unilever", "hul"],
    "TATAMOTORS": ["tata motors"],
    "MARUTI": ["maruti", "maruti suzuki"],
    "BAJFINANCE": ["bajaj finance"],
    "SUNPHARMA": ["sun pharma"],
    "ADANIENT": ["adani"],
    "TATASTEEL": ["tata steel"],
    "KOTAKBANK": ["kotak"],
    "AXISBANK": ["axis bank"],
    "LT": ["larsen", "l&t"],
    "HCLTECH": ["hcl tech"],
    "TITAN": ["titan"],
    "NTPC": ["ntpc"],
    "ONGC": ["ongc"],
    "POWERGRID": ["power grid"],
    "TECHM": ["tech mahindra"],
    "NIFTY": ["nifty", "nifty50", "nifty 50", "index"],
    "SENSEX": ["sensex", "bse"],
}


def analyze_sentiment_local(title: str, content: str) -> dict:
    """
    Advanced rule-based financial sentiment analysis.
    Uses Loughran-McDonald inspired lexicon with:
    - Intensity modifiers (very, extremely, etc.)
    - Negation detection (not, never, etc.)
    - Context-aware scoring
    - Stock symbol detection
    No API needed — instant results.
    """
    text = f"{title} {content}".lower()
    words = re.findall(r'\b\w+\b', text)
    bigrams = [f"{words[i]} {words[i+1]}" for i in range(len(words)-1)]
    trigrams = [f"{words[i]} {words[i+1]} {words[i+2]}" for i in range(len(words)-2)]
    all_phrases = words + bigrams + trigrams

    score = 0
    bullish_hits = []
    bearish_hits = []
    total_signals = 0

    for i, word in enumerate(words):
        # Check for bullish words
        for phrase, weight in BULLISH_WORDS.items():
            if phrase in text:
                # Check for negation in preceding 3 words
                preceding = words[max(0, i-3):i]
                if any(neg in preceding for neg in NEGATION_WORDS):
                    score -= weight  # Negated bullish = bearish
                    bearish_hits.append(f"NOT {phrase}")
                else:
                    # Check for intensity modifiers
                    modifier = 1.0
                    for mod_word, mod_val in INTENSITY_MODIFIERS.items():
                        if mod_word in preceding:
                            modifier = mod_val
                            break
                    score += weight * modifier
                    bullish_hits.append(phrase)
                total_signals += 1

        # Check for bearish words
        for phrase, weight in BEARISH_WORDS.items():
            if phrase in text:
                preceding = words[max(0, i-3):i]
                if any(neg in preceding for neg in NEGATION_WORDS):
                    score += abs(weight)  # Negated bearish = bullish
                    bullish_hits.append(f"NOT {phrase}")
                else:
                    modifier = 1.0
                    for mod_word, mod_val in INTENSITY_MODIFIERS.items():
                        if mod_word in preceding:
                            modifier = mod_val
                            break
                    score += weight * modifier
                    bearish_hits.append(phrase)
                total_signals += 1

    # Detect affected stocks
    affected = []
    for symbol, keywords in SECTOR_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                affected.append(symbol)
                break

    # Title has 2x weight — headlines matter more
    title_lower = title.lower()
    for phrase, weight in BULLISH_WORDS.items():
        if phrase in title_lower:
            score += weight * 2

    for phrase, weight in BEARISH_WORDS.items():
        if phrase in title_lower:
            score += weight * 2

    # Normalize score to sentiment
    if total_signals == 0:
        total_signals = 1

    normalized = score / max(total_signals, 1)

    if normalized > 1.5:
        sentiment = "bullish"
        confidence = min(92, 60 + int(abs(normalized) * 8))
    elif normalized < -1.5:
        sentiment = "bearish"
        confidence = min(92, 60 + int(abs(normalized) * 8))
    elif normalized > 0.5:
        sentiment = "bullish"
        confidence = min(70, 40 + int(abs(normalized) * 10))
    elif normalized < -0.5:
        sentiment = "bearish"
        confidence = min(70, 40 + int(abs(normalized) * 10))
    else:
        sentiment = "neutral"
        confidence = max(30, 50 - int(abs(normalized) * 5))

    # Determine impact
    if len(affected) >= 3 or abs(score) > 15:
        impact = "high"
    elif len(affected) >= 1 or abs(score) > 8:
        impact = "medium"
    else:
        impact = "low"

    # Key points
    key_points = []
    if bullish_hits:
        top_bull = list(set(bullish_hits))[:3]
        key_points.append(f"Bullish signals: {', '.join(top_bull)}")
    if bearish_hits:
        top_bear = list(set(bearish_hits))[:3]
        key_points.append(f"Bearish signals: {', '.join(top_bear)}")
    if affected:
        key_points.append(f"Stocks mentioned: {', '.join(affected[:5])}")
    if not key_points:
        key_points.append("No strong directional signals detected")

    return {
        "sentiment": sentiment,
        "confidence": confidence,
        "key_points": key_points[:5],
        "affected_stocks": affected[:10],
        "impact": impact,
        "summary": title,
        "analysis_method": "financial_nlp_lexicon",
        "raw_score": round(normalized, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════
# CACHE SYSTEM
# ═══════════════════════════════════════════════════════════════════════════

def _get_cache_key(prompt: str) -> str:
    return hashlib.md5(prompt.encode()).hexdigest()


def _get_cached(prompt: str):
    key = _get_cache_key(prompt)
    if key in _cache:
        entry = _cache[key]
        if time.time() - entry["timestamp"] < CACHE_TTL:
            return entry["response"]
        else:
            del _cache[key]
    return None


def _set_cache(prompt: str, response: str):
    key = _get_cache_key(prompt)
    _cache[key] = {"response": response, "timestamp": time.time()}
    if len(_cache) > 300:
        oldest_key = min(_cache, key=lambda k: _cache[k]["timestamp"])
        del _cache[oldest_key]


# ═══════════════════════════════════════════════════════════════════════════
# RATE LIMITING
# ═══════════════════════════════════════════════════════════════════════════

def _rate_limit():
    global _last_request_time, _daily_request_count, _daily_reset_date

    today = datetime.now().date()
    if today != _daily_reset_date:
        _daily_request_count = 0
        _daily_reset_date = today

    if _daily_request_count >= MAX_DAILY_REQUESTS:
        raise Exception("Daily API limit reached. Try again tomorrow.")

    elapsed = time.time() - _last_request_time
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)

    _last_request_time = time.time()
    _daily_request_count += 1


# ═══════════════════════════════════════════════════════════════════════════
# GROQ PROVIDER (Primary — Llama 3.3 70B)
# ═══════════════════════════════════════════════════════════════════════════

def _call_groq(prompt: str) -> str:
    """Call Groq API with Llama 3.3 70B."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": "You are an expert Indian stock market analyst. Always respond with valid JSON only, no markdown formatting."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 1500,
    }

    response = http_requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)

    if response.status_code == 429:
        raise Exception("Groq rate limit hit")
    if response.status_code != 200:
        raise Exception(f"Groq API error {response.status_code}: {response.text[:200]}")

    data = response.json()
    return data["choices"][0]["message"]["content"]


# ═══════════════════════════════════════════════════════════════════════════
# GEMINI PROVIDER (Fallback)
# ═══════════════════════════════════════════════════════════════════════════

def _call_gemini(prompt: str) -> str:
    """Call Gemini API as fallback."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set")

    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        raise Exception(f"Gemini error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════
# UNIFIED GENERATE — Multi-provider with fallback chain
# ═══════════════════════════════════════════════════════════════════════════

def _generate(prompt: str) -> str:
    """
    Generate AI content with multi-provider fallback:
    1. Check cache
    2. Try Groq (primary)
    3. Try Gemini (fallback)
    4. Raise if all fail
    """
    # Cache check
    cached = _get_cached(prompt)
    if cached:
        return cached

    _rate_limit()

    errors = []

    # Provider 1: Groq (primary)
    if GROQ_API_KEY:
        for attempt in range(2):
            try:
                result = _call_groq(prompt)
                _set_cache(prompt, result)
                return result
            except Exception as e:
                errors.append(f"Groq (attempt {attempt+1}): {str(e)}")
                if "rate limit" in str(e).lower() and attempt < 1:
                    time.sleep(5)

    # Provider 2: Gemini (fallback)
    if GEMINI_API_KEY:
        for attempt in range(2):
            try:
                result = _call_gemini(prompt)
                _set_cache(prompt, result)
                return result
            except Exception as e:
                errors.append(f"Gemini (attempt {attempt+1}): {str(e)}")
                if "429" in str(e) and attempt < 1:
                    time.sleep(10)

    raise Exception(f"All AI providers failed: {'; '.join(errors)}")


def _clean_json_response(response: str) -> str:
    """Clean markdown/code-fenced JSON from AI response."""
    response = response.strip()
    if response.startswith("```"):
        response = response.split("\n", 1)[1] if "\n" in response else response
    if response.endswith("```"):
        response = response.rsplit("```", 1)[0]
    response = response.replace("```json", "").replace("```", "").strip()
    return response


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC API — Pattern Explanation
# ═══════════════════════════════════════════════════════════════════════════

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
        # Fallback: generate rule-based explanation
        signal = pattern.get("signal", "neutral")
        if signal == "bullish":
            return f"📈 {pattern['type']} is a bullish technical signal detected on {symbol} at ₹{current_price}. {pattern['description']}. This suggests potential upward momentum. However, always confirm with other indicators and never rely on a single pattern. This is not financial advice."
        elif signal == "bearish":
            return f"📉 {pattern['type']} is a bearish technical signal detected on {symbol} at ₹{current_price}. {pattern['description']}. This suggests potential downward pressure. Monitor support levels and volume for confirmation. This is not financial advice."
        else:
            return f"📊 {pattern['type']} detected on {symbol} at ₹{current_price}. {pattern['description']}. This is a neutral signal indicating market indecision. Watch for follow-up candles and volume changes. This is not financial advice."


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC API — News Sentiment Analysis (Hybrid: AI + Local NLP)
# ═══════════════════════════════════════════════════════════════════════════

def analyze_news_sentiment(title: str, content: str) -> dict:
    """
    Analyze news sentiment using hybrid approach:
    1. Always run local NLP first (instant, free)
    2. Enhance with AI if available
    3. Combine scores for higher accuracy
    """
    # Step 1: Local NLP analysis (always available)
    local_result = analyze_sentiment_local(title, content)

    # Step 2: Try AI enhancement
    try:
        ai_result = _analyze_sentiment_ai(title, content)

        # Step 3: Combine results (weighted average)
        # AI gets 60% weight, local NLP gets 40%
        combined = _combine_sentiment(local_result, ai_result)
        combined["analysis_method"] = "hybrid_ai_nlp"
        return combined

    except Exception:
        # AI unavailable — local NLP result is still good
        return local_result


def _analyze_sentiment_ai(title: str, content: str) -> dict:
    """AI-powered sentiment analysis."""
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

    response = _generate(prompt)
    response = _clean_json_response(response)
    result = json.loads(response)

    # Validate
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


def _combine_sentiment(local: dict, ai: dict) -> dict:
    """Combine local NLP and AI sentiment for higher accuracy."""
    # Score mapping
    score_map = {"bullish": 1, "neutral": 0, "bearish": -1}

    local_score = score_map.get(local["sentiment"], 0) * local["confidence"]
    ai_score = score_map.get(ai["sentiment"], 0) * ai["confidence"]

    # Weighted combination: AI 60%, Local 40%
    combined_score = (ai_score * 0.6) + (local_score * 0.4)

    # Convert back to sentiment
    combined_confidence = (ai["confidence"] * 0.6) + (local["confidence"] * 0.4)

    if combined_score > 15:
        sentiment = "bullish"
    elif combined_score < -15:
        sentiment = "bearish"
    else:
        sentiment = "neutral"

    # Merge key points
    all_points = list(set(ai.get("key_points", []) + local.get("key_points", [])))

    # Merge affected stocks
    all_stocks = list(set(ai.get("affected_stocks", []) + local.get("affected_stocks", [])))

    # Take the higher impact
    impact_order = {"high": 3, "medium": 2, "low": 1}
    ai_impact = impact_order.get(ai.get("impact", "low"), 1)
    local_impact = impact_order.get(local.get("impact", "low"), 1)
    impact = "high" if max(ai_impact, local_impact) == 3 else "medium" if max(ai_impact, local_impact) == 2 else "low"

    return {
        "sentiment": sentiment,
        "confidence": round(combined_confidence, 1),
        "key_points": all_points[:5],
        "affected_stocks": all_stocks[:10],
        "impact": impact,
        "summary": ai.get("summary", local.get("summary", "")),
    }


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC API — Stock Prediction
# ═══════════════════════════════════════════════════════════════════════════

def generate_prediction(symbol: str, stock_data: dict, patterns: list,
                        indicators: dict, news_articles: list = None) -> dict:
    """Generate AI prediction combining technicals + sentiment + patterns."""

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
        response = _clean_json_response(response)
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
        return _generate_local_prediction(symbol, stock_data, patterns, indicators)
    except Exception as e:
        return _generate_local_prediction(symbol, stock_data, patterns, indicators)


def _generate_local_prediction(symbol: str, stock_data: dict, patterns: list, indicators: dict) -> dict:
    """Generate prediction using rule-based analysis when AI is unavailable."""
    score = 0
    reasons = []
    risks = []

    current_price = stock_data.get("current_price", 0)
    rsi = indicators.get("current_rsi", 50)
    macd = indicators.get("current_macd", 0)
    support = indicators.get("support", current_price * 0.95)
    resistance = indicators.get("resistance", current_price * 1.05)

    # RSI analysis
    if rsi > 70:
        score -= 2
        reasons.append(f"RSI at {rsi:.1f} indicates overbought conditions")
        risks.append("Overbought territory — correction possible")
    elif rsi < 30:
        score += 2
        reasons.append(f"RSI at {rsi:.1f} indicates oversold conditions — potential bounce")
    elif rsi > 50:
        score += 1
        reasons.append(f"RSI at {rsi:.1f} shows moderate bullish momentum")
    else:
        score -= 1
        reasons.append(f"RSI at {rsi:.1f} shows moderate bearish momentum")

    # MACD analysis
    if macd > 0:
        score += 1
        reasons.append("MACD is positive, indicating upward momentum")
    else:
        score -= 1
        reasons.append("MACD is negative, indicating downward momentum")

    # Pattern analysis
    for p in patterns:
        if p.get("signal") == "bullish":
            score += 1
        elif p.get("signal") == "bearish":
            score -= 1

    if len(patterns) > 0:
        bull_count = sum(1 for p in patterns if p.get("signal") == "bullish")
        bear_count = sum(1 for p in patterns if p.get("signal") == "bearish")
        reasons.append(f"{len(patterns)} patterns detected: {bull_count} bullish, {bear_count} bearish")

    # SMA analysis
    sma50 = indicators.get("current_sma_50")
    sma200 = indicators.get("current_sma_200")
    if sma50 and sma200:
        if current_price > sma50 > sma200:
            score += 2
            reasons.append("Price above both SMA 50 and SMA 200 — strong uptrend")
        elif current_price < sma50 < sma200:
            score -= 2
            reasons.append("Price below both SMA 50 and SMA 200 — strong downtrend")
            risks.append("Below key moving averages")

    # Determine direction
    if score >= 2:
        direction = "bullish"
        confidence = min(80, 55 + score * 5)
    elif score <= -2:
        direction = "bearish"
        confidence = min(80, 55 + abs(score) * 5)
    else:
        direction = "neutral"
        confidence = max(35, 50 - abs(score) * 5)

    risks.append("Market conditions can change rapidly")
    risks.append("This is rule-based analysis without AI enhancement")

    return {
        "direction": direction,
        "confidence": confidence,
        "reasoning": ". ".join(reasons[:3]),
        "short_term_outlook": f"Based on {len(patterns)} technical patterns and indicator readings, the short-term outlook is {direction}.",
        "risk_factors": risks[:4],
        "key_levels": {
            "support": round(support, 2),
            "resistance": round(resistance, 2),
            "stop_loss": round(support * 0.97, 2),
            "target": round(resistance * 1.03, 2),
        },
        "recommendation_summary": f"Technical indicators suggest a {direction} bias with {confidence}% confidence. Always do your own research.",
        "disclaimer": "This is rule-based analysis for educational purposes only. Not financial advice.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC API — Status
# ═══════════════════════════════════════════════════════════════════════════

def get_api_status() -> dict:
    """Get current API usage status."""
    return {
        "daily_requests_used": _daily_request_count,
        "daily_limit": MAX_DAILY_REQUESTS,
        "remaining": MAX_DAILY_REQUESTS - _daily_request_count,
        "api_configured": bool(GROQ_API_KEY or GEMINI_API_KEY),
        "providers": {
            "groq": {"configured": bool(GROQ_API_KEY), "model": GROQ_MODEL},
            "gemini": {"configured": bool(GEMINI_API_KEY), "model": GEMINI_MODEL},
            "local_nlp": {"configured": True, "model": "financial_lexicon_v1"},
        },
    }
