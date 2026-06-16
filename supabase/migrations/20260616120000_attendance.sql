-- Attendance: two-step daily attendance (app check-in → hub-manager validation)
-- Statuses: present | weekly_off | unpaid_leave

CREATE TABLE IF NOT EXISTS attendance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  date        date NOT NULL,
  checkin_at  timestamptz,
  status      text CHECK (status IN ('present','weekly_off','unpaid_leave')),
  validated   boolean DEFAULT false,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (partner_id, date)
);

-- Fix the CHECK constraint on any table that predates the status rename
-- (was: present | absent | leave).
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD  CONSTRAINT attendance_status_check
  CHECK (status IN ('present','weekly_off','unpaid_leave'));

-- Enable RLS and open anon read/write for demo
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read attendance"   ON attendance;
DROP POLICY IF EXISTS "Allow anon insert attendance" ON attendance;
DROP POLICY IF EXISTS "Allow anon update attendance" ON attendance;

CREATE POLICY "Allow anon read attendance"   ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow anon insert attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update attendance" ON attendance FOR UPDATE USING (true);
