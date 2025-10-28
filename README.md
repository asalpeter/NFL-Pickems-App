# 🏈 NFL Pick'ems (Next.js + Supabase)

A recruiter‑friendly, production‑style template for weekly NFL pick'em leagues. Users can:
- Sign in with magic links (Supabase Auth)
- Create/join private leagues (with code)
- Make weekly picks
- See members & (via `/api/standings`) wins per week/season

## Tech choices (optimized for quick, impressive delivery)
- **Next.js 15 (App Router) + TypeScript + Tailwind** → modern, fast, easy to demo on Vercel (free)
- **Supabase (Auth + Postgres + RLS)** → robust schema + row‑level security without writing a custom backend
- **Minimal server code** (a single API route). Most logic is in SQL + client library → less to maintain, easy to read in an interview.

## Quickstart

1) **Create Supabase project** (free tier) → copy URL and keys.
2) **Run SQL**: open Supabase SQL editor and paste `supabase/supabase.sql`.
3) **Set env**: copy `.env.example` to `.env.local` and fill values.
4) **Install & run**:
```bash
npm i
npm run dev
```
5) **Seed mock Week 1** (optional, uses Service Role key; safe to run locally only):
```bash
# temporarily expose service key via env variable just for seeding
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/mock_schedule.ts
```

## Deploy (free)
- Click **"Import Project"** on **Vercel**, set the three env vars from `.env.example`.
- In Supabase: add your Vercel domain to **Authentication → URL Configuration** (redirect URLs).
- Done. Your API route and pages run serverless on Vercel. DB/Auth stay on Supabase.

## Notes & next steps
- Add real NFL schedule ingestion (CSV or a small worker) and cron to close picks at kickoff.
- Add tiebreakers (e.g., MNF points), weekly winners, season leaderboard UI.
- Add league roles, kick members, and public vs private leagues.
- Enhance UI (matchup logos, user avatars).
- Add email invites (Supabase functions) and webhooks for scoring updates.

Happy shipping! 🚀


---

## New features
- **Schedule importer**: `scripts/import_schedule.ts` ingests a CSV like `data/sample_schedule.csv` into `weeks` and `games` (supports `is_tiebreaker`).
- **Pick lock**: RLS blocks pick inserts/updates after each game’s `kickoff`. UI disables buttons after kickoff.
- **Scoring**: `app/api/webhooks/score` updates `home_score`, `away_score`, `winner` securely (set `WEBHOOK_SECRET`).
- **Weekly winners**: SQL view `weekly_winners` ranks by wins, then by **tiebreaker closeness**.
- **Season leaderboard**: UI aggregates wins across weeks for the league.
- **Tiebreakers**: `weekly_tiebreakers` table; UI to submit per‑week total points guess.
- **Team logos**: simple SVG placeholders in `/public/logos/{TEAM}.svg` (swap with real assets anytime).

### Schedule Import
```bash
# local only – uses service role
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import_schedule.ts data/sample_schedule.csv
```

### Scoring Webhook
POST to `/api/webhooks/score` with header `x-webhook-secret: $WEBHOOK_SECRET` and body:
```json
{ "season": 2025, "week": 1, "home": "SF", "away": "LAR", "home_score": 24, "away_score": 20 }
```
This sets scores and `winner` (`HOME`/`AWAY`). Standings & weekly winners update automatically.

### Tiebreaker
Mark one game per week as `is_tiebreaker=true` in the schedule. Users submit `weekly_tiebreakers.total_points_guess`. Weekly rank breaks ties by absolute difference from actual total points of the tiebreaker game.

### Env vars (add to Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for local import/seed jobs only; never expose on client)
- `WEBHOOK_SECRET` (for scoring webhook)


## Automation (zero-hand) setup

### Option A — Vercel Cron (recommended)
`vercel.json` schedules two jobs:
- `0 9 * * *` → `/api/cron/import-schedule` (imports/updates schedule from CSV feed)
- `*/15 * * * *` → `/api/cron/score` (updates completed game scores)

**Set env vars (Vercel Project Settings → Environment Variables):**
- `CRON_SECRET` — shared secret header for cron endpoints
- `SCHEDULE_FEED_URL` — CSV URL with columns `season,week,kickoff,home,away,is_tiebreaker`
- `SCORE_FEED_URL` — JSON URL array with objects `{season,week,home,away,home_score,away_score}`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Vercel will call those endpoints automatically on the given schedules with an `x-cron-secret` header you supply via your CI (see below). If you use Vercel’s native cron, configure it to include the header via a middleware or by calling through a tiny external Task runner; otherwise, use Option B.

### Option B — GitHub Actions (portable)
A workflow `.github/workflows/cron.yml` runs the same jobs on a schedule. Add two repository **Secrets**:
- `API_BASE` → your deployed app URL (e.g., https://nfl-pickems.vercel.app)
- `CRON_SECRET` → must match the app’s `CRON_SECRET` env var

The workflow POSTs to the cron endpoints with the header `x-cron-secret: $CRON_SECRET`.

### Sample feeds for local testing
- `data/sample_schedule.csv` (CSV)
- `data/sample_scores.json` (JSON)

You can serve these locally (or host on a gist / storage bucket) and point:
```
SCHEDULE_FEED_URL=http://localhost:3000/sample.csv
SCORE_FEED_URL=http://localhost:3000/sample.json
```
Or run imports manually with the existing script:
```
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import_schedule.ts data/sample_schedule.csv
```

## End-to-end run & deploy

### 1) Supabase
- Create project → get URL + keys.
- Open SQL Editor → run `supabase/supabase.sql`.
- In Auth → add your Vercel domain to redirect URLs.

### 2) Local dev
```
cp .env.example .env.local
# fill:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...   # local-only scripts
# APP_URL=http://localhost:3000
# CRON_SECRET=your-shared-secret
# SCHEDULE_FEED_URL=...           # (optional for local)
# SCORE_FEED_URL=...              # (optional for local)
npm i
npm run dev
```
Seed a sample schedule:
```
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import_schedule.ts data/sample_schedule.csv
```

### 3) Deploy (Vercel)
- Import GitHub repo into Vercel.
- Set env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server usage only)
  - `APP_URL` (your Vercel URL)
  - `WEBHOOK_SECRET` (for `/api/webhooks/score` if you’ll push results externally)
  - `CRON_SECRET`, `SCHEDULE_FEED_URL`, `SCORE_FEED_URL` (for automated import/score)
- Vercel will deploy and, if using `vercel.json` crons or GitHub Actions, automation kicks in.

### 4) Using it
- Sign in (magic link).
- Create a league → share the code.
- Each week: schedule imports automatically; users submit picks until kickoff (RLS locked).
- After games: scores auto-update from feed; weekly winners & season leaderboard update instantly.


## Built-in Adapters (so you don't have to code feeds)
- **Schedules (nflverse → CSV)**: `/api/adapters/nflverse` returns a CSV with the headers this app expects.  
  Set `SCHEDULE_FEED_URL=https://<your-app>/api/adapters/nflverse` and optionally override `NFLVERSE_SCHEDULE_CSV` to switch seasons.
- **Scores (ESPN → JSON)**: `/api/adapters/espn` returns the normalized JSON array this app expects.  
  Set `SCORE_FEED_URL=https://<your-app>/api/adapters/espn` or use the GitHub Action to publish `data/scores.json` and point to its raw URL.

### GitHub Action to publish `scores.json`
- Workflow `.github/workflows/espn-scores.yml` runs every 15 minutes, uses `scripts/fetch_espn_scores.ts` to write `data/scores.json`, and commits it.  
  Then set: `SCORE_FEED_URL=https://raw.githubusercontent.com/<you>/<repo>/main/data/scores.json`.

