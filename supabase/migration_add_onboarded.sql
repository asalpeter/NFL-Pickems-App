-- Migration: Add onboarded column to profiles table
-- Run this in your Supabase SQL editor

-- Add the onboarded column to the profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;

-- Update existing profiles to be marked as onboarded
-- (assuming existing users have already completed onboarding)
UPDATE public.profiles SET onboarded = true WHERE username IS NOT NULL;
