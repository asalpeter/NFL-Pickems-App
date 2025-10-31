# NFL Pick'ems App

A full-stack web application for running weekly NFL Pick’em leagues with friends. Built with **Next.js**, **TypeScript**, and **Supabase**, it provides real-time authentication, private leagues, automated scoring, and leaderboards.

---

## Overview

Players can create or join leagues, make weekly game picks, and track results on season and weekly leaderboards.  
Scores and schedules update automatically through cron jobs and Supabase APIs.

### Features
- Create or join private leagues with invite codes  
- Secure authentication via Supabase Auth  
- Make weekly picks before kickoff  
- Automatic score and leaderboard updates  
- Weekly and season standings with tie-breakers  
- Automated schedule and score imports  
- Modern, responsive UI with persistent sessions

---

## Tech Stack

| Category | Technology |
|-----------|-------------|
| Framework | Next.js (App Router), React |
| Language | TypeScript |
| Database | Supabase (PostgreSQL, Auth, RLS) |
| Styling | Tailwind CSS |
| Automation | GitHub Actions cron jobs |
| Hosting | Vercel (frontend), Supabase (backend) |

---

## Setup

### 1. Environment Variables
Create a `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
CRON_SECRET=<secure-random-string>
```

---

### 2. Installation

```bash
npm install
npm run dev
```
Visit `http://localhost:3000`.

---

## Database Schema

Core tables:
 - `profiles` (id, username)
 - `leagues` (id, name, code, created_at)
 - `league_members` (league_id, user_id)
 - `games` (id, season, week, home, away, kickoff, winner)
 - `picks` (league_id, user_id, game_id, pick)
 - `weekly_tiebreakers` (league_id, user_id, season, week, total_points_guess)

Views:
 - `weekly_winners`
 - `standings`

Row Level Security (RLS) policies ensure users only access their own data.

---

## API Endpoints

 - `/api/standings`: Returns season standings by league and season
 - `/api/weekly`: Returns weekly winners and ranks
 - `/api/cron/import-schedule`: Imports current NFL schedule
 - `/api/cron/score`: Updates game results and recalculates standings

---

## Authentication and Middleware

GitHub actions automatically import schedule and score picks based on game scores.

## Deployment

 - Frontend: Deployed on vercel and automatically builds on `main`.
 - Backend: Managed and deployed in Supabase.
 - Cron Jobs: Triggered via GitHub Actions using `CRON_SECRET` authentication.
