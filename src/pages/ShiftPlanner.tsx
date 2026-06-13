import { useState, useEffect, useCallback, useRef } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AlertTriangle, TrendingUp, Clock, Users, RefreshCw, CheckCircle, Sparkles, ChevronDown } from 'lucide-react'
import {
  DAYS, HOURS,
  getDayHourMetrics, getPartnerSlotOptions, addPartner,
  type DayHourMetrics, type PartnerSlotOption, type DayKey,
} from '@/lib/data'
import { formatHour, cn } from '@/lib/utils'
import { showToast } from '@/components/ui/toast'

type ViewKey = 'Week' | DayKey

// ─── KPI Row ──────────────────────────────────────────────────────────────────

function KPIRow({ metrics }: { metrics: DayHourMetrics[] }) {
  const deficitCells = metrics.filter((m) => m.deficit < 0)
  const worst = metrics.reduce((min, m) => (m.deficit < min.deficit ? m : min), metrics[0] ?? { deficit: 0, day: 'Mon' as DayKey, hour: 8 })
  const totalWeeklyDeficit = deficitCells.reduce((sum, m) => sum + Math.abs(m.deficit), 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[
        { label: 'Avg Daily Deficit Slots', value: (deficitCells.length / 7).toFixed(1), sub: 'slots/day below capacity', border: 'border-red-500', icon: <AlertTriangle size={18} className="text-red-500" /> },
        { label: 'Worst Slot', value: `${worst?.day} ${formatHour(worst?.hour ?? 8)}`, sub: `${worst?.deficit?.toFixed(1)} partner deficit`, border: 'border-orange-500', icon: <Clock size={18} className="text-orange-500" /> },
        { label: 'Total Weekly Deficit', value: Math.abs(totalWeeklyDeficit).toFixed(0), sub: 'partner-hours short across week', border: 'border-amber-500', icon: <TrendingUp size={18} className="text-amber-500" /> },
        { label: 'Leave Buffer Applied', value: '20%', sub: 'effective = scheduled × 0.80', border: 'border-indigo-500', icon: <Users size={18} className="text-indigo-500" /> },
      ].map((k) => (
        <div key={k.label} className={cn('bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 border-l-4', k.border)}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
            {k.icon}
          </div>
          <p className="text-2xl font-bold text-gray-900">{k.value}</p>
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

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload?: Record<string, number> & { hourLabel: string } }>
  label?: string
}) => {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload as Record<string, number> & { hourLabel: string }
  const deficit = (row.effective ?? 0) - (row.required ?? 0)
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      <div className="space-y-1">
        {[['Demand', row.demand], ['Required', row.required], ['Scheduled', row.scheduled], ['Effective', row.effective]].map(([k, v]) => (
          <div key={k as string} className="flex justify-between gap-4">
            <span className="text-gray-500">{k as string}</span>
            <span className="font-medium">{typeof v === 'number' ? v.toFixed(1) : '—'}</span>
          </div>
        ))}
        <div className={cn('flex justify-between gap-4 border-t border-gray-100 pt-1 mt-1 font-semibold', deficit < 0 ? 'text-red-600' : 'text-emerald-600')}>
          <span>Deficit</span>
          <span>{deficit.toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Chart ───────────────────────────────────────────────────────────────

function MainChart({ view, metrics }: { view: ViewKey; metrics: DayHourMetrics[] }) {
  const isWeek = view === 'Week'

  const chartData = HOURS.map((hour) => {
    if (isWeek) {
      const cells = metrics.filter((m) => m.hour === hour)
      const n = cells.length || 1
      return {
        hourLabel: formatHour(hour),
        demand:    cells.reduce((s, m) => s + m.demand, 0) / n,
        required:  cells.reduce((s, m) => s + m.required, 0) / n,
        scheduled: cells.reduce((s, m) => s + m.scheduled, 0) / n,
        effective: cells.reduce((s, m) => s + m.effective, 0) / n,
      }
    }
    const m = metrics.find((m) => m.day === view && m.hour === hour)
    return { hourLabel: formatHour(hour), demand: m?.demand ?? 0, required: m?.required ?? 0, scheduled: m?.scheduled ?? 0, effective: m?.effective ?? 0 }
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          Required vs Available Capacity — {isWeek ? 'Weekly Average' : view}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          <span className="font-medium">Required</span> = Demand × 2 ·{' '}
          <span className="font-medium">Effective</span> = Scheduled × 0.80 (20% leave buffer)
          {isWeek && ' · Values are averaged across all 7 days'}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="hourLabel" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span className="text-gray-600">{v}</span>} />
          <Bar dataKey="required" name="Required" fill="#fecaca" radius={[3, 3, 0, 0]} />
          <Bar dataKey="effective" name="Effective" fill="#818cf8" radius={[3, 3, 0, 0]} />
          <Line dataKey="scheduled" name="Scheduled" stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={1.5} dot={false} type="monotone" />
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

// ─── Insights Panel ───────────────────────────────────────────────────────────

function InsightsPanel({ metrics }: { metrics: DayHourMetrics[] }) {
  const worst = metrics.reduce((min, m) => (m.deficit < min.deficit ? m : min), metrics[0] ?? { deficit: 0, day: 'Mon' as DayKey, hour: 8 })
  const understaffed = metrics.filter((m) => m.deficit < 0).length
  const avgDeficit = understaffed > 0 ? metrics.filter((m) => m.deficit < 0).reduce((s, m) => s + m.deficit, 0) / understaffed : 0
  const partnerHoursNeeded = metrics.filter((m) => m.deficit < 0).reduce((s, m) => s + Math.abs(m.deficit), 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Insights</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { icon: <AlertTriangle size={16} className="text-red-500" />, title: 'Critical Slot', body: `${worst.day} ${formatHour(worst.hour)} is the hardest slot — deficit of ${worst.deficit.toFixed(1)} partners.`, bg: 'bg-red-50 border-red-100' },
          { icon: <Users size={16} className="text-amber-500" />, title: 'Coverage Gap', body: `${understaffed} of 91 slots (${((understaffed / 91) * 100).toFixed(0)}%) are understaffed across the week.`, bg: 'bg-amber-50 border-amber-100' },
          { icon: <TrendingUp size={16} className="text-indigo-500" />, title: 'Average Deficit', body: `Understaffed slots average a ${Math.abs(avgDeficit).toFixed(1)}-partner gap. Sun and Fri are most affected.`, bg: 'bg-indigo-50 border-indigo-100' },
          { icon: <Clock size={16} className="text-emerald-500" />, title: 'Hiring Target', body: `${partnerHoursNeeded.toFixed(0)} partner-hours/week needed to close all gaps (assume 10h avg shifts).`, bg: 'bg-emerald-50 border-emerald-100' },
        ].map((insight) => (
          <div key={insight.title} className={cn('rounded-xl border p-4', insight.bg)}>
            <div className="flex items-center gap-2 mb-1.5">{insight.icon}<p className="text-sm font-semibold text-gray-800">{insight.title}</p></div>
            <p className="text-xs text-gray-600 leading-relaxed">{insight.body}</p>
          </div>
        ))}
      </div>
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
      <KPIRow metrics={metrics} />

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

      <InsightsPanel metrics={metrics} />
    </div>
  )
}
