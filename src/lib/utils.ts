import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Accepts whole or half hours (e.g. 8.5 → "8:30AM", 16.5 → "4:30PM").
export function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const mins = Math.round((hour - h) * 60)
  const mm = mins ? `:${String(mins).padStart(2, '0')}` : ''
  const period = h >= 12 ? 'PM' : 'AM'
  const disp = h % 12 === 0 ? 12 : h % 12
  return `${disp}${mm}${period}`
}

// 24-hour label for shift ranges, e.g. 8.5 → "08:30".
export function formatClock(hour: number): string {
  const h = Math.floor(hour)
  const mins = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function dayLabel(day: string): string {
  return day
}
