import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { DayKey } from '@/lib/data'

// ─────────────────────────────────────────────────────────────────────────────
// Shared date-range selector — Yesterday / Today / Tomorrow / Last 7 days / Custom.
// Used across Shift Analyser, Partner Hours, Attendance, Assignment so every tab
// speaks the same "which day(s) am I looking at" language as the main dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export type RangeMode = 'yesterday' | 'today' | 'tomorrow' | 'last7' | 'custom'

export interface DateRange {
  mode: RangeMode
  start: string // yyyy-mm-dd (local)
  end: string   // yyyy-mm-dd (local)
  label: string
}

const JS_DAY: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Local (timezone-safe) yyyy-mm-dd — never use toISOString here, it shifts to UTC.
function iso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function parse(s: string): Date {
  return new Date(s + 'T00:00:00')
}
export function niceDate(s: string): string {
  return parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function makeRange(mode: RangeMode, customStart?: string, customEnd?: string): DateRange {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  switch (mode) {
    case 'yesterday': { const d = addDays(today, -1); return { mode, start: iso(d), end: iso(d), label: 'Yesterday' } }
    case 'tomorrow':  { const d = addDays(today, 1);  return { mode, start: iso(d), end: iso(d), label: 'Tomorrow' } }
    case 'last7':     return { mode, start: iso(addDays(today, -6)), end: iso(today), label: 'Last 7 days' }
    case 'custom': {
      const s = customStart ?? iso(today)
      const e = (customEnd && customEnd >= s) ? customEnd : s
      return { mode, start: s, end: e, label: s === e ? niceDate(s) : `${niceDate(s)} – ${niceDate(e)}` }
    }
    case 'today':
    default:          return { mode: 'today', start: iso(today), end: iso(today), label: 'Today' }
  }
}

export function defaultRange(): DateRange {
  return makeRange('today')
}

// Every weekday covered by the range (with repeats), e.g. a 10-day custom range
// returns 10 entries. Used to map a date range onto the day-of-week demand model.
export function weekdaysInRange(r: DateRange): DayKey[] {
  const out: DayKey[] = []
  let d = parse(r.start)
  const end = parse(r.end)
  let guard = 0
  while (d <= end && guard++ < 400) {
    out.push(JS_DAY[d.getDay()])
    d = addDays(d, 1)
  }
  return out.length ? out : [JS_DAY[parse(r.start).getDay()]]
}

export function isFuture(r: DateRange): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return parse(r.start) > today
}

const PRESETS: { mode: RangeMode; label: string }[] = [
  { mode: 'yesterday', label: 'Yesterday' },
  { mode: 'today', label: 'Today' },
  { mode: 'tomorrow', label: 'Tomorrow' },
  { mode: 'last7', label: 'Last 7 days' },
]

export function DateRangePicker({ value, onChange, hideModes, singleCustom }: {
  value: DateRange
  onChange: (r: DateRange) => void
  /** Preset mode buttons to hide (e.g. ['last7'] for per-day views) */
  hideModes?: RangeMode[]
  /** When true, the custom picker shows a single date input (start = end) */
  singleCustom?: boolean
}) {
  const [showCustom, setShowCustom] = useState(value.mode === 'custom')
  const todayLabel = niceDate(makeRange('today').start)
  const hide = new Set(hideModes ?? [])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.filter((p) => !hide.has(p.mode)).map((p) => {
        const active = value.mode === p.mode
        return (
          <button
            key={p.mode}
            onClick={() => { setShowCustom(false); onChange(makeRange(p.mode)) }}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
              active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            )}
          >
            {p.label}
            {p.mode === 'today' && (
              <span className={cn('ml-1.5 text-xs', active ? 'text-indigo-200' : 'text-gray-400')}>{todayLabel}</span>
            )}
          </button>
        )
      })}

      <button
        onClick={() => { setShowCustom(true); onChange(makeRange('custom', value.start, singleCustom ? value.start : value.end)) }}
        className={cn(
          'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
          value.mode === 'custom' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
        )}
      >
        Custom
      </button>

      {showCustom && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={value.start}
            onChange={(e) => {
              const d = e.target.value
              onChange(makeRange('custom', d, singleCustom ? d : value.end))
            }}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {!singleCustom && (
            <>
              <span className="text-gray-400 text-sm">→</span>
              <input
                type="date"
                value={value.end}
                min={value.start}
                onChange={(e) => onChange(makeRange('custom', value.start, e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
