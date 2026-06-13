// ─────────────────────────────────────────────────────────────────────────────
// Smart Assigner — mockup data + recommendation engine
//
// Demonstrates the ops "smart assigner": for every order it RECOMMENDS one
// partner (it never auto-assigns). The ops team approves or rejects.
//
// Logic (from the ops flowchart):
//   new order → look at its LOCATION
//     is a partner already at that location (same apartment complex)?
//        YES → is that partner's current service over by the order's start time?
//                 YES → recommend that partner   (no travel, already on-site)
//                 NO  → recommend from the HUB
//        NO  → recommend from the HUB            (nearest free partner)
// ─────────────────────────────────────────────────────────────────────────────

export type OrderType = 'prebooked' | 'instant' | 'new'

export interface OrderService {
  name: string
  qty: number
  minutes: number
}

export interface MockOrder {
  id: string
  timeLabel: string
  startMin: number
  customer: string
  phone: string
  address: string
  complex: string
  pincode: string
  servicesRaw: string
  services: OrderService[]
  durationMin: number
  status: string
  stage: string
  amount: number
  assignedPartner: string | null // locked (already assigned upstream)
  type: OrderType
}

export interface RosterPartner {
  name: string
  hasVehicle: boolean
}

export type RecKind = 'nearby' | 'hub' | 'delayed'

export interface Recommendation {
  orderId: string
  partner: string
  kind: RecKind
  reason: string
  freeAtLabel: string
  delayMin: number // >0 means the partner only frees up after the order start
}

// ─── Time helpers ──────────────────────────────────────────────────────────────

export function parseTimeToMin(label: string): number {
  const m = label.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ap = m[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return h * 60 + min
}

export function fmtMin(total: number): string {
  let h = Math.floor(total / 60) % 24
  const m = total % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${String(m).padStart(2, '0')} ${ap}`
}

// ─── Service duration estimation ────────────────────────────────────────────────

const PER_UNIT = /eyebrow|upper lip|\bchin\b|forehead|sidelock|threading|henna|top.?up/i

const DURATION_RULES: [RegExp, number][] = [
  [/o3\+?\s*detan/i, 50],
  [/o3\+?\s*whitening/i, 40],
  [/o3\+?\s*(shine|glow)/i, 80],
  [/skin miracle|korean|facial/i, 80],
  [/sara fruit/i, 40],
  [/henna/i, 45],
  [/hair root|root touch/i, 35],
  [/blow dry|styling|straighten/i, 25],
  [/full arms\s*\+\s*full legs/i, 65],
  [/full arms.*underarms|underarms.*full arms/i, 35],
  [/full legs.*detan|legs detan/i, 35],
  [/full arms.*detan|arms detan/i, 30],
  [/full legs/i, 30],
  [/full arms/i, 25],
  [/\bback\b/i, 20],
  [/stomach/i, 18],
  [/underarms/i, 10],
  [/legs bleach/i, 35],
  [/arms bleach|face.*bleach|neck bleach/i, 28],
  [/face\s*&?\s*neck detan|neck detan|detan/i, 30],
  [/head\s*&?\s*shoulders/i, 25],
  [/foot/i, 20],
  [/saree|draping/i, 30],
  [/full face threading/i, 18],
  [/eyebrow/i, 10],
  [/upper lip|\bchin\b|forehead|sidelock/i, 5],
  [/top.?up/i, 15],
  [/any threading|threading/i, 10],
  [/cut|file|polish|hands|feet/i, 20],
  [/cleanup|clean-?up/i, 40],
  [/wax/i, 25],
  [/massage/i, 20],
]

function serviceMinutes(name: string): number {
  for (const [re, mins] of DURATION_RULES) if (re.test(name)) return mins
  return 20
}

function parseServices(raw: string): { services: OrderService[]; total: number } {
  const parts = raw.split(';').map((s) => s.trim()).filter(Boolean)
  const services: OrderService[] = []
  let total = 0
  for (const part of parts) {
    const qm = part.match(/x\s*(\d+)\s*$/i)
    const qty = qm ? parseInt(qm[1], 10) : 1
    const name = part.replace(/\s*x\s*\d+\s*$/i, '').trim()
    const base = serviceMinutes(name)
    const minutes = PER_UNIT.test(name) ? base * qty : base
    services.push({ name, qty, minutes })
    total += minutes
  }
  return { services, total: total + 10 } // +10 min setup/handover buffer
}

// ─── Location (apartment complex) extraction ─────────────────────────────────────

const COMPLEX_RULES: [RegExp, string][] = [
  [/dsr highland|highland greenz/i, 'DSR Highland Greenz'],
  [/suncity gloria/i, 'Suncity Gloria'],
  [/purva sky wood/i, 'Purva Sky Wood'],
  [/meadows in the sun/i, 'Meadows in the Sun'],
  [/ahad euphoria/i, 'Ahad Euphoria'],
  [/ahad serenity/i, 'Ahad Serenity'],
  [/prestige ferns/i, 'Prestige Ferns Residency'],
  [/shriram chirping/i, 'Shriram Chirping Woods'],
  [/bren paddington/i, 'Bren Paddington'],
  [/keerthi/i, 'Keerthi Regalia'],
  [/spring woods/i, 'SLS Spring Woods'],
  [/klassik landmark/i, 'Klassik Landmark'],
  [/uber verd/i, 'Uber Verdant'],
  [/amber/i, 'Concorde Amber'],
  [/callipolis/i, 'Saket Callipolis'],
  [/sai sankalp/i, 'Sai Sankalp'],
  [/bhuvana greens/i, 'Bhuvana Greens'],
  [/mana capitol/i, 'Mana Capitol'],
  [/central regency/i, 'Central Regency'],
  [/park vista/i, 'SJR Park Vista'],
  [/adarsh palm/i, 'Adarsh Palm Retreat'],
]

function extractComplex(address: string): string {
  for (const [re, name] of COMPLEX_RULES) if (re.test(address)) return name
  return 'Unmapped area'
}

function extractPincode(address: string): string {
  const m = address.match(/\b(5\d{5})\b/)
  return m ? m[1] : '—'
}

// ─── Raw order data (Saathi · 14 Jun 2026 · Sarjapur Road hub) ───────────────────

interface RawOrder {
  id: string; t: string; cust: string; ph: string; addr: string
  svc: string; status: string; stage: string; amt: number; p: string
}

const RAW: RawOrder[] = [
  { id: 'BLUSH055774', t: '10:00 AM', cust: 'Bhavneet', ph: '9582464104', addr: '2A 613, Suncity Gloria, Sarjapur Road, 560035', svc: 'Face & Neck Detan x1; Any Threading (Add-on) x1', status: 'rescheduled', stage: 'order_accepted', amt: 0, p: 'Suguna S' },
  { id: 'BLUSH987189', t: '9:00 AM', cust: 'Sthiti', ph: '8895274411', addr: 'C-504, Saket Callipolis, Sarjapur Road, 560035', svc: 'O3+ Whitening Clean-Up x1; Eyebrow Threading x1; Forehead Threading x1', status: 'confirmed', stage: 'assigned', amt: 397, p: 'R Suvitha' },
  { id: 'BLUSH064013', t: '10:00 AM', cust: 'Anshika', ph: '8285568996', addr: 'Wing3-304, Ahad Euphoria, Sarjapur Road, 560035', svc: 'Head & Shoulders Massage x1; Any Threading (Add-on) x1', status: 'rescheduled', stage: 'assigned', amt: 1, p: 'Ashwini' },
  { id: 'BLUSH914104', t: '10:00 AM', cust: 'Nikita Kumari', ph: '9534808408', addr: 'Flat NO 202, Sai Sankalp Apartments, Sarjapur Road, 560035', svc: 'Face & Neck Detan x1; Any Threading (Add-on) x1', status: 'confirmed', stage: 'assigned', amt: 0, p: 'Lalita dishai' },
  { id: 'BLUSH317782', t: '10:30 AM', cust: 'Deepa', ph: '7738640024', addr: 'A601, Meadows in the Sun, Sarjapur Road, 560035', svc: 'Eyebrow Threading x1; Chocolate Wax (Roll-on) – Full Arms + Underarms (Peel-off) x1', status: 'confirmed', stage: 'assigned', amt: 798, p: 'Nandini Verma' },
  { id: 'BLUSH138902', t: '11:00 AM', cust: 'Mohini Banga', ph: '9654203884', addr: '10706 Tower 1, Bhuvana Greens, Sarjapur Road, 560035', svc: 'Head & Shoulders Massage x1; 15-Min Top-Up x2; Full Arms Detan x1; O3+ Detan Clean-Up x1; Foot Massage x1; Upper Lip Threading x1', status: 'confirmed', stage: 'assigned', amt: 1105, p: 'Bimla Singh' },
  { id: 'BLUSH413721', t: '11:00 AM', cust: 'Naveen Kumar', ph: '9716554117', addr: 'T4-004, Mana Capitol, Sarjapur Road, 560035', svc: 'Eyebrow Threading x1', status: 'confirmed', stage: 'assigned', amt: 49, p: 'Manju Gappu Rajbhar' },
  { id: 'BLUSH170229', t: '11:00 AM', cust: 'Kritika', ph: '7979978432', addr: 'Flat 710, Tower B2, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'Eyebrow Threading x1; Chocolate Wax – Full Legs (Roll-on) x1; Hair Root Touch-Up x1', status: 'confirmed', stage: 'assigned', amt: 198, p: 'Rekha Verma' },
  { id: 'BLUSH066532', t: '11:00 AM', cust: 'Tanuja', ph: '8339847183', addr: 'WING 10-901, Ahad Euphoria, Sarjapur Road, 560035', svc: 'Saree Draping x1', status: 'confirmed', stage: 'assigned', amt: 0, p: 'Ashwini' },
  { id: 'BLUSH586633', t: '11:00 AM', cust: 'Ranu', ph: '8290702043', addr: 'A2 905, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'Head & Shoulders Massage x1; Eyebrow Threading x1', status: 'confirmed', stage: 'assigned', amt: 0, p: 'Jyoti Verma' },
  { id: 'BLUSH753433', t: '12:00 PM', cust: 'Ashish', ph: '9717412224', addr: 'C2 507, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'Chocolate Wax – Full Legs (Roll-on) x1', status: 'confirmed', stage: 'assigned', amt: 149, p: 'Rekha Verma' },
  { id: 'BLUSH483954', t: '12:00 PM', cust: 'Ruchi Chaturvedi', ph: '9322475678', addr: 'B 1003, The Central Regency, Sarjapur Road, 560103', svc: 'Blow Dry & Styling x1', status: 'rescheduled', stage: 'assigned', amt: 149, p: 'Jeevitha M' },
  { id: 'BLUSH962018', t: '12:00 PM', cust: 'Somya A', ph: '7838676723', addr: 'C2-1105, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'Sara Fruit Clean-Up x1; Any Threading (Add-on) x1', status: 'confirmed', stage: 'assigned', amt: 140, p: 'Jyoti Verma' },
  { id: 'BLUSH051119', t: '12:00 PM', cust: 'Neha', ph: '9538000083', addr: 'A301, Meadows in the Sun, Sarjapur Road, 560035', svc: 'Head & Shoulders Massage x1', status: 'confirmed', stage: 'assigned', amt: 449, p: 'Nandini Verma' },
  { id: 'BLUSH502232', t: '12:00 PM', cust: 'Divya Jain', ph: '9711123711', addr: 'D-701, Purva Sky Wood, Sarjapur Road, 560068', svc: 'Face & Neck Detan x1', status: 'rescheduled', stage: 'assigned', amt: 0, p: 'Dichhin Tamang' },
  { id: 'BLUSH184021', t: '12:30 PM', cust: 'Namrata', ph: '9289690139', addr: 'Oak 107, SJR Park Vista, Sarjapur Road, 560102', svc: 'RICA Wax – Full Legs (Roll-on) x1; Any Threading (Add-on) x1', status: 'rescheduled', stage: 'assigned', amt: 250, p: 'Naveena Kumari' },
  { id: 'BLUSH150640', t: '12:30 PM', cust: 'Asha', ph: '9986678130', addr: 'E602, Meadows in the Sun, Sarjapur Road, 560035', svc: 'Blow Dry & Styling x1', status: 'rescheduled', stage: 'assigned', amt: 199, p: 'Nandini Verma' },
  // ── unassigned queue ──
  { id: 'BLUSH870444', t: '1:00 PM', cust: 'Sameer Maniyar', ph: '9969777451', addr: '20121, Prestige Ferns Residency, Sarjapur Road, 560102', svc: 'Head & Shoulders Massage x1; Any Threading (Add-on) x1', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH952691', t: '1:00 PM', cust: 'Priyanka Mogra', ph: '8085596666', addr: 'A2-1204, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'Face & Neck Detan x1; Full Face Threading x4', status: 'confirmed', stage: 'unassigned', amt: 3, p: '' },
  { id: 'BLUSH410413', t: '1:00 PM', cust: 'Vasu', ph: '8077842060', addr: '040403, Shriram Chirping Woods, Sarjapur Road, 560102', svc: 'RICA Wax – Full Arms (Roll-on) x1; Any Threading (Add-on) x1', status: 'confirmed', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH861561', t: '1:00 PM', cust: 'Dhvani Singrodia', ph: '9830929245', addr: 'C2-603, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'Chocolate Wax – Full Arms (Roll-on) x1; Underarms (RICA Peel-Off) x1; Any Threading (Add-on) x1', status: 'confirmed', stage: 'unassigned', amt: 99, p: '' },
  { id: 'BLUSH756357', t: '2:00 PM', cust: 'Aman Lasod', ph: '9096916467', addr: 'A2 1204, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'Head & Shoulders Massage x1; Any Threading (Add-on) x1', status: 'confirmed', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH692945', t: '2:00 PM', cust: 'Kushagra Bhatia', ph: '9303609014', addr: 'Block E 1808, Purva Sky Wood, Sarjapur Road, 560068', svc: 'RICA Wax – Full Arms (Roll-on) x1; Hair Root Touch-Up x1; Any Threading (Add-on) x1', status: 'confirmed', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH298836', t: '2:00 PM', cust: 'Alka goyal', ph: '7988218616', addr: 'D-701, Purva Sky Wood, Sarjapur Road, 560068', svc: 'Sara Fruit Clean-Up x1; Any Threading (Add-on) x1', status: 'confirmed', stage: 'unassigned', amt: 140, p: '' },
  { id: 'BLUSH878333', t: '2:00 PM', cust: 'Reine', ph: '8884933489', addr: 'F205, Bren Paddington, Sarjapur Road, 560103', svc: 'Eyebrow Threading x2; Henna Application x2', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH937159', t: '2:00 PM', cust: 'Aditi', ph: '9986734797', addr: '812 Block 2 wing A, Suncity Gloria, Sarjapur Road, 560035', svc: 'Head & Shoulders Massage x1; Hair Root Touch-Up x1', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH125712', t: '3:00 PM', cust: 'Ashwini', ph: '9429790476', addr: '1A 504, Suncity Gloria, Sarjapur Road, 560035', svc: 'Head & Shoulders Massage x1; Full Face Threading x1', status: 'rescheduled', stage: 'unassigned', amt: 1, p: '' },
  { id: 'BLUSH993545', t: '3:00 PM', cust: 'Shivani goyal', ph: '8865856278', addr: '1101 Wing 8, Ahad serenity, Choodashandra, 560099', svc: 'O3+ Detan Clean-Up x1', status: 'rescheduled', stage: 'unassigned', amt: 459, p: '' },
  { id: 'BLUSH743563', t: '3:00 PM', cust: 'Srishti maheshwari', ph: '9571288639', addr: 'A1 -503, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'O3+ Whitening Clean-Up x1; Any Threading (Add-on) x1', status: 'rescheduled', stage: 'unassigned', amt: 300, p: '' },
  { id: 'BLUSH023857', t: '4:00 PM', cust: 'Sweta', ph: '9620235139', addr: 'A605, Keerthi Regalia, Sarjapur Road, 560035', svc: 'Eyebrow Threading x1; Blow Dry & Styling x1', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH664276', t: '4:00 PM', cust: 'Swarnali', ph: '9674559967', addr: 'Flat 4114, Uber Verdant, wing-4, 560035', svc: 'Face & Neck Detan x1', status: 'rescheduled', stage: 'order_accepted', amt: 0, p: 'Lalita dishai' },
  { id: 'BLUSH666019', t: '5:00 PM', cust: 'Sakshi gautam', ph: '8218833449', addr: 'D607, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'Face & Neck Detan x1', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH240570', t: '5:00 PM', cust: 'Pooja', ph: '9560204422', addr: '21133, tower 21, Prestige Ferns Residency, Sarjapur Road, 560102', svc: 'Head & Shoulders Massage x1; Eyebrow Threading x1', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH903401', t: '5:00 PM', cust: 'Aayasha', ph: '8878199844', addr: 'A021, SLS Spring Woods, 560102', svc: 'Sara Fruit Clean-Up x1; Any Threading (Add-on) x1', status: 'confirmed', stage: 'unassigned', amt: 140, p: '' },
  { id: 'BLUSH352618', t: '5:00 PM', cust: 'Kranthi', ph: '9036589484', addr: 'Cosmos-2E, Klassik Landmark, Sarjapur Road, 560035', svc: 'Face & Neck Detan x1; Any Threading (Add-on) x1', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH870655', t: '7:00 PM', cust: 'Anita agarwal', ph: '9706054501', addr: 'C 102, Uber Verdant, 560035', svc: 'Head & Shoulders Massage x1', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH769974', t: '8:00 PM', cust: 'Sunil', ph: '9886152452', addr: 'B2 507, DSR Highland Greenz, Sarjapur Road, 560035', svc: 'Head & Shoulders Massage x1', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
  { id: 'BLUSH519218', t: '8:00 PM', cust: 'Vidhu', ph: '9904894283', addr: 'G-102, Concorde Amber, Sarjapur Road, 560035', svc: 'Face & Neck Detan x1; Any Threading (Add-on) x1', status: 'rescheduled', stage: 'unassigned', amt: 0, p: '' },
]

function buildOrder(r: RawOrder): MockOrder {
  const { services, total } = parseServices(r.svc)
  return {
    id: r.id,
    timeLabel: r.t,
    startMin: parseTimeToMin(r.t),
    customer: r.cust,
    phone: r.ph,
    address: r.addr,
    complex: extractComplex(r.addr),
    pincode: extractPincode(r.addr),
    servicesRaw: r.svc,
    services,
    durationMin: total,
    status: r.status,
    stage: r.stage,
    amount: r.amt,
    assignedPartner: r.p || null,
    type: 'prebooked',
  }
}

export function getMockOrders(): MockOrder[] {
  return RAW.map(buildOrder).sort((a, b) => a.startMin - b.startMin)
}

/** Build a single ad-hoc order (used for simulated instant/on-demand orders). */
export function buildInstantOrder(
  id: string,
  preset: { customer: string; address: string; servicesRaw: string; timeLabel: string }
): MockOrder {
  const o = buildOrder({
    id, t: preset.timeLabel, cust: preset.customer, ph: '—', addr: preset.address,
    svc: preset.servicesRaw, status: 'confirmed', stage: 'unassigned', amt: 0, p: '',
  })
  o.type = 'instant'
  return o
}

// ─── Partner roster (Sarjapur Road hub) ─────────────────────────────────────────

export const ROSTER: RosterPartner[] = [
  // partners with morning jobs (their location is known from those jobs)
  { name: 'Suguna S', hasVehicle: true },
  { name: 'R Suvitha', hasVehicle: false },
  { name: 'Ashwini', hasVehicle: true },
  { name: 'Lalita dishai', hasVehicle: true },
  { name: 'Nandini Verma', hasVehicle: false },
  { name: 'Bimla Singh', hasVehicle: false },
  { name: 'Manju Gappu Rajbhar', hasVehicle: true },
  { name: 'Rekha Verma', hasVehicle: true },
  { name: 'Jyoti Verma', hasVehicle: false },
  { name: 'Jeevitha M', hasVehicle: true },
  { name: 'Dichhin Tamang', hasVehicle: false },
  { name: 'Naveena Kumari', hasVehicle: true },
  // bench partners sitting at the hub
  { name: 'Akshita Ingalganvi', hasVehicle: true },
  { name: 'Ashwini S', hasVehicle: false },
  { name: 'Bhavya G', hasVehicle: true },
  { name: 'Bindu tiwari', hasVehicle: false },
  { name: 'Jeevitha Anthony', hasVehicle: true },
  { name: 'Mary Korar', hasVehicle: false },
  { name: 'Palaka Suvarana', hasVehicle: true },
  { name: 'Pinky Deb', hasVehicle: false },
  { name: 'Pramila', hasVehicle: true },
  { name: 'Puja Bohara', hasVehicle: false },
]

// ─── The smart assigner ──────────────────────────────────────────────────────────

interface PState {
  name: string
  hasVehicle: boolean
  freeAt: number // minute they next become free
  complex: string // where they currently are ('Hub' = at the hub)
  jobs: number
}

const DAY_START = 9 * 60 // 9:00 AM — bench partners are available from start of day

/**
 * Runs one chronological pass over every order.
 *  - Locked orders (already assigned upstream) just advance that partner's state.
 *  - Unassigned orders get a recommendation following the ops flowchart, and the
 *    recommended partner's state is advanced (we assume the rec is approved so
 *    downstream recommendations stay coherent).
 */
export function computeRecommendations(
  orders: MockOrder[],
  roster: RosterPartner[]
): Map<string, Recommendation> {
  const state: Record<string, PState> = {}
  for (const p of roster)
    state[p.name] = { name: p.name, hasVehicle: p.hasVehicle, freeAt: DAY_START, complex: 'Hub', jobs: 0 }

  const recs = new Map<string, Recommendation>()
  const queue = [...orders].sort((a, b) => a.startMin - b.startMin)

  for (const o of queue) {
    // Locked order → just advance the assigned partner's state.
    if (o.assignedPartner) {
      const p = state[o.assignedPartner]
      if (p) {
        p.freeAt = Math.max(p.freeAt, o.startMin) + o.durationMin
        p.complex = o.complex
        p.jobs += 1
      }
      continue
    }

    const start = o.startMin
    const partners = Object.values(state)

    // 1) Is a partner already at this complex AND free by the order start?
    const onSite = partners
      .filter((p) => p.complex === o.complex && p.complex !== 'Hub' && p.freeAt <= start)
      .sort((a, b) => b.freeAt - a.freeAt) // most-recently freed → least idle, still on-site

    let chosen: PState | null = null
    let kind: RecKind = 'hub'
    let reason = ''

    if (onSite.length > 0) {
      chosen = onSite[0]
      kind = 'nearby'
      reason = `Already at ${o.complex} — finished previous job at ${fmtMin(chosen.freeAt)}. No travel needed.`
    } else {
      // 2) Dispatch from hub: a free partner. Prefer least-loaded, then has-vehicle, then earliest free.
      const free = partners
        .filter((p) => p.freeAt <= start)
        .sort((a, b) => a.jobs - b.jobs || Number(b.hasVehicle) - Number(a.hasVehicle) || a.freeAt - b.freeAt)
      if (free.length > 0) {
        chosen = free[0]
        kind = 'hub'
        const where = onSiteBusyNote(partners, o.complex, start)
        reason = `${where}Dispatch from hub — ${chosen.name} is free${chosen.hasVehicle ? ' (has vehicle)' : ''}, ${chosen.jobs} job${chosen.jobs === 1 ? '' : 's'} so far today.`
      } else {
        // 3) Nobody free — recommend the partner who frees up soonest (delayed).
        const soonest = [...partners].sort((a, b) => a.freeAt - b.freeAt)[0]
        chosen = soonest
        kind = 'delayed'
        reason = `All partners busy at ${o.timeLabel}. ${chosen.name} frees up first at ${fmtMin(chosen.freeAt)} — expect a short delay.`
      }
    }

    const delayMin = Math.max(0, chosen.freeAt - start)
    recs.set(o.id, {
      orderId: o.id,
      partner: chosen.name,
      kind,
      reason,
      freeAtLabel: fmtMin(chosen.freeAt),
      delayMin,
    })

    // advance chosen partner's state assuming the rec is taken
    chosen.freeAt = Math.max(chosen.freeAt, start) + o.durationMin
    chosen.complex = o.complex
    chosen.jobs += 1
  }

  return recs
}

// If a partner IS at the complex but still busy, the flowchart routes to the hub.
// Surface that nuance in the reason text.
function onSiteBusyNote(partners: PState[], complex: string, start: number): string {
  const busyHere = partners.find((p) => p.complex === complex && p.complex !== 'Hub' && p.freeAt > start)
  if (busyHere)
    return `${busyHere.name} is at ${complex} but still mid-service (free ${fmtMin(busyHere.freeAt)}). `
  return `No partner at ${complex}. `
}
