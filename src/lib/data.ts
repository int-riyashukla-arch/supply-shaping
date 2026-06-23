import { supabase } from './supabase'

// ─── Constants ───────────────────────────────────────────────────────────────

export const CAPACITY_PER_PARTNER_PER_HOUR = 0.80 // avg 55 min service + ~15 min travel
export const LEAVE_BUFFER = 0.20

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const

// ─── Types ───────────────────────────────────────────────────────────────────

export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export interface Partner {
  id: string
  name: string
  mobile: string
  address: string
  shiftHours: 8 | 10 | 12
  shiftStart: number
  weeklyOff: DayKey
  hasVehicle: boolean
  joinDate: string
  status: 'Active' | 'Inactive' | 'Exited'
}

export interface HourlyDemand { hour: number; demand: number }

export interface DayHourMetrics {
  day: DayKey
  hour: number
  demand: number
  required: number
  scheduled: number
  effective: number
  deficit: number
}

export interface NewSlotRecommendation {
  shiftHours: 8 | 10 | 12
  startTime: number
  endTime: number
  weeklyOffOptions: string[]
  reason: string
  score: number
}

export interface PartnerSlotOption {
  shiftHours: 8 | 10 | 12
  startTime: number
  endTime: number
  weeklyOff: string
  reason: string
  deficitReduction: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function partnerCoversHour(partner: Partner, hour: number): boolean {
  return hour >= partner.shiftStart && hour < partner.shiftStart + partner.shiftHours
}

// ─── Data Access Functions ────────────────────────────────────────────────────

export async function getPartners(): Promise<Partner[]> {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('status', 'Active')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    mobile: r.mobile,
    address: r.address,
    shiftHours: r.shift_hours as 8 | 10 | 12,
    shiftStart: r.shift_start,
    weeklyOff: r.weekly_off as DayKey,
    hasVehicle: r.has_vehicle,
    joinDate: r.join_date,
    status: r.status as 'Active' | 'Inactive' | 'Exited',
  }))
}

/** Returns average confirmed orders per hour for each day-of-week, derived from raw bookings. */
export async function getDayHourDemand(): Promise<Record<DayKey, Record<number, number>>> {
  const { data, error } = await supabase
    .from('orders')
    .select('scheduled_date, scheduled_time')
    .eq('status', 'confirmed')
  if (error) throw error

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayCounts: Record<string, number> = {}
  const hoursByDay: Record<string, Record<number, number>> = {}

  const uniqueDates = new Set<string>()
  for (const row of data ?? []) {
    if (row.scheduled_date) uniqueDates.add(row.scheduled_date as string)
  }

  for (const d of uniqueDates) {
    const dow = DOW[new Date(d).getDay()]
    dayCounts[dow] = (dayCounts[dow] ?? 0) + 1
  }

  for (const row of data ?? []) {
    if (!row.scheduled_date || !row.scheduled_time) continue
    const dow = DOW[new Date(row.scheduled_date as string).getDay()]
    const hour = parseInt((row.scheduled_time as string).split(':')[0], 10)
    if (!hoursByDay[dow]) hoursByDay[dow] = {}
    hoursByDay[dow][hour] = (hoursByDay[dow][hour] ?? 0) + 1
  }

  const result: Record<string, Record<number, number>> = {}
  for (const day of DAYS) {
    const count = Math.max(1, dayCounts[day] ?? 1)
    result[day] = {}
    for (const hour of HOURS) {
      result[day][hour] = (hoursByDay[day]?.[hour] ?? 0) / count
    }
  }
  return result as Record<DayKey, Record<number, number>>
}

/** Legacy: overall hourly average across all days (used by chart x-axis summary). */
export async function getHourlyDemand(): Promise<HourlyDemand[]> {
  const byDay = await getDayHourDemand()
  return HOURS.map((h) => ({
    hour: h,
    demand: DAYS.reduce((s, d) => s + (byDay[d][h] ?? 0), 0) / DAYS.length,
  }))
}

export async function getDayHourMetrics(): Promise<DayHourMetrics[]> {
  const [partners, byDay] = await Promise.all([getPartners(), getDayHourDemand()])

  const metrics: DayHourMetrics[] = []
  for (const day of DAYS) {
    for (const hour of HOURS) {
      const demand = byDay[day][hour] ?? 0
      const required = demand / CAPACITY_PER_PARTNER_PER_HOUR
      const scheduled = partners.filter(
        (p) => p.weeklyOff !== day && partnerCoversHour(p, hour)
      ).length
      const effective = scheduled * (1 - LEAVE_BUFFER)
      metrics.push({ day, hour, demand, required, scheduled, effective, deficit: effective - required })
    }
  }
  return metrics
}

export async function getNewSlotRecommendations(count: number): Promise<NewSlotRecommendation[]> {
  const [partners, byDay] = await Promise.all([getPartners(), getDayHourDemand()])

  function buildGrid(list: Partner[]): Record<string, number> {
    const grid: Record<string, number> = {}
    for (const day of DAYS) {
      for (const hour of HOURS) {
        const demand = byDay[day][hour] ?? 0
        const required = demand / CAPACITY_PER_PARTNER_PER_HOUR
        const scheduled = list.filter((p) => p.weeklyOff !== day && partnerCoversHour(p, hour)).length
        grid[`${day}-${hour}`] = scheduled * (1 - LEAVE_BUFFER) - required
      }
    }
    return grid
  }

  const currentGrid = buildGrid(partners)
  const fmt = (h: number) => h === 12 ? '12PM' : h < 12 ? `${h}AM` : `${h - 12}PM`

  interface Candidate { shiftHours: 8|10|12; startTime: number; score: number; offOptions: string[]; reason: string }
  const candidates: Candidate[] = []

  for (const shiftHours of [8, 10, 12] as const) {
    for (const startTime of [6,7,8,9,10,11,12,13,14]) {
      if (startTime + shiftHours > 21) continue
      const dayScores = DAYS.map((offDay) => {
        let s = 0
        for (const workDay of DAYS) {
          if (workDay === offDay) continue
          for (const hour of HOURS) {
            if (hour < startTime || hour >= startTime + shiftHours) continue
            const def = currentGrid[`${workDay}-${hour}`] ?? 0
            if (def < 0) s += Math.abs(def)
          }
        }
        return { day: offDay, score: s }
      })
      const totalScore = dayScores.reduce((s, d) => s + d.score, 0)
      dayScores.sort((a, b) => b.score - a.score)
      const peakHours = HOURS.filter((h) => h >= startTime && h < startTime + shiftHours)
      const peakDef = peakHours.reduce((s, h) => {
        const worst = Math.min(...DAYS.map((d) => currentGrid[`${d}-${h}`] ?? 0))
        return s + worst
      }, 0) / (peakHours.length || 1)
      const reason = peakDef < -3
        ? `${fmt(startTime)}–${fmt(startTime + shiftHours)} closes the biggest supply gap (avg ${peakDef.toFixed(1)} deficit across peak hours)`
        : `${fmt(startTime)}–${fmt(startTime + shiftHours)} provides best mid-day coverage`
      candidates.push({ shiftHours, startTime, score: totalScore, offOptions: dayScores.slice(0, 2).map((d) => d.day), reason })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const chosen: Candidate[] = []
  for (const c of candidates) {
    if (chosen.length >= count) break
    if (!chosen.some((e) => e.shiftHours === c.shiftHours && Math.abs(e.startTime - c.startTime) < 2))
      chosen.push(c)
  }

  return chosen.map((c) => ({
    shiftHours: c.shiftHours, startTime: c.startTime, endTime: c.startTime + c.shiftHours,
    weeklyOffOptions: c.offOptions, reason: c.reason, score: c.score,
  }))
}

export async function getPartnerSlotOptions(
  shiftHours: 8 | 10 | 12,
  startTime?: number
): Promise<PartnerSlotOption[]> {
  const [partners, byDay] = await Promise.all([getPartners(), getDayHourDemand()])

  const currentGrid: Record<string, number> = {}
  for (const day of DAYS) {
    for (const hour of HOURS) {
      const demand = byDay[day][hour] ?? 0
      const required = demand / CAPACITY_PER_PARTNER_PER_HOUR
      const scheduled = partners.filter(
        (p) => p.weeklyOff !== day && hour >= p.shiftStart && hour < p.shiftStart + p.shiftHours
      ).length
      currentGrid[`${day}-${hour}`] = scheduled * (1 - LEAVE_BUFFER) - required
    }
  }

  const startOptions = startTime !== undefined ? [startTime] : [6, 7, 8, 9, 10, 11, 12, 13, 14]
  const fmt = (h: number) => h === 12 ? '12PM' : h < 12 ? `${h}AM` : `${h - 12}PM`

  // For each start time, find the best weekly-off day (the one that loses the least)
  interface Candidate { startTime: number; weeklyOff: string; score: number; deficitReduction: number }
  const byStart: Candidate[] = []

  for (const st of startOptions) {
    if (st + shiftHours > 21) continue
    let bestOffDay: DayKey = DAYS[0]
    let bestScore = -Infinity
    let bestDefRed = 0
    for (const offDay of DAYS) {
      let score = 0
      let deficitReduction = 0
      for (const workDay of DAYS) {
        if (workDay === offDay) continue
        for (const hour of HOURS) {
          if (hour < st || hour >= st + shiftHours) continue
          const def = currentGrid[`${workDay}-${hour}`] ?? 0
          if (def < 0) {
            score += Math.abs(def)
            deficitReduction += Math.abs(def)
          }
        }
      }
      if (score > bestScore) { bestScore = score; bestOffDay = offDay; bestDefRed = deficitReduction }
    }
    byStart.push({ startTime: st, weeklyOff: bestOffDay, score: bestScore, deficitReduction: bestDefRed })
  }

  // Sort by score, pick top 3 with start times at least 2 hours apart
  byStart.sort((a, b) => b.score - a.score)
  const chosen: Candidate[] = []
  for (const c of byStart) {
    if (chosen.length >= 3) break
    if (!chosen.some((e) => Math.abs(e.startTime - c.startTime) < 2)) chosen.push(c)
  }

  return chosen.map((c) => {
    const endTime = c.startTime + shiftHours
    const coveredHours = HOURS.filter((h) => h >= c.startTime && h < endTime)
    const avgDef = coveredHours.reduce((s, h) => {
      const worst = Math.min(...DAYS.filter((d) => d !== c.weeklyOff).map((d) => currentGrid[`${d}-${h}`] ?? 0))
      return s + worst
    }, 0) / (coveredHours.length || 1)
    const reason = avgDef < -3
      ? `${fmt(c.startTime)}–${fmt(endTime)} closes the biggest supply gap (avg ${avgDef.toFixed(1)} deficit). ${c.weeklyOff} off loses the least coverage.`
      : `${fmt(c.startTime)}–${fmt(endTime)} fills the highest-demand window. ${c.weeklyOff} is the lightest day for this slot.`
    return { shiftHours, startTime: c.startTime, endTime, weeklyOff: c.weeklyOff, reason, deficitReduction: c.deficitReduction }
  })
}

export async function updatePartner(id: string, fields: Partial<Omit<Partner, 'id'>>): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (fields.name !== undefined) payload.name = fields.name
  if (fields.mobile !== undefined) payload.mobile = fields.mobile
  if (fields.address !== undefined) payload.address = fields.address
  if (fields.shiftHours !== undefined) payload.shift_hours = fields.shiftHours
  if (fields.shiftStart !== undefined) payload.shift_start = fields.shiftStart
  if (fields.weeklyOff !== undefined) payload.weekly_off = fields.weeklyOff
  if (fields.hasVehicle !== undefined) payload.has_vehicle = fields.hasVehicle
  if (fields.joinDate !== undefined) payload.join_date = fields.joinDate
  if (fields.status !== undefined) payload.status = fields.status
  const { error } = await supabase.from('partners').update(payload).eq('id', id)
  if (error) throw error
}

// ─── Attendance ──────────────────────────────────────────────────────────────
// Two-step: beautician taps check-in (sets checkin_at), hub manager validates
// (sets status + validated + notes). Gracefully degrades if the table is missing.

export type AttendanceStatus = 'present' | 'weekly_off' | 'unpaid_leave'

export interface AttendanceRecord {
  partnerId: string
  date: string
  checkinAt: string | null
  status: AttendanceStatus | null
  validated: boolean
  notes: string | null
}

/** Whether the attendance table exists / is reachable (false → fall back to manual marking). */
export async function attendanceEnabled(): Promise<boolean> {
  const { error } = await supabase.from('attendance').select('id', { head: true, count: 'exact' }).limit(1)
  return !error
}

export async function getAttendance(date: string): Promise<Record<string, AttendanceRecord>> {
  const { data, error } = await supabase.from('attendance').select('*').eq('date', date)
  if (error) return {} // table may not exist yet
  const map: Record<string, AttendanceRecord> = {}
  for (const r of data ?? []) {
    map[r.partner_id] = {
      partnerId: r.partner_id, date: r.date, checkinAt: r.checkin_at,
      status: r.status, validated: r.validated ?? false, notes: r.notes,
    }
  }
  return map
}

export async function upsertAttendance(rec: {
  partnerId: string
  date: string
  status?: AttendanceStatus | null
  validated?: boolean
  notes?: string | null
  checkinAt?: string | null
}): Promise<void> {
  const payload: Record<string, unknown> = { partner_id: rec.partnerId, date: rec.date }
  if (rec.status !== undefined) payload.status = rec.status
  if (rec.validated !== undefined) payload.validated = rec.validated
  if (rec.notes !== undefined) payload.notes = rec.notes
  if (rec.checkinAt !== undefined) payload.checkin_at = rec.checkinAt
  const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'partner_id,date' })
  if (error) throw error
}

export async function addPartner(partner: Omit<Partner, 'id'>): Promise<Partner> {
  if (![8, 10, 12].includes(partner.shiftHours))
    throw new Error('Shift hours must be 8, 10, or 12.')

  const { data, error } = await supabase
    .from('partners')
    .insert({
      name: partner.name, mobile: partner.mobile, address: partner.address,
      shift_hours: partner.shiftHours, shift_start: partner.shiftStart,
      weekly_off: partner.weeklyOff, has_vehicle: partner.hasVehicle,
      join_date: partner.joinDate, status: partner.status,
    })
    .select()
    .single()
  if (error) throw error

  return {
    id: data.id, name: data.name, mobile: data.mobile, address: data.address,
    shiftHours: data.shift_hours as 8|10|12, shiftStart: data.shift_start,
    weeklyOff: data.weekly_off as DayKey, hasVehicle: data.has_vehicle,
    joinDate: data.join_date, status: data.status as 'Active'|'Inactive'|'Exited',
  }
}
