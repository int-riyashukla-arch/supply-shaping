import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { getPartners, getHourlyDemand, DAYS, HOURS, DAY_MULTIPLIERS, type Partner, type DayKey } from '@/lib/data'
import { formatHour, cn } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ratioLabel(active: number, demand: number): { text: string; cls: string } {
  if (demand === 0) return { text: '—', cls: 'bg-gray-100 text-gray-400' }
  const r = active / demand
  const text = `${r.toFixed(2)}×`
  if (r >= 2) return { text, cls: 'bg-emerald-100 text-emerald-700' }
  if (r >= 1) return { text, cls: 'bg-amber-100 text-amber-700' }
  return        { text, cls: 'bg-red-100 text-red-700' }
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function HourRow({ hour, active, weeklyOff, demand }: {
  hour: number
  active: number
  weeklyOff: number
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
        <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', ratio.cls)}>
          {ratio.text}
        </span>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap text-center">
        <span className={cn(
          'text-sm font-bold',
          active === 0 ? 'text-red-500' : 'text-gray-900'
        )}>
          {active}
        </span>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap text-center">
        <span className={cn(
          'text-sm font-bold',
          weeklyOff > 0 ? 'text-amber-600' : 'text-gray-300'
        )}>
          {weeklyOff}
        </span>
      </td>
    </tr>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PartnerHours() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [demandMap, setDemandMap] = useState<Record<number, number>>({})
  const [selectedDay, setSelectedDay] = useState<DayKey>('Mon')
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

  const dayMult = DAY_MULTIPLIERS[selectedDay] ?? 1

  const partnersOn  = partners.filter((p) => p.weeklyOff !== selectedDay).length
  const partnersOff = partners.filter((p) => p.weeklyOff === selectedDay).length
  const totalDemand = HOURS.reduce((s, h) => s + (demandMap[h] ?? 0) * dayMult, 0)
  const peakHour = HOURS.reduce((best, h) => {
    const c = partners.filter((p) => p.weeklyOff !== selectedDay && h >= p.shiftStart && h < p.shiftStart + p.shiftHours).length
    const b = partners.filter((p) => p.weeklyOff !== selectedDay && best >= p.shiftStart && best < p.shiftStart + p.shiftHours).length
    return c > b ? h : best
  }, HOURS[0])

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Partner Hours</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Computed live from partner shift windows · select a day to see hourly coverage
        </p>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map((day) => {
          const offCount = partners.filter((p) => p.weeklyOff === day).length
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={cn(
                'flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl border-2 transition-all text-sm font-medium',
                selectedDay === day
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
              )}
            >
              <span>{day}</span>
              {offCount > 0 && (
                <span className={cn('text-[10px] mt-0.5', selectedDay === day ? 'text-indigo-200' : 'text-gray-400')}>
                  {offCount} off
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Partners On',  value: partnersOn },
            { label: 'Partners Off', value: partnersOff },
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
                  { label: 'Time',        align: 'left' },
                  { label: 'Demand',      align: 'left' },
                  { label: 'Ratio',       align: 'left' },
                  { label: 'Active',      align: 'center', hint: 'partners working this hour' },
                  { label: 'Weekly Off',  align: 'center', hint: 'partners off whose shift covers this hour' },
                ].map((h) => (
                  <th
                    key={h.label}
                    title={h.hint}
                    className={cn(
                      'px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap',
                      h.align === 'center' ? 'text-center' : 'text-left'
                    )}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => {
                const active = partners.filter(
                  (p) => p.weeklyOff !== selectedDay && hour >= p.shiftStart && hour < p.shiftStart + p.shiftHours
                ).length
                // Partners whose shift covers this hour but are on weekly off today
                const offThisHour = partners.filter(
                  (p) => p.weeklyOff === selectedDay && hour >= p.shiftStart && hour < p.shiftStart + p.shiftHours
                ).length
                const demand = (demandMap[hour] ?? 0) * dayMult
                return (
                  <HourRow
                    key={hour}
                    hour={hour}
                    active={active}
                    weeklyOff={offThisHour}
                    demand={demand}
                  />
                )
              })}
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
