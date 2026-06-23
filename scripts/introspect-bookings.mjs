import pg from 'pg'

const { Client } = pg
const client = new Client({
  connectionString: process.env.BOOKINGS_DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
})

try {
  await client.connect()
  console.log('CONNECTED\n')

  const cols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings'
    ORDER BY ordinal_position
  `)
  console.log('=== COLUMNS (public.bookings) ===')
  for (const c of cols.rows) console.log(`  ${c.column_name.padEnd(32)} ${c.data_type}`)

  const count = await client.query('SELECT count(*) FROM public.bookings')
  console.log(`\n=== ROW COUNT ===\n  ${count.rows[0].count}`)

  // distinct status values (column name may vary — try common ones)
  const statusCol = cols.rows.find((c) => /status|state/i.test(c.column_name))?.column_name
  if (statusCol) {
    const st = await client.query(`SELECT "${statusCol}" AS v, count(*) AS n FROM public.bookings GROUP BY 1 ORDER BY 2 DESC LIMIT 20`)
    console.log(`\n=== DISTINCT ${statusCol} ===`)
    for (const r of st.rows) console.log(`  ${String(r.v).padEnd(28)} ${r.n}`)
  }

  console.log('\n=== SAMPLE ROW ===')
  const sample = await client.query('SELECT * FROM public.bookings ORDER BY created_at DESC NULLS LAST LIMIT 1')
  console.log(JSON.stringify(sample.rows[0], null, 2))
} catch (e) {
  console.error('ERROR:', e.message)
} finally {
  await client.end()
}
