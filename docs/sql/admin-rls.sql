-- Admin read-only RLS policies
-- Run this in Supabase SQL Editor.
-- Before running: set app_metadata for your admin account in
--   Supabase Dashboard → Authentication → Users → Edit user
--   { "role": "admin" }

-- qimen_records: admin can read all rows
CREATE POLICY "admin_read_all_qimen_records"
  ON qimen_records
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- bazi_profiles: admin can read all rows
CREATE POLICY "admin_read_all_bazi_profiles"
  ON bazi_profiles
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- qimen_feedback: admin can read all rows
CREATE POLICY "admin_read_all_qimen_feedback"
  ON qimen_feedback
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- bazi_question_audit: admin can read all rows
-- (this table currently only allows service_role; add anon/authenticated read for admin)
CREATE POLICY "admin_read_all_bazi_question_audit"
  ON bazi_question_audit
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
