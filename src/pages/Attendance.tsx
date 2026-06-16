import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, Check, Fingerprint, AlertTriangle, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  attendanceEnabled, getAttendance, upsertAttendance,
  type AttendanceStatus, type AttendanceRecord,
} from '@/lib/data'
import { DateRangePicker, defaultRange, niceDate, type DateRange } from '@/components/DateRangePicker'

interface Partner { id: string; name: string; shift_start: number; shift_hours: number; weekly_off: string }

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function pad(n: number) { return String(n).padStart(2, '0') }

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; cls: string }> = {
  present:      { label: 'Present',      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  weekly_off:   { label: 'Weekly Off',   cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  unpaid_leave: { label: 'Unpaid Leave', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
}

function checkinLabel(iso: string | null): string {
  if (!iso) return ''
  const t = iso.includes('T') ? iso.split('T')[1] : iso
  const [h, m] = t.split(':')
  return `${pad(Number(h))}:${pad(Number(m))}`
}

export default function Attendance() {
  const [range, setRange] = useState<DateRange>(() => defaultRange())
  const date = range.start // attendance is per-day; use the range start
  const [partners, setPartners] = useState<Partner[]>([])
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({})
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  const weekday = DAY_NAMES[new Date(date + 'T00:00:00').getDay()]

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data }, ok, att] = await Promise.all([
      supabase.from('partners').select('id, name, shift_start, shift_hours, weekly_off').eq('status', 'Active').order('name'),
      attendanceEnabled(),
      getAttendance(date),
    ])
    setEnabled(ok)
    setRecords(att)
    setPartners((data ?? []).filter((p) => p.weekly_off !== weekday))
    setLoading(false)
  }, [date, weekday])

  useEffect(() => { load() }, [load])

  function patchLocal(partnerId: string, patch: Partial<AttendanceRecord>) {
    setRecords((prev) => {
      const cur = prev[partnerId] ?? { partnerId, date, checkinAt: null, status: null, validated: false, notes: null }
      return { ...prev, [partnerId]: { ...cur, ...patch } }
    })
  }

  async function persist(partnerId: string, patch: Partial<AttendanceRecord>) {
    patchLocal(partnerId, patch)
    if (!enabled) return
    try {
      await upsertAttendance({ partnerId, date, ...patch })
    } catch {
      setEnabled(false)
    }
  }

  // Step 1 — simulate the beautician app check-ins (the daily tap-to-log-in).
  function simulateCheckins() {
    for (const p of partners) {
      const rec = records[p.id]
      if (rec?.checkinAt) continue
      if (Math.random() < 0.82) {
        const h = 6 + Math.floor(Math.random() * 3)
        const m = Math.floor(Math.random() * 60)
        const checkinAt = `${date}T${pad(h)}:${pad(m)}:00`
        // first attendance signal: checked-in → tentatively present, not yet validated
        persist(p.id, { checkinAt, status: 'present', validated: false })
      }
    }
  }

  // Step 2 — hub manager validates (marks the official status).
  function validate(partnerId: string, status: AttendanceStatus) {
    persist(partnerId, { status, validated: true })
  }

  const rec = (id: string): AttendanceRecord | undefined => records[id]
  const checkedIn = partners.filter((p) => rec(p.id)?.checkinAt).length
  const validated = partners.filter((p) => rec(p.id)?.validated).length
  const present    = partners.filter((p) => rec(p.id)?.validated && rec(p.id)?.status === 'present').length
  const weeklyOff  = partners.filter((p) => rec(p.id)?.validated && rec(p.id)?.status === 'weekly_off').length
  const unpaidLeave = partners.filter((p) => rec(p.id)?.validated && rec(p.id)?.status === 'unpaid_leave').length

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Attendance</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Step 1 — beauticians check in from their app. Step 2 — hub manager validates &amp; logs the reason.
        </p>
      </div>

      {/* Date + check-in trigger */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <DateRangePicker value={range} onChange={setRange} hideModes={['last7']} singleCustom />
        {range.start !== range.end && (
          <p className="text-xs text-gray-400">Attendance is per-day — showing {niceDate(date)}.</p>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={simulateCheckins}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600"
          >
            <Fingerprint size={14} /> Simulate app check-ins
          </button>
          <span className="text-xs text-gray-400">(stands in for the beauticians' tap-to-log-in until the app feed is wired)</span>
        </div>
      </div>

      {!enabled && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>The <code className="font-mono">attendance</code> table isn't set up yet, so marks won't be saved. Run the migration SQL in Supabase to enable persistence — you can still mark locally for now.</span>
        </div>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Scheduled', value: partners.length, cls: 'bg-indigo-50 text-indigo-700' },
          { label: 'Checked in', value: checkedIn, cls: 'bg-sky-50 text-sky-700' },
          { label: 'Present', value: present, cls: 'bg-emerald-50 text-emerald-700' },
          { label: 'Weekly Off', value: weeklyOff, cls: 'bg-sky-50 text-sky-700' },
          { label: 'Unpaid Leave', value: unpaidLeave, cls: 'bg-amber-50 text-amber-700' },
          { label: 'Awaiting validation', value: partners.length - validated, cls: 'bg-gray-50 text-gray-600' },
        ].map((s) => (
          <div key={s.label} className={cn('px-4 py-2 rounded-xl text-sm font-medium', s.cls)}>
            {s.label}: <span className="font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-60"><RefreshCw size={18} className="animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Partner', 'Shift', 'Check-in', 'Validate (P / WO / UL)', 'Notes', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => {
                  const r = rec(p.id)
                  const status = r?.validated ? r.status : null
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{pad(p.shift_start)}:00 – {pad(p.shift_start + p.shift_hours)}:00</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r?.checkinAt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-medium">
                            <Fingerprint size={11} /> {checkinLabel(r.checkinAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">not checked in</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <MarkBtn active={status === 'present'} color="emerald" onClick={() => validate(p.id, 'present')}><Check size={11} /> P</MarkBtn>
                          <MarkBtn active={status === 'weekly_off'} color="sky" onClick={() => validate(p.id, 'weekly_off')}>WO</MarkBtn>
                          <MarkBtn active={status === 'unpaid_leave'} color="amber" onClick={() => validate(p.id, 'unpaid_leave')}>UL</MarkBtn>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <input
                          type="text"
                          value={r?.notes ?? ''}
                          placeholder={status === 'weekly_off' || status === 'unpaid_leave' ? 'Reason…' : 'Add a note'}
                          onChange={(e) => patchLocal(p.id, { notes: e.target.value })}
                          onBlur={(e) => persist(p.id, { notes: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {status ? (
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', STATUS_CONFIG[status].cls)}>
                            <ShieldCheck size={11} /> {STATUS_CONFIG[status].label}
                          </span>
                        ) : r?.checkinAt ? (
                          <span className="text-xs text-sky-500">checked in · needs validation</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function MarkBtn({ active, color, onClick, children }: {
  active: boolean
  color: 'emerald' | 'sky' | 'amber'
  onClick: () => void
  children: React.ReactNode
}) {
  const activeCls = color === 'emerald' ? 'bg-emerald-500 text-white border-emerald-500'
    : color === 'sky' ? 'bg-sky-500 text-white border-sky-500'
    : 'bg-amber-400 text-white border-amber-400'
  const hover = color === 'emerald' ? 'hover:border-emerald-300' : color === 'sky' ? 'hover:border-sky-300' : 'hover:border-amber-300'
  return (
    <button
      onClick={onClick}
      className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1',
        active ? activeCls : `bg-white text-gray-600 border-gray-200 ${hover}`)}
    >
      {children}
    </button>
  )
}
