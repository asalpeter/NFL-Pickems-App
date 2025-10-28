-- ===== SAFETY: enable RLS on all relevant tables =====
alter table if exists league_members enable row level security;
alter table if exists picks enable row level security;
alter table if exists weekly_tiebreakers enable row level security;
alter table if exists leagues enable row level security;

-- ===== 1) league_members: unique membership + non-recursive policies =====
-- Make (league_id, user_id) unique (don’t change primary keys to avoid breakage)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'league_members_unique_member'
  ) then
    alter table league_members
      add constraint league_members_unique_member unique (league_id, user_id);
  end if;
end $$;

-- Drop any existing policies that might be recursive or conflicting
drop policy if exists lm_select on league_members;
drop policy if exists lm_insert on league_members;
drop policy if exists lm_update on league_members;
drop policy if exists lm_delete on league_members;

drop policy if exists lm_select_self on league_members;
drop policy if exists lm_insert_self on league_members;
drop policy if exists lm_update_self on league_members;
drop policy if exists lm_delete_self on league_members;

-- Only the membership row owner can read/change their row
create policy lm_select_self
  on league_members for select
  using (user_id = auth.uid());

create policy lm_insert_self
  on league_members for insert
  with check (user_id = auth.uid());

create policy lm_update_self
  on league_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy lm_delete_self
  on league_members for delete
  using (user_id = auth.uid());

-- ===== 2) picks: FK to league_members + self-only policies =====
-- Ensure league_id column exists (nullable is safer for existing rows)
alter table picks
  add column if not exists league_id uuid;

-- Drop old FK if present, then add composite FK via the unique constraint above
alter table picks drop constraint if exists picks_member_fk;
alter table picks
  add constraint picks_member_fk
  foreign key (league_id, user_id)
  references league_members (league_id, user_id)
  on delete cascade;

-- Replace picks policies with clean, non-recursive, self-only rules
drop policy if exists picks_select on picks;
drop policy if exists picks_insert on picks;
drop policy if exists picks_update on picks;
drop policy if exists picks_delete on picks;

drop policy if exists picks_select_self on picks;
drop policy if exists picks_insert_self on picks;
drop policy if exists picks_update_self on picks;
drop policy if exists picks_delete_self on picks;

create policy picks_select_self
  on picks for select
  using (user_id = auth.uid());

create policy picks_insert_self
  on picks for insert
  with check (user_id = auth.uid());

create policy picks_update_self
  on picks for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy picks_delete_self
  on picks for delete
  using (user_id = auth.uid());

-- Optional (recommended once data is clean):
-- alter table picks alter column league_id set not null;

-- ===== 3) weekly_tiebreakers: mirror picks (self-only + FK to membership) =====
-- Add FK so only members can have tiebreakers; cascade delete on membership removal
alter table weekly_tiebreakers drop constraint if exists tiebreaker_member_fk;
alter table weekly_tiebreakers
  add constraint tiebreaker_member_fk
  foreign key (league_id, user_id)
  references league_members (league_id, user_id)
  on delete cascade;

drop policy if exists tb_select on weekly_tiebreakers;
drop policy if exists tb_insert on weekly_tiebreakers;
drop policy if exists tb_update on weekly_tiebreakers;
drop policy if exists tb_delete on weekly_tiebreakers;

drop policy if exists tb_select_self on weekly_tiebreakers;
drop policy if exists tb_insert_self on weekly_tiebreakers;
drop policy if exists tb_update_self on weekly_tiebreakers;
drop policy if exists tb_delete_self on weekly_tiebreakers;

create policy tb_select_self
  on weekly_tiebreakers for select
  using (user_id = auth.uid());

create policy tb_insert_self
  on weekly_tiebreakers for insert
  with check (user_id = auth.uid());

create policy tb_update_self
  on weekly_tiebreakers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy tb_delete_self
  on weekly_tiebreakers for delete
  using (user_id = auth.uid());

-- ===== 4) leagues: members-only visibility (safe, non-recursive) =====
drop policy if exists leagues_select_members on leagues;

create policy leagues_select_members
  on leagues for select
  using (
    exists (
      select 1
      from league_members lm
      where lm.league_id = leagues.id
        and lm.user_id = auth.uid()
    )
  );
