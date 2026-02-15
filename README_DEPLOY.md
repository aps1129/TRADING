# StockAI Pro — AI-Powered Stock Analysis & News Tool

AI-powered stock analysis for Indian markets. Technical pattern detection, news sentiment analysis, and market predictions — completely free.

## 🚀 Deploying to Vercel

### Prerequisites
- GitHub account with this repo pushed
- [Vercel account](https://vercel.com) (free tier works)
- [Gemini API key](https://aistudio.google.com/apikey) (free)

### Steps

1. **Import to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click **"Add New..."** → **"Project"**
   - Import your `TRADING` GitHub repository

2. **Configure Build Settings**
   - **Framework Preset**: `Other` (Vercel will auto-detect from `vercel.json`)
   - **Root Directory**: Leave as `./` (default)
   
3. **Set Environment Variables**
   Add in **Settings → Environment Variables**:
   - `GEMINI_API_KEY` = `your_actual_gemini_api_key`
   - `VERCEL` = `1` (auto-set by Vercel)

4. **Deploy**
   - Click **Deploy** — Vercel builds the frontend and sets up the Python serverless API

### Architecture on Vercel

```
Trading/
├── api/
│   ├── index.py          ← Vercel serverless function (entry point)
│   └── requirements.txt  ← Python dependencies for serverless
├── backend/
│   ├── main.py           ← FastAPI app (imported by api/index.py)
│   ├── ai_analysis.py    ← Gemini AI integration
│   ├── database.py       ← SQLite database (uses /tmp on Vercel)
│   ├── technical.py      ← Technical analysis (yfinance + pandas)
│   └── news_scraper.py   ← RSS news aggregation
├── frontend/
│   ├── src/              ← React + Vite app
│   ├── package.json      ← Has vercel-build script
│   └── vite.config.js
├── vercel.json           ← Deployment configuration
└── requirements.txt      ← Root-level Python dependencies
```

### How Routing Works

- **`/api/*`** → Python serverless function (`api/index.py` → `backend/main.py`)
- **Everything else** → Static React frontend (`frontend/dist/`)

## ⚠️ Important Notes

### Database (SQLite on Vercel)
- On Vercel, SQLite uses **`/tmp/trading.db`** (ephemeral)
- Data resets when the function cold-starts (every ~15 min of inactivity)
- For persistent data, switch to **Neon.tech** or **Supabase** (free PostgreSQL)

### Serverless Limitations
- **Cold starts**: First request after inactivity may take 5-10 seconds
- **Background tasks**: The news scheduler won't run continuously
  - Use [cron-job.org](https://cron-job.org) to hit `/api/news/fetch` every 15 min
- **Max execution time**: 10-60 seconds per request (free tier)

## 🏗️ Local Development

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate    # Windows
pip install -r requirements.txt
echo GEMINI_API_KEY=your_key > .env
uvicorn main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — frontend proxies `/api` to `http://localhost:8000`

## 📋 Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19 + Vite + TailwindCSS |
| Backend | FastAPI (Python) |
| AI | Google Gemini 2.0 Flash |
| Stock Data | yfinance (Yahoo Finance) |
| News | RSS feeds (Moneycontrol, ET, etc.) |
| Database | SQLite (local) / /tmp (Vercel) |
| Hosting | Vercel (free tier) |
