"""
Technical Analysis Module
Handles stock data fetching and pattern detection using yfinance.
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def fetch_stock_data(symbol: str, period: str = "6mo") -> dict:
    """
    Fetch stock data from Yahoo Finance.
    For Indian NSE stocks, appends .NS suffix.
    """
    ticker_symbol = f"{symbol}.NS"
    ticker = yf.Ticker(ticker_symbol)

    try:
        hist = ticker.history(period=period)
        if hist.empty:
            # Try BSE
            ticker_symbol = f"{symbol}.BO"
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(period=period)

        if hist.empty:
            return {"error": f"No data found for {symbol}"}

        info = {}
        try:
            info = ticker.info or {}
        except Exception:
            pass

        # Format historical data
        hist_data = []
        for date, row in hist.iterrows():
            hist_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })

        current_price = round(float(hist["Close"].iloc[-1]), 2) if len(hist) > 0 else 0
        prev_close = round(float(hist["Close"].iloc[-2]), 2) if len(hist) > 1 else current_price
        change = round(current_price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close > 0 else 0

        return {
            "symbol": symbol.upper(),
            "ticker": ticker_symbol,
            "name": info.get("longName", info.get("shortName", symbol.upper())),
            "current_price": current_price,
            "previous_close": prev_close,
            "change": change,
            "change_percent": change_pct,
            "day_high": round(float(hist["High"].iloc[-1]), 2) if len(hist) > 0 else 0,
            "day_low": round(float(hist["Low"].iloc[-1]), 2) if len(hist) > 0 else 0,
            "volume": int(hist["Volume"].iloc[-1]) if len(hist) > 0 else 0,
            "market_cap": info.get("marketCap", 0),
            "pe_ratio": info.get("trailingPE", 0),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "history": hist_data,
        }

    except Exception as e:
        return {"error": str(e)}


def fetch_intraday_data(symbol: str, interval: str = "5m") -> dict:
    """
    Fetch intraday candlestick data for real-time chart analysis.
    Intervals: 1m, 2m, 5m, 15m, 30m, 60m, 1h
    yfinance provides ~15 min delayed data for free.
    """
    ticker_symbol = f"{symbol}.NS"
    ticker = yf.Ticker(ticker_symbol)

    # Select period based on interval
    period_map = {
        "1m": "2d",    # 1-min candles: max 7 days, use 2
        "2m": "5d",
        "5m": "5d",    # 5-min candles: 5 days
        "15m": "10d",
        "30m": "1mo",
        "60m": "1mo",
        "1h": "1mo",
    }
    period = period_map.get(interval, "5d")

    try:
        hist = ticker.history(period=period, interval=interval)
        if hist.empty:
            # Try BSE
            ticker_symbol = f"{symbol}.BO"
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(period=period, interval=interval)

        if hist.empty:
            return {"error": f"No intraday data found for {symbol}"}

        candles = []
        for ts, row in hist.iterrows():
            candles.append({
                "time": ts.strftime("%Y-%m-%d %H:%M"),
                "date": ts.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })

        current_price = candles[-1]["close"] if candles else 0
        prev_close = candles[0]["open"] if candles else current_price
        change = round(current_price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close > 0 else 0

        return {
            "symbol": symbol.upper(),
            "interval": interval,
            "candles": candles,
            "current_price": current_price,
            "change": change,
            "change_percent": change_pct,
        }

    except Exception as e:
        return {"error": str(e)}

def calculate_indicators(hist_data: list) -> dict:
    """Calculate technical indicators from historical price data."""
    if not hist_data or len(hist_data) < 20:
        return {"error": "Insufficient data for indicator calculations"}

    df = pd.DataFrame(hist_data)
    close = df["close"].astype(float)
    high = df["high"].astype(float)
    low = df["low"].astype(float)

    indicators = {}

    # ─── Moving Averages ──────────────────────────────────────────────
    indicators["sma_20"] = _safe_round_series(close.rolling(window=20).mean())
    indicators["sma_50"] = _safe_round_series(close.rolling(window=50).mean())
    indicators["sma_200"] = _safe_round_series(close.rolling(window=200).mean())
    indicators["ema_12"] = _safe_round_series(close.ewm(span=12, adjust=False).mean())
    indicators["ema_26"] = _safe_round_series(close.ewm(span=26, adjust=False).mean())

    # ─── RSI (14-period) ──────────────────────────────────────────────
    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    indicators["rsi"] = _safe_round_series(rsi)

    # ─── MACD ─────────────────────────────────────────────────────────
    macd_line = close.ewm(span=12).mean() - close.ewm(span=26).mean()
    signal_line = macd_line.ewm(span=9).mean()
    macd_histogram = macd_line - signal_line
    indicators["macd_line"] = _safe_round_series(macd_line)
    indicators["macd_signal"] = _safe_round_series(signal_line)
    indicators["macd_histogram"] = _safe_round_series(macd_histogram)

    # ─── Bollinger Bands (20-period) ──────────────────────────────────
    bb_middle = close.rolling(window=20).mean()
    bb_std = close.rolling(window=20).std()
    indicators["bb_upper"] = _safe_round_series(bb_middle + (bb_std * 2))
    indicators["bb_middle"] = _safe_round_series(bb_middle)
    indicators["bb_lower"] = _safe_round_series(bb_middle - (bb_std * 2))

    # ─── Support & Resistance ─────────────────────────────────────────
    recent_close = close.tail(60)
    indicators["support"] = round(float(recent_close.min()), 2)
    indicators["resistance"] = round(float(recent_close.max()), 2)

    # Current values
    indicators["current_rsi"] = round(float(rsi.iloc[-1]), 2) if not pd.isna(rsi.iloc[-1]) else 50.0
    indicators["current_macd"] = round(float(macd_line.iloc[-1]), 2) if not pd.isna(macd_line.iloc[-1]) else 0.0
    indicators["current_sma_50"] = round(float(indicators["sma_50"][-1]), 2) if indicators["sma_50"][-1] is not None else None
    indicators["current_sma_200"] = round(float(indicators["sma_200"][-1]), 2) if indicators["sma_200"][-1] is not None else None

    return indicators


def detect_candlestick_patterns(hist_data: list) -> list:
    """
    Detect Japanese candlestick patterns — the classic patterns
    intraday traders use to read market sentiment.
    """
    if not hist_data or len(hist_data) < 5:
        return []

    df = pd.DataFrame(hist_data)
    o = df["open"].astype(float)
    h = df["high"].astype(float)
    l = df["low"].astype(float)
    c = df["close"].astype(float)
    patterns = []

    # Helper: body size and range
    body = (c - o).abs()
    candle_range = h - l
    avg_body = body.rolling(window=20, min_periods=5).mean()

    for i in range(max(3, len(df) - 15), len(df)):
        date = hist_data[i].get("time", hist_data[i].get("date"))
        b = body.iloc[i]
        r = candle_range.iloc[i]
        ab = avg_body.iloc[i] if not pd.isna(avg_body.iloc[i]) else b

        if r == 0:
            continue

        upper_shadow = h.iloc[i] - max(o.iloc[i], c.iloc[i])
        lower_shadow = min(o.iloc[i], c.iloc[i]) - l.iloc[i]
        is_bull = c.iloc[i] > o.iloc[i]
        is_bear = c.iloc[i] < o.iloc[i]

        # ─── Doji (small body, long wicks) ──────────────────
        if b < r * 0.1 and r > 0:
            patterns.append({
                "type": "Doji",
                "description": f"Doji on {date} — indecision in the market, body is very small relative to the range",
                "signal": "neutral",
                "confidence": 55,
                "date": date,
                "category": "candlestick",
            })

        # ─── Hammer (small body at top, long lower shadow) ──
        elif lower_shadow > b * 2 and upper_shadow < b * 0.5 and is_bull and i > 2:
            # Check if preceded by downtrend
            if c.iloc[i-2] > c.iloc[i-1]:
                patterns.append({
                    "type": "Hammer",
                    "description": f"Hammer on {date} — buyers pushing price up from the low, potential reversal",
                    "signal": "bullish",
                    "confidence": 65,
                    "date": date,
                    "category": "candlestick",
                })

        # ─── Inverted Hammer ─────────────────────────────────
        elif upper_shadow > b * 2 and lower_shadow < b * 0.5 and b > 0 and i > 2:
            if c.iloc[i-2] > c.iloc[i-1]:
                patterns.append({
                    "type": "Inverted Hammer",
                    "description": f"Inverted Hammer on {date} — potential bullish reversal after downtrend",
                    "signal": "bullish",
                    "confidence": 60,
                    "date": date,
                    "category": "candlestick",
                })

        # ─── Bullish Engulfing ───────────────────────────────
        if i > 0 and is_bull:
            prev_bear = c.iloc[i-1] < o.iloc[i-1]
            if prev_bear and o.iloc[i] <= c.iloc[i-1] and c.iloc[i] >= o.iloc[i-1] and b > body.iloc[i-1]:
                patterns.append({
                    "type": "Bullish Engulfing",
                    "description": f"Bullish Engulfing on {date} — green candle fully engulfs prior red candle, strong buy signal",
                    "signal": "bullish",
                    "confidence": 72,
                    "date": date,
                    "category": "candlestick",
                })

        # ─── Bearish Engulfing ───────────────────────────────
        if i > 0 and is_bear:
            prev_bull = c.iloc[i-1] > o.iloc[i-1]
            if prev_bull and o.iloc[i] >= c.iloc[i-1] and c.iloc[i] <= o.iloc[i-1] and b > body.iloc[i-1]:
                patterns.append({
                    "type": "Bearish Engulfing",
                    "description": f"Bearish Engulfing on {date} — red candle fully engulfs prior green candle, strong sell signal",
                    "signal": "bearish",
                    "confidence": 72,
                    "date": date,
                    "category": "candlestick",
                })

        # ─── Morning Star (3-candle bullish reversal) ────────
        if i >= 2:
            c1_bear = c.iloc[i-2] < o.iloc[i-2] and body.iloc[i-2] > ab * 0.5
            c2_small = body.iloc[i-1] < ab * 0.3
            c3_bull = is_bull and b > ab * 0.5
            if c1_bear and c2_small and c3_bull and c.iloc[i] > (o.iloc[i-2] + c.iloc[i-2]) / 2:
                patterns.append({
                    "type": "Morning Star",
                    "description": f"Morning Star on {date} — 3-candle bullish reversal pattern, trend may reverse upward",
                    "signal": "bullish",
                    "confidence": 75,
                    "date": date,
                    "category": "candlestick",
                })

        # ─── Evening Star (3-candle bearish reversal) ────────
        if i >= 2:
            c1_bull = c.iloc[i-2] > o.iloc[i-2] and body.iloc[i-2] > ab * 0.5
            c2_small = body.iloc[i-1] < ab * 0.3
            c3_bear = is_bear and b > ab * 0.5
            if c1_bull and c2_small and c3_bear and c.iloc[i] < (o.iloc[i-2] + c.iloc[i-2]) / 2:
                patterns.append({
                    "type": "Evening Star",
                    "description": f"Evening Star on {date} — 3-candle bearish reversal pattern, trend may reverse downward",
                    "signal": "bearish",
                    "confidence": 75,
                    "date": date,
                    "category": "candlestick",
                })

        # ─── Three White Soldiers ────────────────────────────
        if i >= 2:
            all_bull = all(c.iloc[i-j] > o.iloc[i-j] for j in range(3))
            ascending = c.iloc[i] > c.iloc[i-1] > c.iloc[i-2]
            decent_body = all(body.iloc[i-j] > ab * 0.4 for j in range(3))
            if all_bull and ascending and decent_body:
                patterns.append({
                    "type": "Three White Soldiers",
                    "description": f"Three White Soldiers ending {date} — three consecutive bullish candles, strong uptrend signal",
                    "signal": "bullish",
                    "confidence": 78,
                    "date": date,
                    "category": "candlestick",
                })

        # ─── Three Black Crows ───────────────────────────────
        if i >= 2:
            all_bear = all(c.iloc[i-j] < o.iloc[i-j] for j in range(3))
            descending = c.iloc[i] < c.iloc[i-1] < c.iloc[i-2]
            decent_body = all(body.iloc[i-j] > ab * 0.4 for j in range(3))
            if all_bear and descending and decent_body:
                patterns.append({
                    "type": "Three Black Crows",
                    "description": f"Three Black Crows ending {date} — three consecutive bearish candles, strong downtrend signal",
                    "signal": "bearish",
                    "confidence": 78,
                    "date": date,
                    "category": "candlestick",
                })

    # Deduplicate by type (keep highest confidence)
    seen = {}
    for p in patterns:
        key = p["type"]
        if key not in seen or p["confidence"] > seen[key]["confidence"]:
            seen[key] = p
    return list(seen.values())


def detect_patterns(hist_data: list, indicators: dict) -> list:
    """Detect chart patterns from historical data and indicators."""
    if not hist_data or "error" in indicators:
        return []

    df = pd.DataFrame(hist_data)
    close = df["close"].astype(float)
    patterns = []
    current_price = float(close.iloc[-1])

    # ─── Candlestick Patterns ──────────────────────────────────────────
    candlestick_patterns = detect_candlestick_patterns(hist_data)
    patterns.extend(candlestick_patterns)

    # ─── Golden Cross / Death Cross ───────────────────────────────────
    sma_50 = indicators.get("sma_50", [])
    sma_200 = indicators.get("sma_200", [])
    if len(sma_50) >= 2 and len(sma_200) >= 2:
        if sma_50[-1] is not None and sma_200[-1] is not None and sma_50[-2] is not None and sma_200[-2] is not None:
            if sma_50[-1] > sma_200[-1] and sma_50[-2] <= sma_200[-2]:
                patterns.append({
                    "type": "Golden Cross",
                    "description": "50-day MA crossed above 200-day MA",
                    "signal": "bullish",
                    "confidence": 75,
                    "date": hist_data[-1]["date"],
                })
            elif sma_50[-1] < sma_200[-1] and sma_50[-2] >= sma_200[-2]:
                patterns.append({
                    "type": "Death Cross",
                    "description": "50-day MA crossed below 200-day MA",
                    "signal": "bearish",
                    "confidence": 75,
                    "date": hist_data[-1]["date"],
                })

    # ─── Trend based on SMA position ──────────────────────────────────
    if sma_50 and sma_200 and sma_50[-1] is not None and sma_200[-1] is not None:
        if current_price > sma_50[-1] > sma_200[-1]:
            patterns.append({
                "type": "Strong Uptrend",
                "description": "Price above 50-day MA, which is above 200-day MA",
                "signal": "bullish",
                "confidence": 70,
                "date": hist_data[-1]["date"],
            })
        elif current_price < sma_50[-1] < sma_200[-1]:
            patterns.append({
                "type": "Strong Downtrend",
                "description": "Price below 50-day MA, which is below 200-day MA",
                "signal": "bearish",
                "confidence": 70,
                "date": hist_data[-1]["date"],
            })

    # ─── RSI Signals ──────────────────────────────────────────────────
    current_rsi = indicators.get("current_rsi", 50)
    if current_rsi > 70:
        patterns.append({
            "type": "RSI Overbought",
            "description": f"RSI at {current_rsi} (above 70) — stock may be overbought",
            "signal": "bearish",
            "confidence": 65,
            "date": hist_data[-1]["date"],
        })
    elif current_rsi < 30:
        patterns.append({
            "type": "RSI Oversold",
            "description": f"RSI at {current_rsi} (below 30) — stock may be oversold",
            "signal": "bullish",
            "confidence": 65,
            "date": hist_data[-1]["date"],
        })

    # ─── MACD Crossover ──────────────────────────────────────────────
    macd_line = indicators.get("macd_line", [])
    macd_signal = indicators.get("macd_signal", [])
    if len(macd_line) >= 2 and len(macd_signal) >= 2:
        if (macd_line[-1] is not None and macd_signal[-1] is not None and
            macd_line[-2] is not None and macd_signal[-2] is not None):
            if macd_line[-1] > macd_signal[-1] and macd_line[-2] <= macd_signal[-2]:
                patterns.append({
                    "type": "MACD Bullish Crossover",
                    "description": "MACD line crossed above signal line",
                    "signal": "bullish",
                    "confidence": 60,
                    "date": hist_data[-1]["date"],
                })
            elif macd_line[-1] < macd_signal[-1] and macd_line[-2] >= macd_signal[-2]:
                patterns.append({
                    "type": "MACD Bearish Crossover",
                    "description": "MACD line crossed below signal line",
                    "signal": "bearish",
                    "confidence": 60,
                    "date": hist_data[-1]["date"],
                })

    # ─── Bollinger Band Signals ───────────────────────────────────────
    bb_upper = indicators.get("bb_upper", [])
    bb_lower = indicators.get("bb_lower", [])
    if bb_upper and bb_lower and bb_upper[-1] is not None and bb_lower[-1] is not None:
        if current_price >= bb_upper[-1]:
            patterns.append({
                "type": "Bollinger Band Upper Touch",
                "description": "Price touching upper Bollinger Band — potential resistance",
                "signal": "bearish",
                "confidence": 55,
                "date": hist_data[-1]["date"],
            })
        elif current_price <= bb_lower[-1]:
            patterns.append({
                "type": "Bollinger Band Lower Touch",
                "description": "Price touching lower Bollinger Band — potential support",
                "signal": "bullish",
                "confidence": 55,
                "date": hist_data[-1]["date"],
            })

    # ─── Double Top / Double Bottom (simplified) ─────────────────────
    if len(close) >= 30:
        recent_30 = close.tail(30).values
        highs = []
        lows = []
        for i in range(2, len(recent_30) - 2):
            if recent_30[i] > recent_30[i-1] and recent_30[i] > recent_30[i-2] and \
               recent_30[i] > recent_30[i+1] and recent_30[i] > recent_30[i+2]:
                highs.append(recent_30[i])
            if recent_30[i] < recent_30[i-1] and recent_30[i] < recent_30[i-2] and \
               recent_30[i] < recent_30[i+1] and recent_30[i] < recent_30[i+2]:
                lows.append(recent_30[i])

        # Double Top: two similar highs
        if len(highs) >= 2:
            h1, h2 = highs[-2], highs[-1]
            if abs(h1 - h2) / max(h1, h2) < 0.02:  # within 2%
                patterns.append({
                    "type": "Double Top",
                    "description": f"Two peaks near ₹{round(max(h1, h2), 2)} — bearish reversal signal",
                    "signal": "bearish",
                    "confidence": 60,
                    "date": hist_data[-1]["date"],
                })

        # Double Bottom: two similar lows
        if len(lows) >= 2:
            l1, l2 = lows[-2], lows[-1]
            if abs(l1 - l2) / max(l1, l2) < 0.02:
                patterns.append({
                    "type": "Double Bottom",
                    "description": f"Two troughs near ₹{round(min(l1, l2), 2)} — bullish reversal signal",
                    "signal": "bullish",
                    "confidence": 60,
                    "date": hist_data[-1]["date"],
                })

    # ─── Volume Spike ─────────────────────────────────────────────────
    if len(df) >= 20:
        avg_vol = df["volume"].tail(20).mean()
        last_vol = float(df["volume"].iloc[-1])
        if last_vol > avg_vol * 2:
            patterns.append({
                "type": "Volume Spike",
                "description": f"Volume {round(last_vol/avg_vol, 1)}x above 20-day average",
                "signal": "neutral",
                "confidence": 70,
                "date": hist_data[-1]["date"],
            })

    # ─── Support/Resistance Proximity ─────────────────────────────────
    support = indicators.get("support")
    resistance = indicators.get("resistance")
    if support and resistance:
        if current_price < support * 1.02:
            patterns.append({
                "type": "Near Support",
                "description": f"Price near support level of ₹{support}",
                "signal": "bullish",
                "confidence": 55,
                "date": hist_data[-1]["date"],
            })
        if current_price > resistance * 0.98:
            patterns.append({
                "type": "Near Resistance",
                "description": f"Price near resistance level of ₹{resistance}",
                "signal": "bearish",
                "confidence": 55,
                "date": hist_data[-1]["date"],
            })

    return patterns


def _safe_round_series(series: pd.Series) -> list:
    """Convert pandas series to list, replacing NaN with None."""
    return [round(float(x), 2) if not pd.isna(x) else None for x in series]


def get_quick_quote(symbol: str) -> dict:
    """Get a quick price quote for a stock."""
    ticker_symbol = f"{symbol}.NS"
    ticker = yf.Ticker(ticker_symbol)
    try:
        hist = ticker.history(period="5d")
        if hist.empty:
            ticker_symbol = f"{symbol}.BO"
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(period="5d")
        if hist.empty:
            return {"error": f"No data for {symbol}"}

        current = round(float(hist["Close"].iloc[-1]), 2)
        prev = round(float(hist["Close"].iloc[-2]), 2) if len(hist) > 1 else current
        return {
            "symbol": symbol.upper(),
            "price": current,
            "change": round(current - prev, 2),
            "change_percent": round(((current - prev) / prev) * 100, 2) if prev > 0 else 0,
            "volume": int(hist["Volume"].iloc[-1]),
        }
    except Exception as e:
        return {"symbol": symbol.upper(), "error": str(e)}
