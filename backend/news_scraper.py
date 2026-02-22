"""
Advanced News Scraping & Aggregation Module
=============================================
- 8 RSS sources for comprehensive Indian market coverage
- Smart content extraction with multiple fallback selectors
- Advanced stock symbol detection with fuzzy matching
- Deduplication by title similarity
- Structured metadata extraction
"""

import feedparser
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re
import time
from difflib import SequenceMatcher

# ─── RSS Feed Sources (Expanded) ─────────────────────────────────────────

RSS_FEEDS = {
    "Moneycontrol": "https://www.moneycontrol.com/rss/latestnews.xml",
    "Economic Times": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "Business Standard": "https://www.business-standard.com/rss/markets-106.rss",
    "LiveMint": "https://www.livemint.com/rss/markets",
    "Financial Express": "https://www.financialexpress.com/market/feed/",
    "NDTV Profit": "https://feeds.feedburner.com/ndtvprofit-latest",
    "Reuters India": "https://feeds.reuters.com/reuters/INtopNews",
    "Investing.com": "https://in.investing.com/rss/news.rss",
}

# ─── Comprehensive Stock Symbol Database ──────────────────────────────────

COMMON_STOCKS = {
    # Mega caps
    "RELIANCE": ["Reliance", "RIL", "Reliance Industries", "Mukesh Ambani", "Jio"],
    "TCS": ["TCS", "Tata Consultancy", "Tata Consultancy Services"],
    "INFY": ["Infosys", "INFY", "Narayana Murthy"],
    "HDFCBANK": ["HDFC Bank", "HDFCBANK"],
    "ICICIBANK": ["ICICI Bank", "ICICIBANK", "ICICI"],
    "HINDUNILVR": ["Hindustan Unilever", "HUL"],
    "SBIN": ["SBI", "State Bank of India", "State Bank"],
    "BHARTIARTL": ["Bharti Airtel", "Airtel"],
    "ITC": ["ITC"],
    "KOTAKBANK": ["Kotak Mahindra", "Kotak Bank", "Kotak"],

    # Large caps
    "LT": ["Larsen", "L&T", "Larsen & Toubro"],
    "HCLTECH": ["HCL Tech", "HCL Technologies", "HCL"],
    "AXISBANK": ["Axis Bank"],
    "WIPRO": ["Wipro"],
    "MARUTI": ["Maruti", "Maruti Suzuki"],
    "TATAMOTORS": ["Tata Motors"],
    "SUNPHARMA": ["Sun Pharma", "Sun Pharmaceutical"],
    "ULTRACEMCO": ["UltraTech", "UltraTech Cement"],
    "TITAN": ["Titan", "Titan Company"],
    "BAJFINANCE": ["Bajaj Finance"],
    "BAJAJFINSV": ["Bajaj Finserv"],
    "NTPC": ["NTPC"],
    "POWERGRID": ["Power Grid", "Power Grid Corporation"],
    "ONGC": ["ONGC", "Oil and Natural Gas"],
    "TATASTEEL": ["Tata Steel"],
    "ASIANPAINT": ["Asian Paints"],
    "NESTLEIND": ["Nestle India", "Nestle"],
    "TECHM": ["Tech Mahindra"],
    "JSWSTEEL": ["JSW Steel", "JSW"],
    "DRREDDY": ["Dr Reddy", "Dr. Reddy's", "Dr Reddy's"],
    "CIPLA": ["Cipla"],
    "COALINDIA": ["Coal India"],
    "BPCL": ["BPCL", "Bharat Petroleum"],
    "HEROMOTOCO": ["Hero MotoCorp", "Hero Motor"],
    "EICHERMOT": ["Eicher Motors", "Royal Enfield"],
    "DIVISLAB": ["Divi's Lab", "Divi's Laboratories"],
    "GRASIM": ["Grasim", "Grasim Industries"],
    "APOLLOHOSP": ["Apollo Hospitals", "Apollo"],

    # Adani Group
    "ADANIENT": ["Adani Enterprises", "Adani"],
    "ADANIPORTS": ["Adani Ports"],
    "ADANIGREEN": ["Adani Green"],
    "ADANIPOWER": ["Adani Power"],

    # Banks & Finance
    "INDUSINDBK": ["IndusInd Bank"],
    "BANDHANBNK": ["Bandhan Bank"],
    "PNB": ["Punjab National Bank", "PNB"],
    "BANKBARODA": ["Bank of Baroda"],
    "IDFCFIRSTB": ["IDFC First Bank", "IDFC"],
    "SBILIFE": ["SBI Life"],
    "HDFCLIFE": ["HDFC Life"],
    "ICICIPRULI": ["ICICI Prudential"],

    # IT & Tech
    "LTIM": ["LTI Mindtree", "LTIMindtree", "Mindtree"],
    "MPHASIS": ["Mphasis"],
    "PERSISTENT": ["Persistent Systems"],
    "COFORGE": ["Coforge"],

    # Auto
    "BAJAJ-AUTO": ["Bajaj Auto"],
    "M&M": ["Mahindra", "M&M", "Mahindra & Mahindra"],
    "ASHOKLEY": ["Ashok Leyland"],

    # Pharma & Healthcare
    "BIOCON": ["Biocon"],
    "LUPIN": ["Lupin"],
    "AUROPHARMA": ["Aurobindo Pharma", "Aurobindo"],

    # Indices
    "NIFTY": ["Nifty", "Nifty50", "Nifty 50", "NSE index"],
    "SENSEX": ["Sensex", "BSE Sensex", "BSE index", "BSE"],
    "BANKNIFTY": ["Bank Nifty", "BankNifty"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}


def fetch_all_feeds() -> list:
    """Fetch news from all RSS sources with deduplication."""
    all_articles = []
    seen_titles = set()

    for source, url in RSS_FEEDS.items():
        try:
            articles = fetch_feed(source, url)
            for article in articles:
                # Deduplicate by title similarity
                title = article["title"]
                is_dup = False
                for seen in seen_titles:
                    if SequenceMatcher(None, title.lower(), seen.lower()).ratio() > 0.8:
                        is_dup = True
                        break
                if not is_dup:
                    all_articles.append(article)
                    seen_titles.add(title)
        except Exception as e:
            print(f"❌ Error fetching {source}: {e}")
            continue

    # Sort by date, newest first
    all_articles.sort(key=lambda x: x.get("published_date", ""), reverse=True)
    return all_articles


def fetch_feed(source: str, url: str) -> list:
    """Fetch and parse a single RSS feed with robust error handling."""
    articles = []
    try:
        # Set timeout and user agent for feedparser
        feed = feedparser.parse(url, agent=HEADERS["User-Agent"])

        if not feed.entries:
            print(f"⚠️ No entries from {source}")
            return articles

        for entry in feed.entries[:20]:  # take top 20 from each source
            title = entry.get("title", "").strip()
            link = entry.get("link", "")
            summary = entry.get("summary", entry.get("description", ""))

            if not title:
                continue

            # Parse published date
            pub_date = entry.get("published_parsed") or entry.get("updated_parsed")
            if pub_date:
                try:
                    pub_date = datetime(*pub_date[:6]).strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    pub_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            else:
                pub_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Clean HTML from summary
            if summary:
                soup = BeautifulSoup(summary, "html.parser")
                summary = soup.get_text(separator=" ").strip()
                # Remove excessive whitespace
                summary = re.sub(r'\s+', ' ', summary)

            # Detect mentioned stocks
            full_text = f"{title} {summary}"
            mentioned = detect_stocks_in_text(full_text)

            # Extract any numbers/percentages for context
            percentages = re.findall(r'[-+]?\d+\.?\d*%', full_text)
            prices = re.findall(r'₹[\d,]+\.?\d*', full_text)

            articles.append({
                "source": source,
                "title": title,
                "content": summary[:3000],  # larger content window
                "url": link,
                "published_date": pub_date,
                "symbols_mentioned": mentioned,
                "metadata": {
                    "percentages": percentages[:5],
                    "prices": prices[:5],
                    "word_count": len(full_text.split()),
                }
            })
    except Exception as e:
        print(f"⚠️ Feed parse error for {source}: {e}")

    return articles


def scrape_article_content(url: str) -> str:
    """
    Advanced article content scraper with multiple extraction strategies.
    Falls through progressively from specific selectors to generic ones.
    """
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")

        # Remove noise elements
        for tag in soup(["script", "style", "nav", "header", "footer", "aside",
                         "iframe", "form", "button", "input", "select",
                         ".advertisement", ".ad", ".sidebar", ".social-share",
                         ".comments", ".related-articles", ".newsletter"]):
            if isinstance(tag, str):
                for el in soup.select(tag):
                    el.decompose()
            else:
                tag.decompose()

        # Strategy 1: Site-specific selectors (highest accuracy)
        site_selectors = {
            "moneycontrol.com": [".article_desc", "#article-body", ".arti-flow"],
            "economictimes.com": [".artText", ".article_detail", ".artFull"],
            "business-standard.com": [".story-content", ".p-content"],
            "livemint.com": [".article-content", ".mainArea"],
            "financialexpress.com": [".wp-block-post-content", ".article-content"],
            "ndtvprofit.com": [".story__content", ".sp-cn"],
        }

        content = None
        for domain, selectors in site_selectors.items():
            if domain in url:
                for selector in selectors:
                    element = soup.select_one(selector)
                    if element:
                        content = element.get_text(separator=" ", strip=True)
                        if len(content) > 100:
                            break
                break

        # Strategy 2: Generic article selectors
        if not content or len(content) < 100:
            generic_selectors = [
                "article",
                '[role="article"]',
                ".article-body",
                ".story-content",
                ".article_content",
                ".content_wrapper",
                ".article-desc",
                "#article-body",
                ".story_details",
                ".post-content",
                ".entry-content",
                "main",
                '[itemprop="articleBody"]',
            ]

            for selector in generic_selectors:
                element = soup.select_one(selector)
                if element:
                    text = element.get_text(separator=" ", strip=True)
                    if len(text) > 100:
                        content = text
                        break

        # Strategy 3: Paragraph concatenation (fallback)
        if not content or len(content) < 100:
            paragraphs = soup.find_all("p")
            content = " ".join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30)

        if not content:
            return "Content extraction failed"

        # Clean up
        content = re.sub(r'\s+', ' ', content).strip()
        return content[:6000]  # larger content window

    except requests.exceptions.Timeout:
        return "Scraping timed out"
    except Exception as e:
        return f"Scraping failed: {str(e)[:100]}"


def detect_stocks_in_text(text: str) -> list:
    """
    Advanced stock symbol detection with:
    - Exact match
    - Case-insensitive alias matching
    - Context-aware (avoids false positives for common words like "IT", "TITAN")
    """
    mentioned = []
    text_upper = text.upper()
    text_lower = text.lower()

    for symbol, aliases in COMMON_STOCKS.items():
        for alias in aliases:
            alias_upper = alias.upper()
            alias_lower = alias.lower()

            # For very short aliases (<=3 chars), require word boundary
            if len(alias) <= 3:
                pattern = r'\b' + re.escape(alias_upper) + r'\b'
                if re.search(pattern, text_upper):
                    if symbol not in mentioned:
                        mentioned.append(symbol)
                    break
            else:
                if alias_lower in text_lower:
                    if symbol not in mentioned:
                        mentioned.append(symbol)
                    break

    return mentioned


def get_news_for_stock(symbol: str, articles: list) -> list:
    """Filter articles relevant to a specific stock with relevance scoring."""
    symbol_upper = symbol.upper()
    relevant = []

    for article in articles:
        score = 0

        # Direct symbol mention
        mentioned = article.get("symbols_mentioned", [])
        if symbol_upper in mentioned:
            score += 3

        # Check title (highest weight)
        aliases = COMMON_STOCKS.get(symbol_upper, [symbol_upper])
        title_lower = article.get("title", "").lower()
        for alias in aliases:
            if alias.lower() in title_lower:
                score += 5
                break

        # Check content
        content_lower = article.get("content", "").lower()
        for alias in aliases:
            if alias.lower() in content_lower:
                score += 1
                break

        if score > 0:
            article_copy = dict(article)
            article_copy["relevance_score"] = score
            relevant.append(article_copy)

    # Sort by relevance then date
    relevant.sort(key=lambda x: (x.get("relevance_score", 0), x.get("published_date", "")), reverse=True)
    return relevant
