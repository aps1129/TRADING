# Deployment Guide (Vercel)

This project is configured for easy deployment on [Vercel](https://vercel.com).
Since Vercel natively supports both Python (Serverless Functions) and React, we can deploy the entire app as one project.

## 🚀 Steps to Deploy

1.  **Push to GitHub**
    - Create a new repository on GitHub.
    - Push this entire `Trading` folder to the repository.

2.  **Import to Vercel**
    - Go to [Vercel Dashboard](https://vercel.com/dashboard).
    - Click **"Add New..."** -> **"Project"**.
    - Import your GitHub repository.

3.  **Configure Project**
    - **Framework Preset**: Vercel should auto-detect "Vite" for the frontend. If not, select "Vite".
    - **Root Directory**: Leave as `./` (default).
    - **Environment Variables**:
      Add your API key here so it's secure (do not commit `.env` to GitHub!).
      - `GEMINI_API_KEY`: `your_actual_api_key_here`

4.  **Deploy**
    - Click **Deploy**.
    - Vercel will build the frontend and set up the Python backend.

## ⚠️ Important Note on Database

This app uses **SQLite** (`trading.db`), which is a file-based database.
- On Vercel (and most serverless platforms), the filesystem is **ephemeral**.
- This means **your data (watchlist, news) will reset** every time the app redeploys or wakes up from sleep.
- **For a permanent database**: You should switch to a free cloud PostgreSQL database (like **Neon.tech** or **Supabase**).
  1. Get a Postgres connection string (e.g., `postgres://user:pass@host/db`).
  2. Update `backend/database.py` to use `psycopg2` or `sqlalchemy` with this URL.
  3. Add the URL as a `DATABASE_URL` environment variable in Vercel.

## ⚠️ Limitations of Free Tier

- **Cold Starts**: The Python backend might take a few seconds to respond after inactivity.
- **Background Tasks**: The "News Scheduler" might not run reliably on Vercel's free tier because serverless functions have a maximum execution time (usually 10s-60s) and don't run continuously.
  - *Workaround*: Use a free cron service (like **cron-job.org**) to hit your `https://your-app.vercel.app/api/news/fetch` endpoint every 15 minutes.
