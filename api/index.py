"""
Vercel Serverless Function Entry Point
=======================================
This file exposes the FastAPI app as a Vercel-compatible handler.
Vercel's @vercel/python runtime looks for an `app` variable (ASGI app)
in the file specified in vercel.json.
"""

import sys
import os

# Resolve paths - handle both local and Vercel environments
# In Vercel, files are typically at /var/task/
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_dir = os.path.join(project_root, "backend")

# Add backend directory to Python path so all backend imports work
for path in [backend_dir, project_root]:
    if path not in sys.path:
        sys.path.insert(0, path)

# Set VERCEL env var so database.py uses /tmp for SQLite
os.environ.setdefault("VERCEL", "1")

# Import the FastAPI app from backend/main.py
from main import app

# Vercel's Python runtime automatically detects the `app` ASGI application
