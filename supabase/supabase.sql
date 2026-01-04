-- Run this in Supabase SQL editor

create extension if not exists "uuid-ossp";

-- Profiles (link to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  onboarded boolean default false,
  created_at timestamp with time zone default now()
);

-- Leagues
create table if not exists public.leagues (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  code text unique not null, -- join code
  created_at timestamptz default now()
);

-- League members
create table if not exists public.league_members (
  league_id uuid references public.leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  is_admin boolean default false,
  primary key (league_id, user_id)
);

-- Weeks & Games
create table if not exists public.weeks (
  id serial primary key,
  season int not null,
  week int not null,
  starts_on date,
  unique(season, week)
);

create table if not exists public.games (
  id uuid primary key default uuid_generate_v4(),
  season int not null,
  week int not null,
  kickoff timestamptz,
  home text not null,
  away text not null,
  -- scoring
  home_score int,
  away_score int,
  winner text check (winner in ('HOME','AWAY')),
  is_tiebreaker boolean default false,
  created_at timestamptz default now(),
  unique(season, week, home, away)
);

-- Picks (per game)
create table if not exists public.picks (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid references public.leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  pick text check (pick in ('HOME','AWAY')) not null,
  created_at timestamptz default now(),
  unique(league_id, user_id, game_id)
);

-- Weekly tiebreakers (one guess per user per week per league)
create table if not exists public.weekly_tiebreakers (
  league_id uuid references public.leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  season int not null,
  week int not null,
  total_points_guess int not null,
  created_at timestamptz default now(),
  primary key (league_id, user_id, season, week)
);

-- Standings view (wins per user per week & season)
create or replace view public.standings as
select
  lm.league_id,
  p.user_id,
  g.season,
  g.week,
  sum( case when (g.winner is not null and p.pick = g.winner) then 1 else 0 end ) as wins
from league_members lm
join picks p on p.league_id = lm.league_id and p.user_id = lm.user_id
join games g on g.id = p.game_id
group by lm.league_id, p.user_id, g.season, g.week;

-- Weekly winners view (apply tiebreaker on the designated tiebreaker game)
create or replace view public.weekly_winners as
with per_user as (
  select s.league_id, s.user_id, s.season, s.week, s.wins,
         wt.total_points_guess,
         (select (g.home_score + g.away_score)
            from games g
           where g.season = s.season and g.week = s.week and g.is_tiebreaker = true
           limit 1) as actual_points
  from standings s
  left join weekly_tiebreakers wt
    on wt.league_id = s.league_id and wt.user_id = s.user_id
   and wt.season = s.season and wt.week = s.week
)
, ranked as (
  select *,
         (case when actual_points is null or total_points_guess is null then null
               else abs(actual_points - total_points_guess) end) as tb_diff,
         rank() over (
           partition by league_id, season, week
           order by wins desc nulls last,
                    (case when actual_points is null or total_points_guess is null then null else abs(actual_points - total_points_guess) end) asc nulls last
         ) as week_rank
  from per_user
)
select * from ranked;

-- RLS
alter table profiles enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table games enable row level security;
alter table weeks enable row level security;
alter table picks enable row level security;
alter table weekly_tiebreakers enable row level security;

-- Policies
-- Public read for leagues/games/weeks (read-only schedule)
create policy "read_all_leagues" on leagues for select using (true);
create policy "read_all_games" on games for select using (true);
create policy "read_all_weeks" on weeks for select using (true);

-- Profiles
create policy "read_profiles" on profiles for select using (true);
create policy "insert_own_profile" on profiles for insert with check (auth.uid() = id);
create policy "update_own_profile" on profiles for update using (auth.uid() = id);

-- Leagues
create policy "insert_league" on leagues for insert with check (auth.uid() = owner_id);
create policy "update_own_league" on leagues for update using (auth.uid() = owner_id);

-- League members
create policy "insert_self_member" on league_members for insert with check (auth.uid() = user_id);
create policy "read_own_league_members" on league_members for select using (exists (
  select 1 from league_members lm where lm.league_id = league_members.league_id and lm.user_id = auth.uid()
));

-- Picks: user can CRUD their own picks within leagues they are members of,
-- BUT lock at kickoff (no insert/update if now() >= game.kickoff)
create policy "insert_own_pick_before_kickoff" on picks for insert with check (
  auth.uid() = user_id
  and exists (select 1 from league_members lm where lm.league_id = picks.league_id and lm.user_id = auth.uid())
  and (select now() < g.kickoff from games g where g.id = picks.game_id)
);
create policy "update_own_pick_before_kickoff" on picks for update using (
  auth.uid() = user_id
  and (select now() < g.kickoff from games g where g.id = picks.game_id)
);

-- Read picks only inside leagues you belong to
create policy "read_league_picks" on picks for select using (exists (
  select 1 from league_members lm where lm.league_id = picks.league_id and lm.user_id = auth.uid()
));

-- Weekly tiebreakers: one per user/week/league; must be before tiebreaker kickoff if exists
create policy "insert_own_tiebreaker_before_kickoff" on weekly_tiebreakers for insert with check (
  auth.uid() = user_id
  and exists (select 1 from league_members lm where lm.league_id = weekly_tiebreakers.league_id and lm.user_id = auth.uid())
  and coalesce( (select (now() < g.kickoff)::bool
                 from games g
                 where g.season = weekly_tiebreakers.season
                   and g.week = weekly_tiebreakers.week
                   and g.is_tiebreaker = true
                 limit 1), true)
);
create policy "update_own_tiebreaker_before_kickoff" on weekly_tiebreakers for update using (
  auth.uid() = user_id
  and coalesce( (select (now() < g.kickoff)::bool
                 from games g
                 where g.season = weekly_tiebreakers.season
                   and g.week = weekly_tiebreakers.week
                   and g.is_tiebreaker = true
                 limit 1), true)
);
create policy "read_league_tiebreakers" on weekly_tiebreakers for select using (exists (
  select 1 from league_members lm where lm.league_id = weekly_tiebreakers.league_id and lm.user_id = auth.uid()
));

-- Admin-only mutations for games/weeks (service role)
create policy "service_manage_games" on games for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service_manage_weeks" on weeks for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
