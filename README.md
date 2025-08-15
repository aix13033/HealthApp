# HealthApp MVP

## Setup
1. Install dependencies: `npm install`.
2. Set environment variables in `.env` (e.g., SUPABASE_URL, OPENAI_API_KEY).
3. Start with `expo start` for development.

## Backend Deployment
1. Push `backend/` to a GitHub repo.
2. Connect to Vercel via dashboard > "Import Git Repository".
3. Set env vars in Vercel (SUPABASE_URL, etc.).

## Notes
- Replace 'test-user' with auth logic.
- Expand Supabase tables (user_data, scores) as needed.