-- Fix: Allow users to find leagues by code so they can join
--
-- The current policy only allows users to see leagues they're already members of,
-- which prevents them from joining new leagues by code.
-- This update allows anyone to SELECT leagues (needed to find a league by its join code).

-- Drop the restrictive policy
DROP POLICY IF EXISTS leagues_select_members ON leagues;
DROP POLICY IF EXISTS read_all_leagues ON leagues;

-- Create a policy that allows anyone to read leagues
-- This is safe because:
-- 1. The join code is the "password" to access the league
-- 2. Users still can't see league member details or picks unless they join
-- 3. League_members, picks, and tiebreakers have their own RLS policies
CREATE POLICY leagues_select_all
  ON leagues FOR SELECT
  USING (true);

-- Keep the existing policies for insert/update
-- (Users can only create leagues and only update their own leagues)
