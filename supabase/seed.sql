-- Seed partners
INSERT INTO partners (name, mobile, address, shift_hours, shift_start, weekly_off, has_vehicle, join_date, pin, status) VALUES
('Ashwini',              '8296996155', 'Kasavanahalli', 8,  9,  'Mon', true,  '2026-04-01', '123', 'Active'),
('Bhavya G',             '7676323627', 'Kasavanahalli', 12, 9,  'Thu', true,  '2020-05-04', '123', 'Active'),
('Bimla Singh',          '9448357607', 'Banashankari',  8,  10, 'Fri', false, '2026-02-23', '123', 'Active'),
('Jeevitha Anthony',     '8123061985', 'Kasavanahalli', 8,  9,  'Wed', true,  '2026-01-15', '123', 'Active'),
('Jeevitha M',           '0000000001', 'Kasavanahalli', 8,  9,  'Tue', false, '2025-12-01', '123', 'Active'),
('Jyoti Verma',          '0000000002', 'Banashankari',  10, 10, 'Tue', false, '2025-11-01', '123', 'Active'),
('kavya A',              '0000000003', 'Kasavanahalli', 8,  9,  'Mon', false, '2025-10-01', '123', 'Active'),
('Manju Gappu Rajbhar',  '0000000004', 'Banashankari',  12, 9,  'Thu', false, '2025-09-01', '123', 'Active'),
('Mary Korar',           '0000000005', 'Kasavanahalli', 10, 10, 'Tue', false, '2025-08-01', '123', 'Active'),
('Nandini Verma',        '0000000006', 'Banashankari',  10, 10, 'Thu', false, '2025-07-01', '123', 'Active'),
('Naveena Kumari',       '0000000007', 'Kasavanahalli', 12, 9,  'Mon', false, '2025-06-01', '123', 'Active'),
('Palaka Suvarana',      '0000000008', 'Banashankari',  12, 8,  'Wed', false, '2025-05-01', '123', 'Active'),
('Pinky Deb',            '0000000009', 'Kasavanahalli', 8,  9,  'Wed', false, '2025-04-01', '123', 'Active'),
('Pramila',              '0000000010', 'Banashankari',  8,  11, 'Tue', false, '2025-03-01', '123', 'Active'),
('Puja Bohara',          '0000000011', 'Kasavanahalli', 10, 9,  'Mon', false, '2025-02-01', '123', 'Active'),
('R Suvitha',            '0000000012', 'Banashankari',  12, 8,  'Sun', false, '2025-01-01', '123', 'Active'),
('Rekha Verma',          '0000000013', 'Kasavanahalli', 10, 9,  'Thu', false, '2024-12-01', '123', 'Active'),
('remya.k',              '0000000014', 'Banashankari',  8,  10, 'Wed', false, '2024-11-01', '123', 'Active'),
('Rimpa Dalui',          '0000000015', 'Kasavanahalli', 8,  12, 'Wed', false, '2024-10-01', '123', 'Active'),
('Sanjana Thapa',        '0000000016', 'Banashankari',  10, 9,  'Wed', false, '2024-09-01', '123', 'Active'),
('sowmya s',             '0000000017', 'Kasavanahalli', 8,  9,  'Tue', false, '2024-08-01', '123', 'Active'),
('sumitra lama',         '0000000018', 'Banashankari',  10, 9,  'Thu', false, '2024-07-01', '123', 'Active'),
('Sunita Thapa Kshetri', '0000000019', 'Kasavanahalli', 10, 9,  'Mon', false, '2024-06-01', '123', 'Active'),
('Tejashree',            '0000000020', 'Banashankari',  10, 9,  'Fri', false, '2024-05-01', '123', 'Active');

-- Seed synthetic orders (~2000 confirmed orders over last 70 days)
-- Hourly weights (normalized): 8:1.0, 9:13.9, 10:19.9, 11:23.7, 12:21.7, 13:13.1, 14:15.7, 15:22.6, 16:18.5, 17:16.4, 18:11.9, 19:10.9, 20:11.5
-- Day multipliers: Mon:1.0, Tue:0.72, Wed:0.89, Thu:0.91, Fri:1.23, Sat:1.30, Sun:1.89
-- Total raw = sum of hourly weights * sum of day multipliers = (1+13.9+19.9+23.7+21.7+13.1+15.7+22.6+18.5+16.4+11.9+10.9+11.5) * (1+0.72+0.89+0.91+1.23+1.30+1.89)
-- = 200.8 * 7.94 ≈ 1594/week, 10 weeks = ~15940 raw, scale to get ~2000 total: factor ≈ 0.1255
-- Using a DO block with generate_series to create realistic order data

DO $$
DECLARE
  day_offset int;
  order_date date;
  order_hour int;
  order_min  int;
  duration   int;
  count_for_slot int;
  i int;
  day_name text;
  day_mult float;
  hour_weight float;
  total_base float := 200.8;
  total_day_mult float := 7.94;
  scale_factor float := 0.115;

  -- hour weights array index 0=hour8, 1=hour9, ... 12=hour20
  hour_weights float[] := ARRAY[1.0, 13.9, 19.9, 23.7, 21.7, 13.1, 15.7, 22.6, 18.5, 16.4, 11.9, 10.9, 11.5];
  hours int[] := ARRAY[8,9,10,11,12,13,14,15,16,17,18,19,20];
BEGIN
  FOR day_offset IN 0..69 LOOP
    order_date := CURRENT_DATE - INTERVAL '70 days' + (day_offset * INTERVAL '1 day');

    -- Get day of week name
    day_name := to_char(order_date, 'Dy');
    -- Map to our naming
    day_name := CASE
      WHEN day_name = 'Mon' THEN 'Mon'
      WHEN day_name = 'Tue' THEN 'Tue'
      WHEN day_name = 'Wed' THEN 'Wed'
      WHEN day_name = 'Thu' THEN 'Thu'
      WHEN day_name = 'Fri' THEN 'Fri'
      WHEN day_name = 'Sat' THEN 'Sat'
      WHEN day_name = 'Sun' THEN 'Sun'
    END;

    day_mult := CASE day_name
      WHEN 'Mon' THEN 1.0
      WHEN 'Tue' THEN 0.72
      WHEN 'Wed' THEN 0.89
      WHEN 'Thu' THEN 0.91
      WHEN 'Fri' THEN 1.23
      WHEN 'Sat' THEN 1.30
      WHEN 'Sun' THEN 1.89
      ELSE 1.0
    END;

    FOR h_idx IN 1..13 LOOP
      order_hour := hours[h_idx];
      hour_weight := hour_weights[h_idx];

      -- Expected count for this hour/day combo
      count_for_slot := ROUND(hour_weight * day_mult * scale_factor)::int;
      -- Add some randomness
      count_for_slot := count_for_slot + FLOOR(RANDOM() * 3 - 1)::int;
      count_for_slot := GREATEST(0, count_for_slot);

      FOR i IN 1..count_for_slot LOOP
        order_min := FLOOR(RANDOM() * 60)::int;
        duration := 75 + FLOOR(RANDOM() * 75)::int; -- 75-150 min, avg ~112

        INSERT INTO orders (order_id, status, scheduled_date, scheduled_time, total_duration_minutes)
        VALUES (
          'ORD-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0'),
          'confirmed',
          order_date,
          make_time(order_hour, order_min, 0),
          duration
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
