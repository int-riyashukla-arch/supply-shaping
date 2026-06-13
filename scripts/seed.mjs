import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://klwrdziyjdjtyfiebcne.supabase.co'
const SUPABASE_KEY = 'sb_publishable_SZYIzowEQv22UTQZNLvQNQ_mkgkkRzX'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Partners ────────────────────────────────────────────────────────────────

const partners = [
  { name: 'Ashwini',              mobile: '8296996155', address: 'Kasavanahalli', shift_hours: 8,  shift_start: 9,  weekly_off: 'Mon', has_vehicle: true,  join_date: '2026-04-01', pin: '123', status: 'Active' },
  { name: 'Bhavya G',             mobile: '7676323627', address: 'Kasavanahalli', shift_hours: 12, shift_start: 9,  weekly_off: 'Thu', has_vehicle: true,  join_date: '2020-05-04', pin: '123', status: 'Active' },
  { name: 'Bimla Singh',          mobile: '9448357607', address: 'Banashankari',  shift_hours: 8,  shift_start: 10, weekly_off: 'Fri', has_vehicle: false, join_date: '2026-02-23', pin: '123', status: 'Active' },
  { name: 'Jeevitha Anthony',     mobile: '8123061985', address: 'Kasavanahalli', shift_hours: 8,  shift_start: 9,  weekly_off: 'Wed', has_vehicle: true,  join_date: '2026-01-15', pin: '123', status: 'Active' },
  { name: 'Jeevitha M',           mobile: '0000000001', address: 'Kasavanahalli', shift_hours: 8,  shift_start: 9,  weekly_off: 'Tue', has_vehicle: false, join_date: '2025-12-01', pin: '123', status: 'Active' },
  { name: 'Jyoti Verma',          mobile: '0000000002', address: 'Banashankari',  shift_hours: 10, shift_start: 10, weekly_off: 'Tue', has_vehicle: false, join_date: '2025-11-01', pin: '123', status: 'Active' },
  { name: 'kavya A',              mobile: '0000000003', address: 'Kasavanahalli', shift_hours: 8,  shift_start: 9,  weekly_off: 'Mon', has_vehicle: false, join_date: '2025-10-01', pin: '123', status: 'Active' },
  { name: 'Manju Gappu Rajbhar',  mobile: '0000000004', address: 'Banashankari',  shift_hours: 12, shift_start: 9,  weekly_off: 'Thu', has_vehicle: false, join_date: '2025-09-01', pin: '123', status: 'Active' },
  { name: 'Mary Korar',           mobile: '0000000005', address: 'Kasavanahalli', shift_hours: 10, shift_start: 10, weekly_off: 'Tue', has_vehicle: false, join_date: '2025-08-01', pin: '123', status: 'Active' },
  { name: 'Nandini Verma',        mobile: '0000000006', address: 'Banashankari',  shift_hours: 10, shift_start: 10, weekly_off: 'Thu', has_vehicle: false, join_date: '2025-07-01', pin: '123', status: 'Active' },
  { name: 'Naveena Kumari',       mobile: '0000000007', address: 'Kasavanahalli', shift_hours: 12, shift_start: 9,  weekly_off: 'Mon', has_vehicle: false, join_date: '2025-06-01', pin: '123', status: 'Active' },
  { name: 'Palaka Suvarana',      mobile: '0000000008', address: 'Banashankari',  shift_hours: 12, shift_start: 8,  weekly_off: 'Wed', has_vehicle: false, join_date: '2025-05-01', pin: '123', status: 'Active' },
  { name: 'Pinky Deb',            mobile: '0000000009', address: 'Kasavanahalli', shift_hours: 8,  shift_start: 9,  weekly_off: 'Wed', has_vehicle: false, join_date: '2025-04-01', pin: '123', status: 'Active' },
  { name: 'Pramila',              mobile: '0000000010', address: 'Banashankari',  shift_hours: 8,  shift_start: 11, weekly_off: 'Tue', has_vehicle: false, join_date: '2025-03-01', pin: '123', status: 'Active' },
  { name: 'Puja Bohara',          mobile: '0000000011', address: 'Kasavanahalli', shift_hours: 10, shift_start: 9,  weekly_off: 'Mon', has_vehicle: false, join_date: '2025-02-01', pin: '123', status: 'Active' },
  { name: 'R Suvitha',            mobile: '0000000012', address: 'Banashankari',  shift_hours: 12, shift_start: 8,  weekly_off: 'Sun', has_vehicle: false, join_date: '2025-01-01', pin: '123', status: 'Active' },
  { name: 'Rekha Verma',          mobile: '0000000013', address: 'Kasavanahalli', shift_hours: 10, shift_start: 9,  weekly_off: 'Thu', has_vehicle: false, join_date: '2024-12-01', pin: '123', status: 'Active' },
  { name: 'remya.k',              mobile: '0000000014', address: 'Banashankari',  shift_hours: 8,  shift_start: 10, weekly_off: 'Wed', has_vehicle: false, join_date: '2024-11-01', pin: '123', status: 'Active' },
  { name: 'Rimpa Dalui',          mobile: '0000000015', address: 'Kasavanahalli', shift_hours: 8,  shift_start: 12, weekly_off: 'Wed', has_vehicle: false, join_date: '2024-10-01', pin: '123', status: 'Active' },
  { name: 'Sanjana Thapa',        mobile: '0000000016', address: 'Banashankari',  shift_hours: 10, shift_start: 9,  weekly_off: 'Wed', has_vehicle: false, join_date: '2024-09-01', pin: '123', status: 'Active' },
  { name: 'sowmya s',             mobile: '0000000017', address: 'Kasavanahalli', shift_hours: 8,  shift_start: 9,  weekly_off: 'Tue', has_vehicle: false, join_date: '2024-08-01', pin: '123', status: 'Active' },
  { name: 'sumitra lama',         mobile: '0000000018', address: 'Banashankari',  shift_hours: 10, shift_start: 9,  weekly_off: 'Thu', has_vehicle: false, join_date: '2024-07-01', pin: '123', status: 'Active' },
  { name: 'Sunita Thapa Kshetri', mobile: '0000000019', address: 'Kasavanahalli', shift_hours: 10, shift_start: 9,  weekly_off: 'Mon', has_vehicle: false, join_date: '2024-06-01', pin: '123', status: 'Active' },
  { name: 'Tejashree',            mobile: '0000000020', address: 'Banashankari',  shift_hours: 10, shift_start: 9,  weekly_off: 'Fri', has_vehicle: false, join_date: '2024-05-01', pin: '123', status: 'Active' },
]

// ─── Order generation ─────────────────────────────────────────────────────────

// Hour weights from spec (weekly avg orders/hour)
const HOUR_WEIGHTS = { 8:1.0, 9:13.9, 10:19.9, 11:23.7, 12:21.7, 13:13.1, 14:15.7, 15:22.6, 16:18.5, 17:16.4, 18:11.9, 19:10.9, 20:11.5 }
const DAY_MULT = { 0:1.89, 1:1.0, 2:0.72, 3:0.89, 4:0.91, 5:1.23, 6:1.30 } // JS getDay: 0=Sun
const SCALE = 0.115  // tunes total ~2000 orders over 70 days

function pad(n) { return String(n).padStart(2, '0') }

function generateOrders() {
  const orders = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let d = 69; d >= 0; d--) {
    const date = new Date(today)
    date.setDate(today.getDate() - d)
    const dow = date.getDay()
    const mult = DAY_MULT[dow] ?? 1
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`

    for (const [hourStr, weight] of Object.entries(HOUR_WEIGHTS)) {
      const hour = Number(hourStr)
      const expected = weight * mult * SCALE
      // Poisson-ish: round with random rounding
      let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0)
      // add ±1 noise
      count = Math.max(0, count + (Math.random() < 0.3 ? 1 : Math.random() < 0.3 ? -1 : 0))

      for (let i = 0; i < count; i++) {
        const min = Math.floor(Math.random() * 60)
        const duration = 75 + Math.floor(Math.random() * 75) // 75–150 min
        const ordNum = String(Math.floor(Math.random() * 999999)).padStart(6, '0')
        orders.push({
          order_id: `ORD-${ordNum}`,
          status: 'confirmed',
          scheduled_date: dateStr,
          scheduled_time: `${pad(hour)}:${pad(min)}:00`,
          total_duration_minutes: duration,
        })
      }
    }
  }
  return orders
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Check if already seeded
  const { count: partnerCount } = await supabase.from('partners').select('*', { count: 'exact', head: true })
  if (partnerCount > 0) {
    console.log(`Partners table already has ${partnerCount} rows — skipping partner seed.`)
  } else {
    console.log('Seeding 24 partners...')
    const { error } = await supabase.from('partners').insert(partners)
    if (error) { console.error('Partner seed failed:', error.message); process.exit(1) }
    console.log('✓ Partners seeded.')
  }

  const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true })
  if (orderCount > 0) {
    console.log(`Orders table already has ${orderCount} rows — skipping order seed.`)
  } else {
    const orders = generateOrders()
    console.log(`Seeding ${orders.length} synthetic orders...`)

    // Insert in batches of 500
    for (let i = 0; i < orders.length; i += 500) {
      const batch = orders.slice(i, i + 500)
      const { error } = await supabase.from('orders').insert(batch)
      if (error) { console.error('Order seed failed:', error.message); process.exit(1) }
      console.log(`  inserted ${Math.min(i + 500, orders.length)}/${orders.length}...`)
    }
    console.log(`✓ ${orders.length} orders seeded.`)
  }

  console.log('\nDone! Supabase is ready.')
}

main()
