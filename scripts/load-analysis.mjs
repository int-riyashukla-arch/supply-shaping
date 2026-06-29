import pg from 'pg'

const TRAVEL = Number(process.env.TRAVEL || 15)   // min of travel between jobs
const LEAVE  = Number(process.env.LEAVE  || 0.2)
const FALLBACK_DUR = 51

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const HOURS = Array.from({length:15},(_,i)=>8+i)   // 8..22
const fmt = h => h===12?'12P':h<12?h+'A':(h-12)+'P'

// ── pull confirmed bookings with duration ──
const client = new pg.Client({ connectionString: process.env.BOOKINGS_DB_URL, ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:15000 })
await client.connect()
const { rows } = await client.query(`
  SELECT scheduled_date,
         EXTRACT(HOUR FROM scheduled_time)*60 + EXTRACT(MINUTE FROM scheduled_time) AS start_min,
         COALESCE(total_duration_minutes, ${FALLBACK_DUR}) AS dur
  FROM public.bookings
  WHERE status='confirmed' AND scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL`)
await client.end()

// num of each weekday present
const dows = {}
const seen = new Set()
for (const r of rows){ const k=r.scheduled_date+''; if(!seen.has(k)){seen.add(k); const d=DOW[new Date(k).getDay()]; dows[d]=(dows[d]||0)+1 } }

// concurrent-load PER DATE: overlap minutes of each job with each hour bucket
const perDate = {}   // date -> {hour -> concurrent jobs}
for (const r of rows){
  const k=r.scheduled_date+''
  if(!perDate[k]){perDate[k]={}; for(const h of HOURS) perDate[k][h]=0}
  const s = Number(r.start_min), e = s + Number(r.dur) + TRAVEL
  for (const h of HOURS){
    const hs=h*60, he=hs+60
    const ov = Math.max(0, Math.min(e,he) - Math.max(s,hs))
    if(ov>0) perDate[k][h] += ov/60
  }
}
// aggregate to weekday: average AND P90 (busy-day) across the dates of that weekday
const pct=(arr,p)=>{ if(!arr.length) return 0; const a=[...arr].sort((x,y)=>x-y); const i=Math.min(a.length-1,Math.floor(p*a.length)); return a[i] }
const load={}, loadP90={}
for(const d of DAYS){ load[d]={}; loadP90[d]={} }
for(const h of HOURS){
  const byDay={}; for(const d of DAYS) byDay[d]=[]
  for(const k in perDate){ const d=DOW[new Date(k).getDay()]; if(byDay[d]) byDay[d].push(perDate[k][h]) }
  for(const d of DAYS){ const arr=byDay[d]; load[d][h]=arr.reduce((s,x)=>s+x,0)/Math.max(1,arr.length); loadP90[d][h]=pct(arr,0.9) }
}

// ── supply from roster ──
const ROSTER = [["Akshita",12,20,"Wed"],["Ashwini",9,17,"Mon"],["Bhavya",9,19,"Thu"],["Bimla",10,18,"Wed"],["Bindu",12,20,"Tue"],["Dichhin",11,19,"Wed"],["JeevithaA",9,17,"Wed"],["JeevithaM",9,17,"Tue"],["Jyoti",10,20,"Tue"],["Lalita",9,21,"Wed"],["Manju",9,21,"Thu"],["Mary",10,20,"Tue"],["Nandini",10,20,"Thu"],["Naveena",9,21,"Mon"],["Palaka",8,20,"Wed"],["Pinky",10,18,"Wed"],["Pramila",9,19,"Mon"],["Puja",9,19,"Mon"],["RSuvitha",8,20,"Tue"],["Rashika",13,21,"Wed"],["Rekha",8,20,"Tue"],["Rimpa",11,19,"Wed"],["Sanjana",9,19,"Wed"],["Smriti",11,19,"Tue"],["Suguna",12,20,"Mon"],["Sumitra",9,19,"Mon"],["Sunita",9,19,"Mon"],["Tejashree",9,19,"Tue"]].map(r=>({s:r[1],e:r[2],off:r[3]}))
const supplyAt=(d,h)=>ROSTER.filter(p=>p.off!==d && p.s<=h && h<p.e).length*(1-LEAVE)

console.log(`Travel buffer ${TRAVEL}min · leave ${LEAVE*100}% · concurrent partner-load\n`)

console.log('=== SUPPLY (partners on shift, after leave) ===')
console.log('Day   '+HOURS.map(h=>fmt(h).padStart(5)).join(''))
for(const d of DAYS) console.log(d.padEnd(5)+HOURS.map(h=>supplyAt(d,h).toFixed(1).padStart(5)).join(''))

function gapTable(title, model){
  console.log(`\n=== GAP vs ${title} (supply − need); negative = SHORT ===`)
  console.log('Day   '+HOURS.map(h=>fmt(h).padStart(5)).join(''))
  let worst=0, at=''
  for(const d of DAYS){ const cells=HOURS.map(h=>{ const g=supplyAt(d,h)-model[d][h]; if(g<worst){worst=g;at=d+' '+fmt(h)} return g })
    console.log(d.padEnd(5)+cells.map(g=>(g<0?'':' ')+g.toFixed(1).padStart(4)).join('')) }
  console.log(`Worst: ${worst.toFixed(1)} partners at ${at}`)
}
gapTable('AVERAGE day', load)
gapTable('BUSY day (P90)', loadP90)

console.log('\n=== BUSY-DAY (P90) PARTNERS NEEDED vs HAVE ===')
console.log('Day   '+HOURS.map(h=>fmt(h).padStart(5)).join(''))
for(const d of DAYS) console.log(d.padEnd(5)+HOURS.map(h=>loadP90[d][h].toFixed(1).padStart(5)).join(''))

if(process.env.JSON==='1'){
  const round=g=>{const o={};for(const d of DAYS){o[d]={};for(const h of HOURS)o[d][h]=Math.round(g[d][h]*100)/100}return o}
  console.log('JSON_START'+JSON.stringify({avg:round(load),p90:round(loadP90),hours:HOURS,span:[Math.min(...Object.keys(perDate)),Math.max(...Object.keys(perDate))]})+'JSON_END')
}
