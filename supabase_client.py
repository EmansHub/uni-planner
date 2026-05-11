import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Backend services share one Supabase client configured from local environment variables.
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Fail fast so API routes do not run with a missing database connection.
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in .env file")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("SUPABASE_KEY starts with:", SUPABASE_KEY[:20] if SUPABASE_KEY else None)