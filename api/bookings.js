// Live demand API — reads confirmed bookings from the company Supabase Postgres
// (project acuwcmnijzltwvhrvjmh) and returns demand aggregated by weekday + hour.
//
// The DB connection string lives ONLY in the BOOKINGS_DB_URL env var (server-side).
// It is never shipped to the browser. The frontend fetches this endpoint as JSON.
//
// Optional query params:
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   scope the date range (defaults to all history)

import pg from 'pg'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Reuse the pool across warm invocations.
let pool
function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.BOOKINGS_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
    })
  }
  return pool
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!process.env.BOOKINGS_DB_URL) {
    return res.status(500).json({ ok: false, error: 'BOOKINGS_DB_URL is not configured' })
  }

  const { from, to } = req.query ?? {}
  const where = ["status = 'confirmed'", 'scheduled_date IS NOT NULL', 'scheduled_time IS NOT NULL']
  const params = []
  if (from) { params.push(from); where.push(`scheduled_date >= $${params.length}`) }
  if (to)   { params.push(to);   where.push(`scheduled_date <= $${params.length}`) }
  const whereSql = where.join(' AND ')

  try {
    const client = await getPool().connect()
    try {
      // Per (weekday, hour): total bookings ÷ number of distinct dates for that weekday
      // = average confirmed orders in that hour on a typical day of that weekday.
      const demandSql = `
        WITH base AS (
          SELECT scheduled_date,
                 EXTRACT(DOW  FROM scheduled_date)::int AS dow,
                 EXTRACT(HOUR FROM scheduled_time)::int AS hr
          FROM public.bookings
          WHERE ${whereSql}
        ),
        day_counts  AS (SELECT dow, COUNT(DISTINCT scheduled_date) AS num_days FROM base GROUP BY dow),
        hour_counts AS (SELECT dow, hr, COUNT(*) AS cnt FROM base GROUP BY dow, hr)
        SELECT h.dow, h.hr, h.cnt,
               (h.cnt::float / NULLIF(d.num_days, 0)) AS avg_per_hour
        FROM hour_counts h JOIN day_counts d USING (dow)
        ORDER BY h.dow, h.hr
      `
      const metaSql = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'confirmed')                       AS total_confirmed,
          COUNT(*) FILTER (WHERE status = 'cancelled')                       AS total_cancelled,
          MIN(scheduled_date) FILTER (WHERE status = 'confirmed')            AS date_from,
          MAX(scheduled_date) FILTER (WHERE status = 'confirmed')            AS date_to,
          ROUND(AVG(total_duration_minutes) FILTER (WHERE status = 'confirmed'))::int AS avg_duration_min
        FROM public.bookings
      `
      const [demandRes, metaRes] = await Promise.all([
        client.query(demandSql, params),
        client.query(metaSql),
      ])

      // Shape into { Mon: { 8: 1.2, ... }, Tue: {...}, ... }
      const demand = {}
      for (const day of DOW) demand[day] = {}
      for (const r of demandRes.rows) {
        const day = DOW[r.dow]
        demand[day][r.hr] = Number(r.avg_per_hour)
      }

      const m = metaRes.rows[0] ?? {}
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
      return res.status(200).json({
        ok: true,
        meta: {
          totalConfirmed: Number(m.total_confirmed ?? 0),
          totalCancelled: Number(m.total_cancelled ?? 0),
          dateFrom: m.date_from ?? null,
          dateTo: m.date_to ?? null,
          avgDurationMin: Number(m.avg_duration_min ?? 0),
          scopedFrom: from ?? null,
          scopedTo: to ?? null,
        },
        demand,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}
