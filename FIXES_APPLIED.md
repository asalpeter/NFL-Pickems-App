# Fixes Applied - NFL Pickems App

## Summary
This document outlines all the issues that were identified and fixed in your NFL Pickems application.

---

## 1. ✅ Cookie Modification Error (FIXED)

### Issue
The application was throwing errors:
```
Error: Cookies can only be modified in a Server Action or Route Handler
```

This happened because Next.js 15 enforces strict rules about where cookies can be modified. The Supabase server client was trying to set cookies in server components, which is not allowed.

### Fix Applied
Updated `lib/supabase-server.ts` to wrap cookie modification operations in try-catch blocks, allowing the code to gracefully handle cookie modifications when they're not allowed (in server components) while still allowing them in Route Handlers and Server Actions.

**File Modified**: `lib/supabase-server.ts`

---

## 2. ✅ Missing Database Column (FIXED)

### Issue
The code referenced an `onboarded` column in the `profiles` table that didn't exist in the database schema, causing runtime errors when users tried to onboard.

### Fix Applied
1. Updated the database schema in `supabase/supabase.sql` to include the `onboarded` column
2. Created a migration script `supabase/migration_add_onboarded.sql` that you can run in your Supabase SQL Editor to add this column to your existing database

**Files Created/Modified**:
- `supabase/supabase.sql`
- `supabase/migration_add_onboarded.sql` (new)

---

## 3. ✅ Missing Profile Auto-Creation (FIXED)

### Issue
Profiles weren't being automatically created when users signed up, leading to errors and manual profile creation logic scattered throughout the client code.

### Fix Applied
Created a database trigger that automatically creates a profile entry whenever a new user signs up through Supabase Auth.

**File Created**: `supabase/trigger_create_profile.sql`

---

## 4. ✅ Email Authentication Not Configured (DOCUMENTED)

### Issue
Authentication emails weren't being sent because Supabase email delivery wasn't configured.

### Fix Applied
Added comprehensive documentation in the README explaining:
- How to configure SMTP settings in Supabase
- Options for development vs production email delivery
- Where to find email templates and logs in the Supabase dashboard

**File Modified**: `README.md`

---

## 5. ✅ Security Vulnerabilities (FIXED)

### Issue
The application had critical security vulnerabilities in Next.js and other dependencies:
- Next.js v15.0.7 had 8 critical vulnerabilities including DoS, SSRF, and authorization bypass issues
- Other moderate/high severity vulnerabilities

### Fix Applied
Updated all dependencies to their latest secure versions:
- Next.js: `15.0.7` → `16.1.1`
- Fixed all glob and js-yaml vulnerabilities

---

## 6. ✅ Middleware Blocking Dashboard Access (FIXED)

### Issue
Even when logged in, users couldn't access the dashboard - they were always redirected to `/auth`.

The middleware was checking for a hardcoded cookie name `sb-access-token` that doesn't exist with Supabase SSR.

### Fix Applied
Updated `middleware.ts` to properly verify authentication using Supabase's `getUser()` method with the actual session cookies managed by Supabase SSR.

**File Modified**: `middleware.ts`

---

## 7. ✅ League Join Code Not Working (FIXED)

### Issue
Users couldn't join leagues using the join code because the Row Level Security (RLS) policy on the `leagues` table prevented them from viewing leagues they weren't already members of - creating a catch-22.

### Fix Applied
Updated the RLS policy to allow anyone to SELECT leagues (needed to find a league by its join code). This is safe because:
- The join code itself acts as the "password" to access the league
- League member details and picks are still protected by their own RLS policies
- Users can only INSERT themselves as members, not others

**Files Modified**:
- `supabase/supabase.sql`
- `supabase/rls_policies_nonrecursive.sql`
- `supabase/fix_league_join_policy.sql` (new migration)

---

## Next Steps - Action Required

To complete the setup, you need to:

### 1. Run Database Migrations
Execute these SQL scripts in your Supabase SQL Editor (in order):
```sql
-- 1. Add the onboarded column (if not already done)
-- Run: supabase/migration_add_onboarded.sql

-- 2. Set up automatic profile creation
-- Run: supabase/trigger_create_profile.sql

-- 3. Fix league join code functionality
-- Run: supabase/fix_league_join_policy.sql
```

### 2. Configure Email Delivery
Follow the instructions in the updated README.md:
1. Go to your Supabase Dashboard → Authentication → Settings
2. Enable Email provider
3. Configure SMTP settings (recommended: SendGrid, Mailgun, or AWS SES for production)
4. Test email delivery

### 3. Set Up Environment Variables
Create a `.env.local` file with your Supabase credentials:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-secure-random-string
APP_URL=http://localhost:3000
SCHEDULE_FEED_URL=https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv
SCHEDULE_SEASON=2025
SCORE_FEED_URL=https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv
```

### 4. Install Dependencies and Test
```bash
npm install
npm run dev
```

---

## Files Changed

### Modified:
- `lib/supabase-server.ts` - Fixed cookie modification error
- `middleware.ts` - Fixed authentication check for dashboard access
- `supabase/supabase.sql` - Added onboarded column and fixed league SELECT policy
- `supabase/rls_policies_nonrecursive.sql` - Fixed league SELECT policy to allow join-by-code
- `README.md` - Added comprehensive setup and email configuration instructions
- `package.json` - Updated Next.js and dependencies to fix security vulnerabilities

### Created:
- `supabase/migration_add_onboarded.sql` - Migration to add onboarded column
- `supabase/trigger_create_profile.sql` - Trigger for automatic profile creation
- `supabase/fix_league_join_policy.sql` - Fix league join code RLS policy
- `FIXES_APPLIED.md` - This document

---

## Testing Checklist

After applying the database migrations and configuring email:

- [ ] User can sign up with email/password
- [ ] Confirmation email is received
- [ ] User can sign in after confirming email
- [ ] Profile is automatically created on signup
- [ ] Onboarding flow works correctly
- [ ] Dashboard loads without errors
- [ ] Can create a league
- [ ] Can join a league
- [ ] No cookie errors in the console or logs
