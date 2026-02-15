"""
News Scraping & Aggregation Module
Fetches news from multiple RSS feeds and scrapes article content.
"""

import feedparser
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re
import time

# ─── RSS Feed Sources ─────────────────────────────────────────────────────

RSS_FEEDS = {
    "Moneycontrol": "https://www.moneycontrol.com/rss/latestnews.xml",
    "Economic Times": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "Business Standard": "https://www.business-standard.com/rss/markets-106.rss",
    "LiveMint": "https://www.livemint.com/rss/markets",
    "Financial Express": "https://www.financialexpress.com/market/feed/",
    "NDTV Profit": "https://feeds.feedburner.com/ndtvprofit-latest",
}

# Common Indian stock symbols for matching
COMMON_STOCKS = {
    "RELIANCE": ["Reliance", "RIL", "Reliance Industries"],
    "TCS": ["TCS", "Tata Consultancy"],
    "INFY": ["Infosys", "INFY"],
    "HDFCBANK": ["HDFC Bank", "HDFCBANK"],
    "ICICIBANK": ["ICICI Bank", "ICICIBANK"],
    "HINDUNILVR": ["Hindustan Unilever", "HUL"],
    "SBIN": ["SBI", "State Bank"],
    "BHARTIARTL": ["Bharti Airtel", "Airtel"],
    "ITC": ["ITC"],
    "KOTAKBANK": ["Kotak Mahindra", "Kotak Bank"],
    "LT": ["Larsen", "L&T"],
    "HCLTECH": ["HCL Tech", "HCL Technologies"],
    "AXISBANK": ["Axis Bank"],
    "WIPRO": ["Wipro"],
    "MARUTI": ["Maruti", "Maruti Suzuki"],
    "TATAMOTORS": ["Tata Motors"],
    "SUNPHARMA": ["Sun Pharma", "Sun Pharmaceutical"],
    "ULTRACEMCO": ["UltraTech", "UltraTech Cement"],
    "TITAN": ["Titan"],
    "BAJFINANCE": ["Bajaj Finance"],
    "BAJAJFINSV": ["Bajaj Finserv"],
    "NTPC": ["NTPC"],
    "POWERGRID": ["Power Grid"],
    "ONGC": ["ONGC", "Oil and Natural Gas"],
    "TATASTEEL": ["Tata Steel"],
    "ADANIENT": ["Adani Enterprises", "Adani"],
    "ADANIPORTS": ["Adani Ports"],
    "ASIANPAINT": ["Asian Paints"],
    "NESTLEIND": ["Nestle India"],
    "TECHM": ["Tech Mahindra"],
    "JSWSTEEL": ["JSW Steel"],
    "DRREDDY": ["Dr Reddy", "Dr. Reddy's"],
    "CIPLA": ["Cipla"],
    "COALINDIA": ["Coal India"],
    "BPCL": ["BPCL", "Bharat Petroleum"],
    "HEROMOTOCO": ["Hero MotoCorp", "Hero Motor"],
    "EICHERMOT": ["Eicher Motors", "Royal Enfield"],
    "DIVISLAB": ["Divi's Lab", "Divi's Laboratories"],
    "GRASIM": ["Grasim", "Grasim Industries"],
    "APOLLOHOSP": ["Apollo Hospitals", "Apollo"],
    "NIFTY": ["Nifty", "Nifty50", "Nifty 50"],
    "SENSEX": ["Sensex", "BSE Sensex"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def fetch_all_feeds() -> list:
    """Fetch news from all RSS sources."""
    all_articles = []

    for source, url in RSS_FEEDS.items():
        try:
            articles = fetch_feed(source, url)
            all_articles.extend(articles)
        except Exception as e:
            print(f"❌ Error fetching {source}: {e}")
            continue

    # Sort by date, newest first
    all_articles.sort(key=lambda x: x.get("published_date", ""), reverse=True)
    return all_articles


def fetch_feed(source: str, url: str) -> list:
    """Fetch and parse a single RSS feed."""
    articles = []
    try:
        feed = feedparser.parse(url)
        for entry in feed.entries[:15]:  # take top 15 from each source
            title = entry.get("title", "").strip()
            link = entry.get("link", "")
            summary = entry.get("summary", entry.get("description", ""))

            # Parse published date
            pub_date = entry.get("published_parsed") or entry.get("updated_parsed")
            if pub_date:
                pub_date = datetime(*pub_date[:6]).strftime("%Y-%m-%d %H:%M:%S")
            else:
                pub_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Clean HTML from summary
            if summary:
                soup = BeautifulSoup(summary, "html.parser")
                summary = soup.get_text(separator=" ").strip()

            # Detect mentioned stocks
            full_text = f"{title} {summary}"
            mentioned = detect_stocks_in_text(full_text)

            articles.append({
                "source": source,
                "title": title,
                "content": summary[:2000],  # limit content size
                "url": link,
                "published_date": pub_date,
                "symbols_mentioned": mentioned,
            })
    except Exception as e:
        print(f"⚠️ Feed parse error for {source}: {e}")

    return articles


def scrape_article_content(url: str) -> str:
    """Scrape full article content from a URL."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")

        # Remove script and style tags
        for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
            tag.decompose()

        # Try common article content selectors
        content = None
        selectors = [
            "article",
            ".article-body",
            ".story-content",
            ".article_content",
            ".content_wrapper",
            ".article-desc",
            "#article-body",
            ".story_details",
            "main",
        ]

        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                content = element.get_text(separator=" ", strip=True)
                break

        if not content:
            # Fallback: get all paragraph text
            paragraphs = soup.find_all("p")
            content = " ".join(p.get_text(strip=True) for p in paragraphs)

        # Clean up the text
        content = re.sub(r'\s+', ' ', content).strip()
        return content[:5000]  # limit to 5000 chars

    except Exception as e:
        return f"Could not scrape: {str(e)}"


def detect_stocks_in_text(text: str) -> list:
    """Detect stock symbols mentioned in text."""
    mentioned = []
    text_upper = text.upper()

    for symbol, aliases in COMMON_STOCKS.items():
        for alias in aliases:
            if alias.upper() in text_upper:
                if symbol not in mentioned:
                    mentioned.append(symbol)
                break

    return mentioned


def get_news_for_stock(symbol: str, articles: list) -> list:
    """Filter articles relevant to a specific stock."""
    symbol_upper = symbol.upper()
    relevant = []

    for article in articles:
        mentioned = article.get("symbols_mentioned", [])
        if symbol_upper in mentioned:
            relevant.append(article)
            continue

        # Also check title and content
        aliases = COMMON_STOCKS.get(symbol_upper, [symbol_upper])
        text = f"{article.get('title', '')} {article.get('content', '')}"
        for alias in aliases:
            if alias.upper() in text.upper():
                relevant.append(article)
                break

    return relevant
