"""
SQLite Database Module
Handles all database operations for the trading app.
"""

import sqlite3
import json
import os
from datetime import datetime
from contextlib import contextmanager

# Check if running on Vercel (read-only filesystem)
if os.environ.get("VERCEL"):
    DB_PATH = "/tmp/trading.db"
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), "trading.db")


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database with all required tables."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Watchlist table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                added_date TEXT NOT NULL DEFAULT (datetime('now')),
                notes TEXT DEFAULT ''
            )
        """)

        # News articles table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS news_articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT DEFAULT '',
                url TEXT UNIQUE,
                published_date TEXT NOT NULL,
                symbols_mentioned TEXT DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # News analysis table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS news_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER NOT NULL,
                sentiment TEXT NOT NULL DEFAULT 'neutral',
                confidence REAL DEFAULT 50.0,
                key_points TEXT DEFAULT '[]',
                impact TEXT DEFAULT 'medium',
                affected_stocks TEXT DEFAULT '[]',
                analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
            )
        """)

        # Technical patterns table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS technical_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                pattern_type TEXT NOT NULL,
                detected_date TEXT NOT NULL DEFAULT (datetime('now')),
                confidence REAL DEFAULT 50.0,
                ai_explanation TEXT DEFAULT '',
                price_at_detection REAL DEFAULT 0.0
            )
        """)

        # Predictions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                direction TEXT NOT NULL,
                confidence REAL DEFAULT 50.0,
                reasoning TEXT DEFAULT '',
                risk_factors TEXT DEFAULT '[]',
                key_levels TEXT DEFAULT '{}',
                created_date TEXT NOT NULL DEFAULT (datetime('now')),
                target_date TEXT,
                actual_outcome TEXT DEFAULT NULL,
                outcome_price REAL DEFAULT NULL,
                resolved_at TEXT DEFAULT NULL
            )
        """)

        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_watchlist_symbol ON watchlist(symbol)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_patterns_symbol ON technical_patterns(symbol)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON predictions(symbol)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_predictions_date ON predictions(created_date)")

        conn.commit()
    print("✅ Database initialized successfully")


# ─── Watchlist Operations ─────────────────────────────────────────────────

def add_to_watchlist(symbol: str, name: str, notes: str = "") -> dict:
    with get_db() as conn:
        try:
            conn.execute(
                "INSERT INTO watchlist (symbol, name, notes) VALUES (?, ?, ?)",
                (symbol.upper(), name, notes)
            )
            return {"success": True, "message": f"{symbol.upper()} added to watchlist"}
        except sqlite3.IntegrityError:
            return {"success": False, "message": f"{symbol.upper()} is already in watchlist"}


def remove_from_watchlist(symbol: str) -> dict:
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM watchlist WHERE symbol = ?", (symbol.upper(),))
        if cursor.rowcount > 0:
            return {"success": True, "message": f"{symbol.upper()} removed from watchlist"}
        return {"success": False, "message": f"{symbol.upper()} not found in watchlist"}


def get_watchlist() -> list:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM watchlist ORDER BY added_date DESC").fetchall()
        return [dict(row) for row in rows]


# ─── News Operations ─────────────────────────────────────────────────────

def save_article(source: str, title: str, content: str, url: str,
                 published_date: str, symbols: list = None) -> int | None:
    with get_db() as conn:
        try:
            cursor = conn.execute(
                """INSERT INTO news_articles (source, title, content, url, published_date, symbols_mentioned)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (source, title, content, url, published_date, json.dumps(symbols or []))
            )
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None  # Article already exists


def save_analysis(article_id: int, sentiment: str, confidence: float,
                  key_points: list, impact: str, affected_stocks: list):
    with get_db() as conn:
        conn.execute(
            """INSERT INTO news_analysis (article_id, sentiment, confidence, key_points, impact, affected_stocks)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (article_id, sentiment, confidence, json.dumps(key_points),
             impact, json.dumps(affected_stocks))
        )


def get_news(limit: int = 50, source: str = None, sentiment: str = None,
             symbol: str = None) -> list:
    with get_db() as conn:
        query = """
            SELECT na.*, 
                   COALESCE(nana.sentiment, 'pending') as sentiment,
                   COALESCE(nana.confidence, 0) as analysis_confidence,
                   COALESCE(nana.key_points, '[]') as key_points,
                   COALESCE(nana.impact, 'unknown') as impact,
                   COALESCE(nana.affected_stocks, '[]') as affected_stocks
            FROM news_articles na
            LEFT JOIN news_analysis nana ON na.id = nana.article_id
            WHERE 1=1
        """
        params = []

        if source:
            query += " AND na.source = ?"
            params.append(source)

        if sentiment:
            query += " AND nana.sentiment = ?"
            params.append(sentiment)

        if symbol:
            query += " AND (na.symbols_mentioned LIKE ? OR nana.affected_stocks LIKE ?)"
            params.extend([f'%{symbol}%', f'%{symbol}%'])

        query += " ORDER BY na.published_date DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()
        results = []
        for row in rows:
            d = dict(row)
            d['key_points'] = json.loads(d.get('key_points', '[]'))
            d['affected_stocks'] = json.loads(d.get('affected_stocks', '[]'))
            d['symbols_mentioned'] = json.loads(d.get('symbols_mentioned', '[]'))
            results.append(d)
        return results


# ─── Pattern Operations ───────────────────────────────────────────────────

def save_pattern(symbol: str, pattern_type: str, confidence: float,
                 ai_explanation: str, price: float):
    with get_db() as conn:
        conn.execute(
            """INSERT INTO technical_patterns (symbol, pattern_type, confidence, ai_explanation, price_at_detection)
               VALUES (?, ?, ?, ?, ?)""",
            (symbol.upper(), pattern_type, confidence, ai_explanation, price)
        )


def get_patterns(symbol: str = None, limit: int = 50) -> list:
    with get_db() as conn:
        if symbol:
            rows = conn.execute(
                "SELECT * FROM technical_patterns WHERE symbol = ? ORDER BY detected_date DESC LIMIT ?",
                (symbol.upper(), limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM technical_patterns ORDER BY detected_date DESC LIMIT ?",
                (limit,)
            ).fetchall()
        return [dict(row) for row in rows]


# ─── Prediction Operations ────────────────────────────────────────────────

def save_prediction(symbol: str, direction: str, confidence: float,
                    reasoning: str, risk_factors: list, key_levels: dict,
                    target_date: str = None) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO predictions (symbol, direction, confidence, reasoning, risk_factors, key_levels, target_date)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (symbol.upper(), direction, confidence, reasoning,
             json.dumps(risk_factors), json.dumps(key_levels), target_date)
        )
        return cursor.lastrowid


def update_prediction_outcome(prediction_id: int, outcome: str, price: float):
    with get_db() as conn:
        conn.execute(
            """UPDATE predictions SET actual_outcome = ?, outcome_price = ?, resolved_at = datetime('now')
               WHERE id = ?""",
            (outcome, price, prediction_id)
        )


def get_predictions(symbol: str = None, limit: int = 50) -> list:
    with get_db() as conn:
        if symbol:
            rows = conn.execute(
                "SELECT * FROM predictions WHERE symbol = ? ORDER BY created_date DESC LIMIT ?",
                (symbol.upper(), limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM predictions ORDER BY created_date DESC LIMIT ?",
                (limit,)
            ).fetchall()
        results = []
        for row in rows:
            d = dict(row)
            d['risk_factors'] = json.loads(d.get('risk_factors', '[]'))
            d['key_levels'] = json.loads(d.get('key_levels', '{}'))
            results.append(d)
        return results


def get_prediction_stats() -> dict:
    """Get prediction accuracy statistics."""
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]
        resolved = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE actual_outcome IS NOT NULL"
        ).fetchone()[0]

        correct = 0
        if resolved > 0:
            correct = conn.execute(
                "SELECT COUNT(*) FROM predictions WHERE actual_outcome = direction"
            ).fetchone()[0]

        # Stats by direction
        bullish = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE direction = 'bullish'"
        ).fetchone()[0]
        bearish = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE direction = 'bearish'"
        ).fetchone()[0]
        neutral = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE direction = 'neutral'"
        ).fetchone()[0]

        return {
            "total_predictions": total,
            "resolved": resolved,
            "correct": correct,
            "accuracy": round((correct / resolved * 100), 1) if resolved > 0 else 0,
            "pending": total - resolved,
            "by_direction": {
                "bullish": bullish,
                "bearish": bearish,
                "neutral": neutral
            }
        }


if __name__ == "__main__":
    init_db()
