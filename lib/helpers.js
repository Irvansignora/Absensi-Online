import { format, parseISO, differenceInMinutes } from 'date-fns'
import { id } from 'date-fns/locale'

export function formatDate(date, fmt = 'dd MMMM yyyy') {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: id })
}

export function formatTime(date) {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'HH:mm')
}

export function formatDateTime(date) {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy HH:mm', { locale: id })
}

export function calculateWorkHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '-'
  const mins = differenceInMinutes(
    typeof checkOut === 'string' ? parseISO(checkOut) : checkOut,
    typeof checkIn === 'string' ? parseISO(checkIn) : checkIn
  )
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}j ${m}m`
}

export function getAttendanceStatus(checkInTime, shiftStartTime) {
  if (!checkInTime) return 'absent'
  if (!shiftStartTime) return 'present'

  // Compare check-in time with shift start
  const [sh, sm] = shiftStartTime.split(':').map(Number)
  const checkIn = typeof checkInTime === 'string' ? parseISO(checkInTime) : checkInTime
  const shiftStart = new Date(checkIn)
  shiftStart.setHours(sh, sm, 0, 0)

  const diffMins = differenceInMinutes(checkIn, shiftStart)
  if (diffMins > 15) return 'late'
  return 'present'
}

export function getStatusBadge(status) {
  const map = {
    present: { label: 'Hadir', color: 'green' },
    late: { label: 'Terlambat', color: 'yellow' },
    absent: { label: 'Absen', color: 'red' },
    half_day: { label: 'Setengah Hari', color: 'orange' },
    leave: { label: 'Izin/Cuti', color: 'blue' },
  }
  return map[status] || { label: status, color: 'gray' }
}

export function todayString() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function nowISO() {
  return new Date().toISOString()
}
