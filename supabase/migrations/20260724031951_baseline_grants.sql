-- Baseline schema grants.
--
-- Postgres checks table-level GRANTs before it ever evaluates RLS
-- policies. A normal Supabase project has these grants applied
-- automatically at creation time, independent of user migrations —
-- they're what lets `anon`/`authenticated` attempt a query at all,
-- with RLS then deciding which *rows* they actually see. A fresh
-- project was found missing this baseline layer, causing
-- "permission denied for table X" (Postgres code 42501) on every
-- query, even fully authenticated ones with correct RLS policies.
--
-- Safe to run on a project that already has these grants — GRANT is
-- idempotent, it won't error or duplicate anything.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensures tables created by future migrations get these grants too,
-- without needing to repeat this file each time.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Deliberately NOT re-granting broadly on functions/routines here —
-- the 2026-06-17 migration explicitly revoked EXECUTE from anon on
-- several internal trigger functions as a security fix, and specific
-- user-facing functions already have their own explicit
-- `GRANT EXECUTE ... TO anon/authenticated` statements where needed.
-- A blanket routine grant here would silently undo that hardening.
