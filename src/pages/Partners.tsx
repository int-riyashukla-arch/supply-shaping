import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, Search, Car, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Partner {
  id: string
  name: string
  mobile: string
  address: string
  shift_hours: number
  shift_start: number
  weekly_off: string
  has_vehicle: boolean
  join_date: string
  status: string
}

function pad(n: number) { return String(n).padStart(2, '0') }
function shiftRange(start: number, hours: number) {
  return `${pad(start)}:00 – ${pad(start + hours)}:00`
}

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Exited' | 'all'>('Active')

  async function load() {
    setLoading(true)
    let query = supabase.from('partners').select('*').order('name')
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    const { data } = await query
    setPartners(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

  const filtered = partners.filter((p) =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.mobile.includes(search) ||
    p.address?.toLowerCase().includes(search.toLowerCase())
  )

  const active = partners.filter((p) => p.status === 'Active').length
  const withVehicle = partners.filter((p) => p.has_vehicle).length

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Partners', value: partners.length },
          { label: 'Active', value: active },
          { label: 'With Vehicle', value: withVehicle },
          { label: 'Exited', value: partners.length - active },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          {(['Active', 'Exited', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                statusFilter === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, mobile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Name', 'Mobile', 'Address', 'Shift', 'Weekly Off', 'Vehicle', 'Joined', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No partners found</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.mobile}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.address || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium">
                      {p.shift_hours}h
                    </span>
                    <span className="ml-1 text-gray-400">{shiftRange(p.shift_start, p.shift_hours)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                      {p.weekly_off}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.has_vehicle ? <Car size={14} className="text-emerald-500 mx-auto" /> : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    <CalendarDays size={12} className="inline mr-1 text-gray-400" />{p.join_date}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                      p.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    )}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">{filtered.length} partner{filtered.length !== 1 ? 's' : ''} shown</p>
        </div>
      </div>
    </div>
  )
}
