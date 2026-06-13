-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  mobile       text NOT NULL,
  address      text,
  shift_hours  int  CHECK (shift_hours IN (8, 10, 12)),
  shift_start  int  CHECK (shift_start BETWEEN 0 AND 23),
  weekly_off   text CHECK (weekly_off IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  has_vehicle  boolean DEFAULT false,
  join_date    date,
  pin          text,
  status       text DEFAULT 'Active' CHECK (status IN ('Active','Exited')),
  created_at   timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 text,
  status                   text,
  scheduled_date           date,
  scheduled_time           time,
  total_duration_minutes   int,
  created_at               timestamptz DEFAULT now()
);

-- Enable RLS and open anon read/write for demo
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read partners"   ON partners FOR SELECT USING (true);
CREATE POLICY "Allow anon insert partners" ON partners FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update partners" ON partners FOR UPDATE USING (true);

CREATE POLICY "Allow anon read orders"   ON orders FOR SELECT USING (true);
CREATE POLICY "Allow anon insert orders" ON orders FOR INSERT WITH CHECK (true);
