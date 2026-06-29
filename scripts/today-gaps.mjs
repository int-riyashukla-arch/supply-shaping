import pg from 'pg'

const TODAY = process.env.TODAY || '2026-06-24'
const CAP = 0.80          // orders a partner can serve per hour
const LEAVE = 0.20        // assumed absentee buffer
const APP_URL = 'https://klwrdziyjdjtyfiebcne.supabase.co'
const APP_KEY = process.env.APP_KEY

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const todayName = DOW[new Date(TODAY + 'T12:00:00').getDay()]

// 1) DEMAND — today's confirmed orders per hour from the company bookings DB
const client = new pg.Client({
  connectionString: process.env.BOOKINGS_DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
})
await client.connect()
const demRes = await client.query(
  `SELECT EXTRACT(HOUR FROM scheduled_time)::int AS hr, COUNT(*) AS cnt
   FROM public.bookings
   WHERE status = 'confirmed' AND scheduled_date = $1
   GROUP BY 1 ORDER BY 1`,
  [TODAY]
)
await client.end()
const demand = {}
for (const r of demRes.rows) demand[r.hr] = Number(r.cnt)

// 2) SUPPLY — active partners on shift each hour, from your own Supabase
const pRes = await fetch(`${APP_URL}/rest/v1/partners?select=shift_start,shift_hours,weekly_off,status&status=eq.Active`, {
  headers: { apikey: APP_KEY, Authorization: `Bearer ${APP_KEY}` },
})
const partners = await pRes.json()
const onShift = (p, h) => p.weekly_off !== todayName && h >= p.shift_start && h < p.shift_start + p.shift_hours

// 3) COMPARE
console.log(`\n=== ${TODAY} (${todayName}) — live demand vs supply ===`)
console.log(`Active partners: ${partners.length} | capacity ${CAP}/hr | leave buffer ${LEAVE * 100}%\n`)
console.log('hour   demand   partners   servable   gap')
let totalGap = 0
for (let h = 8; h <= 20; h++) {
  const d = demand[h] ?? 0
  const sched = partners.filter((p) => onShift(p, h)).length
  const servable = sched * (1 - LEAVE) * CAP
  const gap = d - servable
  if (gap > 0) totalGap += gap
  const flag = gap > 0 ? `  ⚠ SHORT by ${gap.toFixed(1)}` : ''
  const label = h === 12 ? '12PM' : h < 12 ? `${h}AM` : `${h - 12}PM`
  console.log(`${label.padEnd(6)} ${String(d).padStart(5)}   ${String(sched).padStart(7)}   ${servable.toFixed(1).padStart(8)}   ${gap > 0 ? '+' : ''}${gap.toFixed(1).padStart(5)}${flag}`)
}
console.log(`\nTotal unmet orders today: ${totalGap.toFixed(1)}`)
const totalDem = Object.values(demand).reduce((a, b) => a + b, 0)
console.log(`Total confirmed orders today: ${totalDem}`)
