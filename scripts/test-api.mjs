// Loads .env, invokes the real api/bookings.js handler with a mock req/res.
import fs from 'node:fs'
import handler from '../api/bookings.js'

// minimal .env loader
for (const line of fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

const req = { method: 'GET', query: {} }
const res = {
  _status: 200,
  setHeader() {},
  status(c) { this._status = c; return this },
  json(obj) {
    console.log('STATUS', this._status)
    console.log('META', JSON.stringify(obj.meta, null, 2))
    if (obj.demand) {
      console.log('\nDEMAND (avg confirmed orders/hr by weekday × hour):')
      const hours = [8,9,10,11,12,13,14,15,16,17,18,19,20]
      process.stdout.write('day   ' + hours.map(h => String(h).padStart(5)).join('') + '\n')
      for (const d of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']) {
        const row = obj.demand[d] || {}
        process.stdout.write(d.padEnd(6) + hours.map(h => (row[h] ? row[h].toFixed(1) : '·').padStart(5)).join('') + '\n')
      }
    }
    return this
  },
  end() { console.log('STATUS', this._status, '(no body)'); return this },
}

await handler(req, res)
process.exit(0)
