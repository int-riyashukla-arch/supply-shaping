import { useMemo, useState } from 'react'
import {
  Check, X, MapPin, Truck, Zap, Search, Clock, UserCheck,
  Sparkles, CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/toast'
import {
  getMockOrders, buildInstantOrder, computeRecommendations, ROSTER,
  type MockOrder, type Recommendation, type OrderType,
} from '@/lib/assignmentData'

// ─── Small UI helpers ────────────────────────────────────────────────────────

const TYPE_META: Record<OrderType, { label: string; cls: string }> = {
  prebooked: { label: 'Pre-booked', cls: 'bg-slate-100 text-slate-600' },
  instant:   { label: 'Instant',    cls: 'bg-rose-100 text-rose-600' },
  new:       { label: 'New',        cls: 'bg-violet-100 text-violet-600' },
}

const KIND_META = {
  nearby:  { label: 'Same complex', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: MapPin },
  hub:     { label: 'From hub',     cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',   Icon: Truck },
  delayed: { label: 'Delayed',      cls: 'bg-amber-50 text-amber-700 border-amber-200',      Icon: Clock },
} as const

type Decision =
  | { status: 'pending' }
  | { status: 'approved'; partner: string }
  | { status: 'rejected'; partner: string | null }

// Instant on-demand orders that ops can fire into the live queue.
const INSTANT_PRESETS = [
  { customer: 'On-demand · Riya',  address: 'B-204, DSR Highland Greenz, Sarjapur Road, 560035', servicesRaw: 'Eyebrow Threading x1; Upper Lip x1', timeLabel: '2:00 PM' },
  { customer: 'On-demand · Meera', address: 'Tower 3, Purva Sky Wood, Sarjapur Road, 560068',    servicesRaw: 'Head & Shoulders Massage x1',        timeLabel: '3:00 PM' },
  { customer: 'On-demand · Kavya', address: 'A-77, Suncity Gloria, Sarjapur Road, 560035',       servicesRaw: 'Blow Dry & Styling x1',               timeLabel: '4:00 PM' },
  { customer: 'On-demand · Farah', address: 'C-12, Bren Paddington, Sarjapur Road, 560103',      servicesRaw: 'Sara Fruit Clean-Up x1',              timeLabel: '5:00 PM' },
]

export default function Assignment() {
  const [orders, setOrders] = useState<MockOrder[]>(() => getMockOrders())
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | OrderType>('all')
  const [instantCount, setInstantCount] = useState(0)

  const recs = useMemo(() => computeRecommendations(orders, ROSTER), [orders])

  const queue = orders.filter((o) => !o.assignedPartner)
  const lockedCount = orders.length - queue.length

  // KPIs
  const approved = Object.values(decisions).filter((d) => d.status === 'approved').length
  const overridden = Object.values(decisions).filter((d) => d.status === 'rejected' && d.partner).length
  const pending = queue.length - approved - overridden
  const needsAttention = queue.filter((o) => recs.get(o.id)?.kind === 'delayed').length

  function decide(orderId: string, decision: Decision) {
    setDecisions((prev) => ({ ...prev, [orderId]: decision }))
  }

  function approveAll() {
    setDecisions((prev) => {
      const next = { ...prev }
      let n = 0
      for (const o of queue) {
        const cur = next[o.id]
        if (cur && (cur.status === 'approved' || (cur.status === 'rejected' && cur.partner))) continue
        const rec = recs.get(o.id)
        if (rec) { next[o.id] = { status: 'approved', partner: rec.partner }; n++ }
      }
      showToast(`Approved ${n} smart recommendation${n === 1 ? '' : 's'}`, 'success')
      return next
    })
  }

  function simulateInstant() {
    const preset = INSTANT_PRESETS[instantCount % INSTANT_PRESETS.length]
    setInstantCount((c) => c + 1)
    const id = `INSTANT-${Date.now().toString().slice(-5)}`
    setOrders((prev) => [...prev, buildInstantOrder(id, preset)])
    showToast(`Instant order ${id} received — smart assigner is recommending a partner`, 'success')
  }

  const filtered = queue.filter((o) => {
    if (typeFilter !== 'all' && o.type !== typeFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      o.id.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.complex.toLowerCase().includes(q) ||
      o.servicesRaw.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-500" /> Smart Assigner
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Saathi · Sarjapur Road hub · 14 Jun 2026 — the assigner <span className="font-medium text-gray-700">recommends</span> a partner for every order. Ops approves or overrides.
          </p>
        </div>
        <button
          onClick={simulateInstant}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors shadow-sm"
        >
          <Zap size={14} /> Simulate instant order
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Orders in queue" value={queue.length} sub={`${lockedCount} already assigned`} />
        <Kpi label="Recommended" value={queue.length} sub="by smart assigner" accent="indigo" />
        <Kpi label="Approved" value={approved + overridden} sub={`${overridden} overridden`} accent="emerald" />
        <Kpi label="Awaiting ops" value={pending} sub="need a decision" accent="amber" />
        <Kpi label="Needs attention" value={needsAttention} sub="no partner free" accent="rose" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order id, customer, complex, service…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | OrderType)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All types</option>
          <option value="prebooked">Pre-booked</option>
          <option value="instant">Instant</option>
          <option value="new">New</option>
        </select>
        <button
          onClick={approveAll}
          disabled={pending === 0}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
            pending === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
          )}
        >
          <CheckCheck size={15} /> Approve all ({pending})
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Order', 'Time', 'Customer', 'Location', 'Services', 'Smart recommendation', 'Decision'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  rec={recs.get(o.id)}
                  decision={decisions[o.id] ?? { status: 'pending' }}
                  onDecide={(d) => decide(o.id, d)}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">No orders match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="font-medium text-gray-600">How the assigner decides:</span>
          <span className="flex items-center gap-1.5"><MapPin size={13} className="text-emerald-600" /> partner already on-site &amp; free → reuse</span>
          <span className="flex items-center gap-1.5"><Truck size={13} className="text-indigo-600" /> nobody free on-site → dispatch from hub</span>
          <span className="flex items-center gap-1.5"><Clock size={13} className="text-amber-600" /> all busy → earliest-free partner (delay)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function OrderRow({ order, rec, decision, onDecide }: {
  order: MockOrder
  rec: Recommendation | undefined
  decision: Decision
  onDecide: (d: Decision) => void
}) {
  const type = TYPE_META[order.type]
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors align-top">
      {/* Order id + type */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="font-mono text-xs font-semibold text-gray-800">{order.id}</div>
        <span className={cn('inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold', type.cls)}>{type.label}</span>
      </td>

      {/* Time + duration */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm font-semibold text-gray-800">{order.timeLabel}</div>
        <div className="text-[11px] text-gray-400">~{order.durationMin} min</div>
      </td>

      {/* Customer */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm text-gray-800">{order.customer}</div>
        <div className="text-[11px] text-gray-400">{order.phone}</div>
      </td>

      {/* Location */}
      <td className="px-4 py-3 max-w-[180px]">
        <div className="text-sm font-medium text-gray-800 flex items-center gap-1">
          <MapPin size={12} className="text-gray-400 shrink-0" /> {order.complex}
        </div>
        <div className="text-[11px] text-gray-400 truncate">{order.address}</div>
      </td>

      {/* Services */}
      <td className="px-4 py-3 max-w-[200px]">
        <div className="flex flex-wrap gap-1">
          {order.services.map((s, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
              {s.name}{s.qty > 1 ? ` ×${s.qty}` : ''}
            </span>
          ))}
        </div>
      </td>

      {/* Recommendation */}
      <td className="px-4 py-3 max-w-[280px]">
        {rec ? <RecBlock rec={rec} /> : <span className="text-xs text-gray-400">—</span>}
      </td>

      {/* Decision */}
      <td className="px-4 py-3 whitespace-nowrap">
        <DecisionCell rec={rec} decision={decision} onDecide={onDecide} />
      </td>
    </tr>
  )
}

function RecBlock({ rec }: { rec: Recommendation }) {
  const meta = KIND_META[rec.kind]
  const { Icon } = meta
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-gray-900">{rec.partner}</span>
        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold', meta.cls)}>
          <Icon size={11} /> {meta.label}
        </span>
        {rec.delayMin > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">
            +{rec.delayMin}m
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mt-1 leading-snug">{rec.reason}</p>
    </div>
  )
}

function DecisionCell({ rec, decision, onDecide }: {
  rec: Recommendation | undefined
  decision: Decision
  onDecide: (d: Decision) => void
}) {
  if (decision.status === 'approved') {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold w-fit">
          <UserCheck size={13} /> {decision.partner}
        </span>
        <button onClick={() => onDecide({ status: 'pending' })} className="text-[11px] text-gray-400 hover:text-gray-600 text-left">undo</button>
      </div>
    )
  }

  if (decision.status === 'rejected') {
    return (
      <div className="flex flex-col gap-1">
        <select
          value={decision.partner ?? ''}
          onChange={(e) => onDecide({ status: 'rejected', partner: e.target.value || null })}
          className={cn(
            'border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[150px]',
            decision.partner ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'
          )}
        >
          <option value="">— Pick manually —</option>
          {ROSTER.map((p) => (
            <option key={p.name} value={p.name}>{p.name}{p.hasVehicle ? ' 🛵' : ''}</option>
          ))}
        </select>
        <button onClick={() => onDecide({ status: 'pending' })} className="text-[11px] text-gray-400 hover:text-gray-600 text-left">
          back to recommendation
        </button>
      </div>
    )
  }

  // pending → approve / reject
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => rec && onDecide({ status: 'approved', partner: rec.partner })}
        disabled={!rec}
        title="Approve recommendation"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40"
      >
        <Check size={14} /> Approve
      </button>
      <button
        onClick={() => onDecide({ status: 'rejected', partner: null })}
        title="Reject and assign manually"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
      >
        <X size={14} /> Reject
      </button>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent }: {
  label: string; value: number | string; sub: string
  accent?: 'indigo' | 'emerald' | 'amber' | 'rose'
}) {
  const bar = accent === 'indigo' ? 'border-l-indigo-500'
    : accent === 'emerald' ? 'border-l-emerald-500'
    : accent === 'amber' ? 'border-l-amber-500'
    : accent === 'rose' ? 'border-l-rose-500'
    : 'border-l-gray-300'
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm px-4 py-3', bar)}>
      <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      <p className="text-[11px] text-gray-400">{sub}</p>
    </div>
  )
}
