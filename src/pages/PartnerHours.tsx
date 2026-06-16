import { useState, useEffect } from 'react'
import { RefreshCw, UserX } from 'lucide-react'
import {
  getPartners, getHourlyDemand, getAttendance,
  HOURS, DAY_MULTIPLIERS, type Partner, type AttendanceRecord,
} from '@/lib/data'
import { formatHour, cn } from '@/lib/utils'
import {
  DateRangePicker, defaultRange, weekdaysInRange, isFuture, niceDate, type DateRange,
} from '@/components/DateRangePicker'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ratioLabel(active: number, demand: number): { text: string; cls: string } {
  if (demand === 0) return { text: '—', cls: 'bg-gray-100 text-gray-400' }
  const r = active / demand
  const text = `${r.toFixed(2)}×`
  if (r >= 2) return { text, cls: 'bg-emerald-100 text-emerald-700' }
  if (r >= 1) return { text, cls: 'bg-amber-100 text-amber-700' }
  return        { text, cls: 'bg-red-100 text-red-700' }
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function covers(p: Partner, hour: number): boolean {
  return hour >= p.shiftStart && hour < p.shiftStart + p.shiftHours
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function HourRow({ hour, active, weeklyOff, absent, demand }: {
  hour: number
  active: number
  weeklyOff: number
  absent: number
  demand: number
}) {
  const ratio = ratioLabel(active, demand)
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
      <td className="px-5 py-3.5 whitespace-nowrap">
        <span className="text-sm font-semibold text-gray-800">
          {formatHour(hour)} – {formatHour(hour + 1)}
        </span>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <span className="text-sm font-bold text-gray-900">{demand.toFixed(1)}</span>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', ratio.cls)}>{ratio.text}</span>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap text-center">
        <span className={cn('text-sm font-bold', active === 0 ? 'text-red-500' : 'text-gray-900')}>{num(active)}</span>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap text-center">
        <span className={cn('text-sm font-bold', absent > 0 ? 'text-red-500' : 'text-gray-300')}>{absent > 0 ? num(absent) : '—'}</span>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap text-center">
        <span className={cn('text-sm font-bold', weeklyOff > 0 ? 'text-amber-600' : 'text-gray-300')}>{num(weeklyOff)}</span>
      </td>
    </tr>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PartnerHours() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [demandMap, setDemandMap] = useState<Record<number, number>>({})
  const [range, setRange] = useState<DateRange>(() => defaultRange())
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [p, hd] = await Promise.all([getPartners(), getHourlyDemand()])
      setPartners(p)
      const dm: Record<number, number> = {}
      for (const h of hd) dm[h.hour] = h.demand
      setDemandMap(dm)
      setLoading(false)
    }
    load()
  }, [])

  // A single concrete (non-future) date pulls real attendance to adjust supply.
  const singleConcrete = range.start === range.end && !isFuture(range)

  useEffect(() => {
    if (singleConcrete) getAttendance(range.start).then(setAttendance)
    else setAttendance({})
  }, [range.start, range.end, singleConcrete])

  const days = weekdaysInRange(range)
  const n = days.length || 1
  const absentIds = new Set(
    Object.values(attendance).filter((a) => a.status === 'absent' || a.status === 'leave').map((a) => a.partnerId)
  )

  // Per-hour averages across the selected weekday(s).
  const rows = HOURS.map((hour) => {
    let active = 0, off = 0, absent = 0, dem = 0
    for (const day of days) {
      const scheduled = partners.filter((p) => p.weeklyOff !== day && covers(p, hour))
      const hourAbsent = singleConcrete ? scheduled.filter((p) => absentIds.has(p.id)).length : 0
      active += scheduled.length - hourAbsent
      absent += hourAbsent
      off += partners.filter((p) => p.weeklyOff === day && covers(p, hour)).length
      dem += (demandMap[hour] ?? 0) * (DAY_MULTIPLIERS[day] ?? 1)
    }
    return { hour, active: active / n, off: off / n, absent: absent / n, demand: dem / n }
  })

  const partnersOn = days.reduce((s, day) => {
    const sched = partners.filter((p) => p.weeklyOff !== day)
    const ab = singleConcrete ? sched.filter((p) => absentIds.has(p.id)).length : 0
    return s + (sched.length - ab)
  }, 0) / n
  const partnersOff = days.reduce((s, day) => s + partners.filter((p) => p.weeklyOff === day).length, 0) / n
  const totalDemand = rows.reduce((s, r) => s + r.demand, 0)
  const peakHour = rows.reduce((best, r) => (r.active > best.active ? r : best), rows[0] ?? { hour: HOURS[0], active: 0 }).hour
  const totalAbsent = absentIds.size
  const hasAttendance = Object.keys(attendance).length > 0

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Partner Hours</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Hourly coverage from partner shifts{singleConcrete ? ' + daily attendance' : ''} · pick a date or range
        </p>
      </div>

      {/* Date selector */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <DateRangePicker value={range} onChange={setRange} />
        {singleConcrete && (
          <p className="text-xs mt-3 flex items-center gap-1.5">
            {hasAttendance ? (
              <span className="text-red-600 flex items-center gap-1.5"><UserX size={13} /> Reflecting attendance for {niceDate(range.start)} — {totalAbsent} marked absent/leave.</span>
            ) : (
              <span className="text-gray-400">No attendance recorded for {niceDate(range.start)} yet — showing the full rostered team.</span>
            )}
          </p>
        )}
        {!singleConcrete && (
          <p className="text-xs text-gray-400 mt-3">Averaged across {n} day{n > 1 ? 's' : ''} — pick a single date to fold in real attendance.</p>
        )}
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Partners On',  value: num(Math.round(partnersOn * 10) / 10) },
            { label: 'Partners Off', value: num(Math.round(partnersOff * 10) / 10) },
            { label: 'Total Demand', value: totalDemand.toFixed(0) + ' orders' },
            { label: 'Peak Hour',    value: formatHour(peakHour) },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">{k.label}</p>
              <p className="text-lg font-bold text-gray-900">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw size={18} className="animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  { label: 'Time',       align: 'left' },
                  { label: 'Demand',     align: 'left' },
                  { label: 'Ratio',      align: 'left' },
                  { label: 'Active',     align: 'center', hint: 'partners working this hour (minus absentees)' },
                  { label: 'Absent',     align: 'center', hint: 'on-shift partners marked absent/leave via attendance' },
                  { label: 'Weekly Off', align: 'center', hint: 'partners whose shift covers this hour but are on weekly off' },
                ].map((h) => (
                  <th key={h.label} title={h.hint}
                    className={cn('px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap',
                      h.align === 'center' ? 'text-center' : 'text-left')}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <HourRow key={r.hour} hour={r.hour} active={r.active} absent={r.absent} weeklyOff={r.off} demand={r.demand} />
              ))}
            </tbody>
          </table>
        )}

        {!loading && (
          <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="font-medium text-gray-600">Ratio = active partners ÷ demand</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥ 2.0× adequate</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 1.0–2.0× marginal</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt; 1.0× understaffed</span>
          </div>
        )}
      </div>
    </div>
  )
}
