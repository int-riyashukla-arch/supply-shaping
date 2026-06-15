import { useState, useEffect, useCallback, useRef } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AlertTriangle, TrendingUp, Clock, Users, RefreshCw, CheckCircle, Sparkles, ChevronDown } from 'lucide-react'
import {
  DAYS, HOURS, CAPACITY_PER_PARTNER_PER_HOUR,
  getDayHourMetrics, getPartnerSlotOptions, addPartner,
  type DayHourMetrics, type PartnerSlotOption, type DayKey,
} from '@/lib/data'
import { formatHour, cn } from '@/lib/utils'
import { showToast } from '@/components/ui/toast'

type ViewKey = 'Week' | DayKey

// ─── Summary cards (plain-language) ──────────────────────────────────────────

const DAY_FULL: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
}

// Orders the current team can actually serve in a given day-hour cell.
function ordersServed(m: DayHourMetrics): number {
  return Math.min(m.demand, m.effective * CAPACITY_PER_PARTNER_PER_HOUR)
}

function SummaryRow({ metrics }: { metrics: DayHourMetrics[] }) {
  let totalDemand = 0
  let totalServed = 0
  const perDay: Record<string, { dem: number; served: number }> = {}
  let peak = { day: 'Mon' as DayKey, hour: 12, demand: -1 }
  let worstShort = { day: 'Mon' as DayKey, hour: 12, short: 0 }

  for (const m of metrics) {
    const served = ordersServed(m)
    totalDemand += m.demand
    totalServed += served
    perDay[m.day] ??= { dem: 0, served: 0 }
    perDay[m.day].dem += m.demand
    perDay[m.day].served += served
    if (m.demand > peak.demand) peak = { day: m.day, hour: m.hour, demand: m.demand }
    const short = m.required - m.effective
    if (short > worstShort.short) worstShort = { day: m.day, hour: m.hour, short }
  }

  const coverage = totalDemand > 0 ? totalServed / totalDemand : 1
  const toughest = Object.entries(perDay)
    .map(([day, v]) => ({ day, cov: v.dem > 0 ? v.served / v.dem : 1 }))
    .sort((a, b) => a.cov - b.cov)[0] ?? { day: 'Sun', cov: 0 }
  const partnersShort = Math.ceil(worstShort.short)

  const covColor = coverage >= 0.85 ? 'text-emerald-600' : coverage >= 0.6 ? 'text-amber-600' : 'text-red-600'
  const covBorder = coverage >= 0.85 ? 'border-emerald-500' : coverage >= 0.6 ? 'border-amber-500' : 'border-red-500'

  const cards = [
    { label: 'Demand Coverage', value: `${(coverage * 100).toFixed(0)}%`, sub: 'of weekly orders the team can serve', border: covBorder, valueCls: covColor, icon: <CheckCircle size={18} className={covColor} /> },
    { label: 'Busiest Window', value: `${peak.day} ${formatHour(peak.hour)}`, sub: 'highest order volume of the week', border: 'border-indigo-500', valueCls: 'text-gray-900', icon: <TrendingUp size={18} className="text-indigo-500" /> },
    { label: 'Hardest Day', value: DAY_FULL[toughest.day] ?? toughest.day, sub: `only ${(toughest.cov * 100).toFixed(0)}% of its demand covered`, border: 'border-orange-500', valueCls: 'text-gray-900', icon: <Clock size={18} className="text-orange-500" /> },
    { label: 'Hiring Gap at Peak', value: `+${partnersShort}`, sub: `partners to fully cover ${worstShort.day} ${formatHour(worstShort.hour)}`, border: 'border-red-500', valueCls: 'text-gray-900', icon: <Users size={18} className="text-red-500" /> },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((k) => (
        <div key={k.label} className={cn('bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 border-l-4', k.border)}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
            {k.icon}
          </div>
          <p className={cn('text-2xl font-bold', k.valueCls)}>{k.value}</p>
          <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Day Selector (with Week option) ─────────────────────────────────────────

function DaySelector({ selected, onSelect, metrics }: {
  selected: ViewKey
  onSelect: (v: ViewKey) => void
  metrics: DayHourMetrics[]
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {/* Week pill */}
      <button
        onClick={() => onSelect('Week')}
        className={cn(
          'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
          selected === 'Week'
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
        )}
      >
        Week ∑
      </button>

      {DAYS.map((day) => {
        const isCritical = metrics.filter((m) => m.day === day).some((m) => m.deficit <= -10)
        const hasDeficit  = metrics.filter((m) => m.day === day).some((m) => m.deficit < 0)
        return (
          <button
            key={day}
            onClick={() => onSelect(day)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
              selected === day
                ? 'bg-indigo-600 text-white border-indigo-600'
                : isCritical
                  ? 'bg-white text-red-700 border-red-300 hover:border-red-400'
                  : hasDeficit
                    ? 'bg-white text-amber-700 border-amber-200 hover:border-amber-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            {day}
            {isCritical && selected !== day && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle" />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface ChartRow {
  hourLabel: string
  expected: number
  served: number
  unmet: number
  partnersOn: number
  coverage: number
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ payload?: ChartRow }>
  label?: string
}) => {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload
  if (!row) return null
  const cov = Math.round((row.coverage ?? 0) * 100)
  const covColor = cov >= 85 ? 'text-emerald-600' : cov >= 60 ? 'text-amber-600' : 'text-red-600'
  const line = (k: string, v: string, cls = 'text-gray-800') => (
    <div className="flex justify-between gap-6">
      <span className="text-gray-500">{k}</span>
      <span className={cn('font-medium', cls)}>{v}</span>
    </div>
  )
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[200px]">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      <div className="space-y-1">
        {line('Orders expected', row.expected.toFixed(1))}
        {line('Can serve', row.served.toFixed(1), 'text-emerald-600')}
        {line('Will miss', row.unmet.toFixed(1), 'text-red-600')}
        {line('Partners on shift', String(Math.round(row.partnersOn)))}
        <div className="flex justify-between gap-6 border-t border-gray-100 pt-1 mt-1 font-semibold">
          <span className="text-gray-600">Coverage</span>
          <span className={covColor}>{cov}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Chart ───────────────────────────────────────────────────────────────

function MainChart({ view, metrics }: { view: ViewKey; metrics: DayHourMetrics[] }) {
  const isWeek = view === 'Week'
  const cap = CAPACITY_PER_PARTNER_PER_HOUR

  const chartData: ChartRow[] = HOURS.map((hour) => {
    const cells = isWeek
      ? metrics.filter((m) => m.hour === hour)
      : metrics.filter((m) => m.day === view && m.hour === hour)
    const n = cells.length || 1
    const expected   = cells.reduce((s, m) => s + m.demand, 0) / n
    const effective  = cells.reduce((s, m) => s + m.effective, 0) / n
    const partnersOn = cells.reduce((s, m) => s + m.scheduled, 0) / n
    const capacity = effective * cap
    const served = Math.min(expected, capacity)
    const unmet = Math.max(0, expected - capacity)
    const coverage = expected > 0 ? served / expected : 1
    return { hourLabel: formatHour(hour), expected, served, unmet, partnersOn, coverage }
  })

  const peak = chartData.reduce((a, b) => (b.expected > a.expected ? b : a), chartData[0])

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-gray-900">
          Can we keep up with demand? — {isWeek ? 'Average day' : DAY_FULL[view] ?? view}
        </h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Each bar is the <span className="font-medium text-gray-700">orders expected</span> that hour.{' '}
          <span className="font-medium text-emerald-600">Green</span> = what the team on shift can serve,{' '}
          <span className="font-medium text-red-500">red</span> = orders we'd miss. The{' '}
          <span className="font-medium text-indigo-600">line</span> is how many partners are working.
          {isWeek && ' Averaged across all 7 days — pick a day above to drill in.'}
        </p>
      </div>

      {/* Plain-English headline for this view */}
      <p className="text-xs text-gray-400 mb-4">
        Busiest at <span className="font-semibold text-gray-600">{peak?.hourLabel}</span>
        {peak && ` (~${peak.expected.toFixed(0)} orders, ${Math.round(peak.coverage * 100)}% covered)`}
      </p>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 14, left: -4, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="hourLabel" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
          <YAxis
            yAxisId="orders"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'orders / hour', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af', textAnchor: 'middle' } }}
          />
          <YAxis
            yAxisId="partners"
            orientation="right"
            tick={{ fontSize: 11, fill: '#a5b4fc' }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'partners on shift', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#a5b4fc', textAnchor: 'middle' } }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} formatter={(v) => <span className="text-gray-600">{v}</span>} />
          <Bar yAxisId="orders" dataKey="served" name="Orders we can serve" stackId="demand" fill="#34d399" />
          <Bar yAxisId="orders" dataKey="unmet" name="Unmet demand" stackId="demand" fill="#f87171" radius={[3, 3, 0, 0]} />
          <Line yAxisId="partners" dataKey="partnersOn" name="Partners on shift" stroke="#6366f1" strokeWidth={2} dot={{ r: 2, fill: '#6366f1' }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Partner Slot Planner ─────────────────────────────────────────────────────

interface SlotPlannerProps {
  onSelect: (opt: PartnerSlotOption) => void
}

function PartnerSlotPlanner({ onSelect }: SlotPlannerProps) {
  const [shiftHours, setShiftHours] = useState<8 | 10 | 12 | null>(null)
  const [useCustomStart, setUseCustomStart] = useState(false)
  const [startTime, setStartTime] = useState(9)
  const [recs, setRecs] = useState<PartnerSlotOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  async function generate() {
    if (!shiftHours) return
    setLoading(true)
    setRecs([])
    setSelectedIdx(null)
    try {
      const opts = await getPartnerSlotOptions(shiftHours, useCustomStart ? startTime : undefined)
      setRecs(opts)
    } catch {
      showToast('Failed to generate recommendations', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(opt: PartnerSlotOption, idx: number) {
    setSelectedIdx(idx)
    onSelect(opt)
  }

  const startOptions = Array.from({ length: 9 }, (_, i) => 6 + i)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} className="text-indigo-500" />
        <h2 className="text-base font-semibold text-gray-900">New Partner Slot Planner</h2>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        Partner selects a shift length. The system recommends the top 3 shift + weekly-off combinations that close the biggest supply gaps. Once agreed, click "Use this" to pre-fill the Add Partner form below.
      </p>

      {/* Step 1 — Shift duration */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Step 1 — Partner's shift preference</p>
        <div className="flex gap-2 flex-wrap">
          {([8, 10, 12] as const).map((h) => (
            <button
              key={h}
              onClick={() => { setShiftHours(h); setRecs([]); setSelectedIdx(null) }}
              className={cn(
                'px-5 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all',
                shiftHours === h
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
              )}
            >
              {h} hours
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Optional start time */}
      <div className="mb-5">
        <button
          onClick={() => setUseCustomStart((v) => !v)}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronDown size={14} className={cn('transition-transform', useCustomStart && 'rotate-180')} />
          <span className="font-medium">Preferred start time</span>
          <span className="text-gray-400">(optional — leave off to let the system decide)</span>
        </button>
        {useCustomStart && (
          <div className="mt-2 flex items-center gap-3">
            <select
              value={startTime}
              onChange={(e) => setStartTime(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {startOptions.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
            <span className="text-xs text-gray-400">Partner's preferred start (system may override for best coverage)</span>
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={!shiftHours || loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors mb-6"
      >
        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {loading ? 'Calculating…' : 'Get Top 3 Recommendations'}
      </button>

      {/* Results */}
      {recs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Top 3 options for a {shiftHours}h shift
            {useCustomStart ? ` starting ${String(startTime).padStart(2, '0')}:00` : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recs.map((rec, i) => (
              <div
                key={i}
                className={cn(
                  'border-2 rounded-xl p-4 space-y-3 transition-all',
                  selectedIdx === i ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'
                )}
              >
                {/* Rank badge */}
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full',
                    i === 0 ? 'bg-orange-100 text-orange-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-500'
                  )}>
                    #{i + 1} {i === 0 ? '— Best' : ''}
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold">
                    −{rec.deficitReduction.toFixed(1)} deficit
                  </span>
                </div>

                {/* Shift details */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                    {rec.shiftHours}h
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                    {formatHour(rec.startTime)} – {formatHour(rec.endTime)}
                  </span>
                </div>

                {/* Weekly off */}
                <div>
                  <p className="text-xs text-gray-400 mb-1">Weekly off day</p>
                  <span className="px-3 py-1 bg-amber-100 text-amber-800 text-sm font-semibold rounded-lg">
                    {rec.weeklyOff}
                  </span>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">{rec.reason}</p>

                <button
                  onClick={() => handleSelect(rec, i)}
                  className={cn(
                    'w-full py-2 rounded-lg text-xs font-semibold border transition-colors',
                    selectedIdx === i
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50'
                  )}
                >
                  {selectedIdx === i ? '✓ Selected — fill form below' : 'Use this'}
                </button>
              </div>
            ))}
          </div>
          {selectedIdx !== null && (
            <p className="text-xs text-indigo-600 font-medium mt-1">
              ↓ The Add New Partner form below has been pre-filled with this option.
            </p>
          )}
        </div>
      )}

      {recs.length === 0 && !loading && shiftHours && (
        <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
          Click "Get Top 3 Recommendations" to see the best options.
        </div>
      )}

      {!shiftHours && (
        <div className="text-center py-6 text-gray-300 text-sm border border-dashed border-gray-100 rounded-xl">
          Select a shift length above to get started.
        </div>
      )}
    </div>
  )
}

// ─── Add Partner Form ─────────────────────────────────────────────────────────

const PEAK_DAYS = ['Fri', 'Sat', 'Sun']

function AddPartnerForm({ prefill, onSuccess }: {
  prefill: Partial<{ shiftHours: 8|10|12; shiftStart: number; weeklyOff: DayKey }>
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    name: '', mobile: '', address: '', pin: '',
    shiftHours: (prefill.shiftHours ?? 8) as 8|10|12,
    shiftStart: prefill.shiftStart ?? 9,
    weeklyOff: (prefill.weeklyOff ?? 'Mon') as DayKey,
    hasVehicle: false,
    joinDate: new Date().toISOString().split('T')[0],
  })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sync if prefill changes (user clicks "Use this" on a recommendation)
  useEffect(() => {
    if (prefill.shiftHours || prefill.shiftStart || prefill.weeklyOff) {
      setForm((f) => ({
        ...f,
        ...(prefill.shiftHours !== undefined && { shiftHours: prefill.shiftHours }),
        ...(prefill.shiftStart !== undefined && { shiftStart: prefill.shiftStart }),
        ...(prefill.weeklyOff  !== undefined && { weeklyOff:  prefill.weeklyOff }),
      }))
    }
  }, [prefill.shiftHours, prefill.shiftStart, prefill.weeklyOff])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.mobile.trim()) errs.mobile = 'Mobile is required'
    if (PEAK_DAYS.includes(form.weeklyOff)) errs.weeklyOff = 'Weekly off must be Mon–Thu'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSubmitting(true)
    try {
      await addPartner({ name: form.name, mobile: form.mobile, address: form.address,
        shiftHours: form.shiftHours, shiftStart: form.shiftStart, weeklyOff: form.weeklyOff,
        hasVehicle: form.hasVehicle, joinDate: form.joinDate, status: 'Active' })
      showToast(`${form.name} added — chart will refresh.`, 'success')
      onSuccess()
      setForm((f) => ({ ...f, name: '', mobile: '', address: '', pin: '', hasVehicle: false, joinDate: new Date().toISOString().split('T')[0] }))
      setErrors({})
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to add partner', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const startOptions = Array.from({ length: 9 }, (_, i) => 6 + i)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Add New Partner</h2>
      <p className="text-xs text-gray-500 mb-5">
        Shift details are pre-filled if you selected an option above. Adding a partner immediately updates the capacity chart.
      </p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', errors.name ? 'border-red-400' : 'border-gray-200')}
              placeholder="e.g. Priya Sharma" />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mobile *</label>
            <input type="text" value={form.mobile}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', errors.mobile ? 'border-red-400' : 'border-gray-200')}
              placeholder="9876543210" />
            {errors.mobile && <p className="text-xs text-red-500 mt-0.5">{errors.mobile}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Kasavanahalli" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">PIN</label>
            <input type="text" value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="123" maxLength={6} />
          </div>

          {/* Shift Hours — highlighted if pre-filled */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Shift Hours
              {prefill.shiftHours && <span className="ml-1 text-indigo-500 text-xs">(pre-filled)</span>}
            </label>
            <select value={form.shiftHours}
              onChange={(e) => setForm((f) => ({ ...f, shiftHours: Number(e.target.value) as 8|10|12 }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value={8}>8 hours</option>
              <option value={10}>10 hours</option>
              <option value={12}>12 hours</option>
            </select>
          </div>

          {/* Start Time — highlighted if pre-filled */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Start Time
              {prefill.shiftStart !== undefined && <span className="ml-1 text-indigo-500 text-xs">(pre-filled)</span>}
            </label>
            <select value={form.shiftStart}
              onChange={(e) => setForm((f) => ({ ...f, shiftStart: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {startOptions.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Join Date</label>
            <input type="date" value={form.joinDate}
              onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input type="checkbox" id="hasVehicle" checked={form.hasVehicle}
              onChange={(e) => setForm((f) => ({ ...f, hasVehicle: e.target.checked }))}
              className="w-4 h-4 accent-indigo-600" />
            <label htmlFor="hasVehicle" className="text-sm text-gray-700">Has Vehicle</label>
          </div>
        </div>

        {/* Weekly Off */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Weekly Off
            {prefill.weeklyOff && <span className="ml-1 text-indigo-500 text-xs">(pre-filled)</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const isPeak = PEAK_DAYS.includes(day)
              return (
                <div key={day} className="relative group">
                  <button type="button" disabled={isPeak}
                    onClick={() => !isPeak && setForm((f) => ({ ...f, weeklyOff: day }))}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      isPeak ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                        : form.weeklyOff === day ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    )}>
                    {day}
                  </button>
                  {isPeak && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Peak demand — off not allowed
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {errors.weeklyOff && <p className="text-xs text-red-500 mt-1">{errors.weeklyOff}</p>}
        </div>

        <button type="submit" disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors">
          {submitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {submitting ? 'Adding…' : 'Add Partner'}
        </button>
      </form>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShiftPlanner() {
  const [metrics, setMetrics] = useState<DayHourMetrics[]>([])
  const [view, setView] = useState<ViewKey>('Sun')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Partial<{ shiftHours: 8|10|12; shiftStart: number; weeklyOff: DayKey }>>({})
  const addFormRef = useRef<HTMLDivElement>(null)

  const loadMetrics = useCallback(async () => {
    setLoading(true); setError(null)
    try { setMetrics(await getDayHourMetrics()) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadMetrics() }, [loadMetrics])

  function handleSlotSelect(opt: PartnerSlotOption) {
    setPrefill({ shiftHours: opt.shiftHours, shiftStart: opt.startTime, weeklyOff: opt.weeklyOff as DayKey })
    setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-96">
      <div className="text-center">
        <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading shift data…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-full min-h-96">
      <div className="text-center max-w-sm">
        <AlertTriangle size={24} className="text-red-400 mx-auto mb-3" />
        <p className="text-sm text-gray-700 font-medium mb-1">Failed to load data</p>
        <p className="text-xs text-gray-500 mb-4">{error}</p>
        <button onClick={loadMetrics} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Retry</button>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <SummaryRow metrics={metrics} />

      {/* Day / Week selector */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">View</p>
        <DaySelector selected={view} onSelect={setView} metrics={metrics} />
      </div>

      <MainChart view={view} metrics={metrics} />

      <PartnerSlotPlanner onSelect={handleSlotSelect} />

      <div ref={addFormRef}>
        <AddPartnerForm prefill={prefill} onSuccess={loadMetrics} />
      </div>
    </div>
  )
}
