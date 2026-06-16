import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { updatePartner, DAYS } from '@/lib/data'
import { RefreshCw, Search, Car, CalendarDays, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/toast'

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

const PEAK_DAYS = ['Fri', 'Sat', 'Sun']

function pad(n: number) { return String(n).padStart(2, '0') }
function shiftRange(start: number, hours: number) {
  return `${pad(start)}:00 – ${pad(start + hours)}:00`
}

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Exited' | 'all'>('Active')
  const [editing, setEditing] = useState<Partner | null>(null)

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
                {['Name', 'Mobile', 'Address', 'Shift', 'Weekly Off', 'Vehicle', 'Joined', 'Status', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No partners found</td></tr>
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
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(p)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 hover:border-indigo-300"
                    >
                      <Pencil size={12} /> Edit
                    </button>
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

      {editing && (
        <EditPartnerModal
          partner={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

// ─── Edit modal ──────────────────────────────────────────────────────────────

function EditPartnerModal({ partner, onClose, onSaved }: {
  partner: Partner
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: partner.name,
    mobile: partner.mobile,
    address: partner.address ?? '',
    shift_hours: partner.shift_hours as 8 | 10 | 12,
    shift_start: partner.shift_start,
    weekly_off: partner.weekly_off,
    has_vehicle: partner.has_vehicle,
    status: partner.status as 'Active' | 'Exited',
  })
  const [saving, setSaving] = useState(false)
  const startOptions = Array.from({ length: 9 }, (_, i) => 6 + i)

  async function save() {
    if (!form.name.trim() || !form.mobile.trim()) {
      showToast('Name and mobile are required', 'error')
      return
    }
    setSaving(true)
    try {
      await updatePartner(partner.id, {
        name: form.name, mobile: form.mobile, address: form.address,
        shiftHours: form.shift_hours, shiftStart: form.shift_start,
        weeklyOff: form.weekly_off as 'Mon' | 'Tue' | 'Wed' | 'Thu',
        hasVehicle: form.has_vehicle, status: form.status,
      })
      showToast(`${form.name} updated`, 'success')
      onSaved()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update partner', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Edit {partner.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Mobile">
              <input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Address">
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'Active' | 'Exited' }))} className={inputCls}>
                <option value="Active">Active</option>
                <option value="Exited">Exited</option>
              </select>
            </Field>
            <Field label="Shift Hours">
              <select value={form.shift_hours} onChange={(e) => setForm((f) => ({ ...f, shift_hours: Number(e.target.value) as 8 | 10 | 12 }))} className={inputCls}>
                <option value={8}>8 hours</option>
                <option value={10}>10 hours</option>
                <option value={12}>12 hours</option>
              </select>
            </Field>
            <Field label="Start Time">
              <select value={form.shift_start} onChange={(e) => setForm((f) => ({ ...f, shift_start: Number(e.target.value) }))} className={inputCls}>
                {startOptions.map((h) => <option key={h} value={h}>{pad(h)}:00</option>)}
              </select>
            </Field>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Weekly Off</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const isPeak = PEAK_DAYS.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isPeak}
                    onClick={() => setForm((f) => ({ ...f, weekly_off: day }))}
                    title={isPeak ? 'Peak demand — off not allowed' : undefined}
                    className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      isPeak ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                        : form.weekly_off === day ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.has_vehicle} onChange={(e) => setForm((f) => ({ ...f, has_vehicle: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
            <span className="text-sm text-gray-700">Has Vehicle</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving && <RefreshCw size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
