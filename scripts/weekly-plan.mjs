import pg from 'pg'

const CAP = 0.80, LEAVE = 0.20
const EFF = (1 - LEAVE) * CAP            // servable orders/hr per partner = 0.64
const APP_URL = 'https://klwrdziyjdjtyfiebcne.supabase.co'
const APP_KEY = process.env.APP_KEY
const N_NEW = Number(process.env.N_NEW || 12)
const GROWTH = Number(process.env.GROWTH || 1.43)  // plan for demand growth / peak headroom (1.43 ≈ +12 partners of capacity)

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i)  // 8..20
const fmt = (h) => h === 12 ? '12PM' : h < 12 ? `${h}AM` : `${h - 12}PM`

// ── 1. Live demand per weekday × hour (avg orders/hr) ──────────────────────────
const client = new pg.Client({ connectionString: process.env.BOOKINGS_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 })
await client.connect()
const res = await client.query(`
  WITH base AS (
    SELECT scheduled_date, EXTRACT(DOW FROM scheduled_date)::int AS dow, EXTRACT(HOUR FROM scheduled_time)::int AS hr
    FROM public.bookings WHERE status='confirmed' AND scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL),
  dc AS (SELECT dow, COUNT(DISTINCT scheduled_date) nd FROM base GROUP BY dow),
  hc AS (SELECT dow, hr, COUNT(*) c FROM base GROUP BY dow, hr)
  SELECT hc.dow, hc.hr, hc.c::float/NULLIF(dc.nd,0) AS avg FROM hc JOIN dc USING(dow)`)
await client.end()

const demand = {}; for (const d of DAYS) { demand[d] = {}; for (const h of HOURS) demand[d][h] = 0 }
for (const r of res.rows) { const d = DOW[r.dow]; if (demand[d] && HOURS.includes(r.hr)) demand[d][r.hr] = Number(r.avg) }

// ── 2. Current supply from your roster ─────────────────────────────────────────
const pr = await fetch(`${APP_URL}/rest/v1/partners?select=shift_start,shift_hours,weekly_off&status=eq.Active`, { headers: { apikey: APP_KEY, Authorization: `Bearer ${APP_KEY}` } })
const partners = await pr.json()
const covers = (p, d, h) => p.weekly_off !== d && h >= p.shift_start && h < p.shift_start + p.shift_hours

function servableGrid(list) {
  const g = {}; for (const d of DAYS) { g[d] = {}; for (const h of HOURS) g[d][h] = list.filter((p) => covers(p, d, h)).length * EFF }
  return g
}
function deficit(grid, mult = 1) { let t = 0; for (const d of DAYS) for (const h of HOURS) { const x = demand[d][h] * mult - grid[d][h]; if (x > 0) t += x } return t }

// ── 3. Weekly demand picture ───────────────────────────────────────────────────
console.log('=== WEEKLY DEMAND (live, avg orders/hr) ===')
console.log('Day    ' + HOURS.map((h) => fmt(h).padStart(5)).join('') + '   TOTAL')
for (const d of DAYS) {
  const tot = HOURS.reduce((s, h) => s + demand[d][h], 0)
  console.log(d.padEnd(6) + HOURS.map((h) => demand[d][h].toFixed(1).padStart(5)).join('') + '   ' + tot.toFixed(1).padStart(5))
}

let grid = servableGrid(partners)
console.log(`\nCurrent active partners: ${partners.length}`)
console.log(`Current weekly unmet demand (orders/hr summed over week): ${deficit(grid).toFixed(1)}`)

// ── 4. Greedily place N new partners ───────────────────────────────────────────
// Candidate shift templates: 8/10/12h, starts 6..12, weekly off = any day.
const templates = []
for (const len of [8, 10, 12]) for (const st of [6, 7, 8, 9, 10, 11, 12]) { if (st + len > 21) continue; for (const off of DAYS) templates.push({ len, st, off }) }

function scoreOf(t, grid) {
  // Marginal value: demand weighted by how thin existing coverage is (diminishing returns),
  // so the 12 spread to mirror the demand surface instead of stacking on one window.
  let val = 0
  for (const d of DAYS) { if (d === t.off) continue; for (let h = t.st; h < t.st + t.len; h++) { if (!HOURS.includes(h)) continue; if (demand[d][h] < 0.5) continue; val += demand[d][h] / (1 + grid[d][h]) } }
  return val
}

const hires = []
const sim = partners.map((p) => ({ ...p }))
for (let i = 0; i < N_NEW; i++) {
  grid = servableGrid(sim)
  let best = null
  for (const t of templates) {
    const s = scoreOf(t, grid)
    if (!best || s > best.s + 1e-9 || (Math.abs(s - best.s) < 1e-9 && (t.len < best.t.len || (t.len === best.t.len && t.st < best.t.st)))) best = { t, s }
  }
  hires.push(best)
  sim.push({ shift_start: best.t.st, shift_hours: best.t.len, weekly_off: best.t.off })
}

console.log(`\n=== RECOMMENDED SHIFTS FOR ${N_NEW} NEW PARTNERS ===`)
console.log('#   Shift            Hrs   Weekly off   Orders/day rescued')
hires.forEach((h, i) => {
  console.log(`${String(i + 1).padEnd(3)} ${(fmt(h.t.st) + '–' + fmt(h.t.st + h.t.len)).padEnd(16)} ${String(h.t.len + 'h').padEnd(5)} ${h.t.off.padEnd(12)} ${h.s.toFixed(2)}`)
})

grid = servableGrid(sim)
console.log(`\nPlanning target: cover demand × ${GROWTH} (growth/peak headroom)`)
console.log(`Unmet vs TODAY's demand   — before: ${deficit(servableGrid(partners), 1).toFixed(1)}   after: ${deficit(grid, 1).toFixed(1)}`)
console.log(`Unmet vs GROWN demand(×${GROWTH}) — before: ${deficit(servableGrid(partners), GROWTH).toFixed(1)}   after: ${deficit(grid, GROWTH).toFixed(1)}`)

// summary of shift distribution
const byStart = {}, byOff = {}
for (const h of hires) { const k = fmt(h.t.st) + '–' + fmt(h.t.st + h.t.len); byStart[k] = (byStart[k] || 0) + 1; byOff[h.t.off] = (byOff[h.t.off] || 0) + 1 }
console.log('\nShift windows:', Object.entries(byStart).map(([k, v]) => `${v}× ${k}`).join(',  '))
console.log('Weekly-off split:', Object.entries(byOff).map(([k, v]) => `${v}× ${k}`).join(',  '))
