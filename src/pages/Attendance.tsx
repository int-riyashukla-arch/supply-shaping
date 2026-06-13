import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, Calendar, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Partner { id: string; name: string; shift_start: number; shift_hours: number; weekly_off: string }

type AttendanceStatus = 'present' | 'absent' | 'leave' | null

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function pad(n: number) { return String(n).padStart(2, '0') }

const STATUS_CONFIG = {
  present: { label: 'Present', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  absent:  { label: 'Absent',  cls: 'bg-red-100 text-red-700 border-red-200' },
  leave:   { label: 'Leave',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
}

export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [partners, setPartners] = useState<Partner[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('partners')
        .select('id, name, shift_start, shift_hours, weekly_off')
        .eq('status', 'Active')
        .order('name')
      const dow = DAY_NAMES[new Date(selectedDate + 'T00:00:00').getDay()]
      const filtered = (data ?? []).filter((p) => p.weekly_off !== dow)
      setPartners(filtered)
      // Pre-fill off-day partners as absent
      const init: Record<string, AttendanceStatus> = {}
      for (const p of filtered) init[p.id] = null
      setAttendance(init)
      setLoading(false)
    }
    load()
  }, [selectedDate])

  function mark(id: string, status: AttendanceStatus) {
    setAttendance((prev) => ({ ...prev, [id]: status }))
  }

  const marked  = Object.values(attendance).filter(Boolean).length
  const present = Object.values(attendance).filter((v) => v === 'present').length
  const absent  = Object.values(attendance).filter((v) => v === 'absent').length
  const leave   = Object.values(attendance).filter((v) => v === 'leave').length

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Date picker */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-4 items-center">
        <Calendar size={16} className="text-indigo-500" />
        <label className="text-sm font-medium text-gray-700">Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Scheduled', value: partners.length, cls: 'bg-indigo-50 text-indigo-700' },
          { label: 'Present',   value: present,         cls: 'bg-emerald-50 text-emerald-700' },
          { label: 'Absent',    value: absent,           cls: 'bg-red-50 text-red-700' },
          { label: 'On Leave',  value: leave,            cls: 'bg-amber-50 text-amber-700' },
          { label: 'Unmarked',  value: partners.length - marked, cls: 'bg-gray-50 text-gray-600' },
        ].map((s) => (
          <div key={s.label} className={cn('px-4 py-2 rounded-xl text-sm font-medium', s.cls)}>
            {s.label}: <span className="font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-60">
          <RefreshCw size={18} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Partner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Shift</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mark</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => {
                const status = attendance[p.id]
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                      {pad(p.shift_start)}:00 – {pad(p.shift_start + p.shift_hours)}:00
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => mark(p.id, 'present')}
                          className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1',
                            status === 'present' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                          )}
                        >
                          <Check size={11} /> P
                        </button>
                        <button
                          onClick={() => mark(p.id, 'absent')}
                          className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1',
                            status === 'absent' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                          )}
                        >
                          <X size={11} /> A
                        </button>
                        <button
                          onClick={() => mark(p.id, 'leave')}
                          className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                            status === 'leave' ? 'bg-amber-400 text-white border-amber-400' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                          )}
                        >
                          L
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {status ? (
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', STATUS_CONFIG[status].cls)}>
                          {STATUS_CONFIG[status].label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {marked > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
              <button className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600">
                Save attendance
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
