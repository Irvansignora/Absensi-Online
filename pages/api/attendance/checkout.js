// pages/api/attendance/checkout.js
import { requireAuth }    from '../../../lib/auth'
import { supabaseAdmin }  from '../../../lib/supabase'
import { notifyCheckOut } from '../../../lib/notify'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const db    = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]
  const now   = new Date().toISOString()

  const { data: attendance } = await db
    .from('attendances')
    .select('*, employees!attendances_employee_id_fkey(shift_id, shifts(end_time, overtime_multiplier, max_overtime_hours, branch_id, branches(timezone_offset)))')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .single()

  if (!attendance?.check_in)  return res.status(400).json({ error: 'Anda belum check-in hari ini' })
  if (attendance.check_out)   return res.status(400).json({ error: 'Anda sudah check-out hari ini' })

  const { note, latitude, longitude, face_verified, face_photo_url } = req.body

  // ── Hitung lembur ──────────────────────────────────────────────────────────
  let overtime_minutes = 0
  const shift = attendance.employees?.shifts
  if (shift?.end_time) {
    const tzOffset   = shift.branches?.timezone_offset ?? 7
    const nowUTCMs   = new Date(now).getTime()
    const nowLocalMs = nowUTCMs + tzOffset * 3600 * 1000
    const nowLocal   = new Date(nowLocalMs)
    const [eh, em]   = shift.end_time.split(':').map(Number)
    const shiftEnd   = new Date(nowLocal)
    shiftEnd.setHours(eh, em, 0, 0)
    const diffMins   = Math.floor((nowLocal - shiftEnd) / 60000)
    const maxOT      = (shift.max_overtime_hours ?? 4) * 60
    if (diffMins > 0) overtime_minutes = Math.min(diffMins, maxOT)
  }

  // ── Hitung jam kerja & status ──────────────────────────────────────────────
  const workMins = Math.floor((new Date(now) - new Date(attendance.check_in)) / 60000)
  let status = attendance.status
  if (workMins < 240 && status === 'present') status = 'half_day'

  const { data, error } = await db
    .from('attendances')
    .update({
      check_out:          now,
      check_out_note:     note,
      check_out_lat:      latitude,
      check_out_lng:      longitude,
      face_verified:      face_verified || attendance.face_verified || false,
      face_photo_url_out: face_photo_url || null,
      status,
      overtime_minutes:   overtime_minutes > 0 ? overtime_minutes : null,
    })
    .eq('id', attendance.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // ── Buat overtime_log jika lembur ──────────────────────────────────────────
  if (overtime_minutes > 0) {
    const multiplier = shift?.overtime_multiplier ?? 1.5
    await db.from('overtime_logs').insert({
      attendance_id:  attendance.id,
      employee_id:    req.user.id,
      date:           today,
      overtime_start: new Date(new Date(now).getTime() - overtime_minutes * 60000).toISOString(),
      overtime_end:   now,
      minutes:        overtime_minutes,
      multiplier,
      status:         'pending',
    })
  }

  // ── WA Notification (fire & forget) ───────────────────────────────────────
  notifyCheckOut({ employee: req.user, attendance: data, overtime_minutes }).catch(() => {})

  return res.status(200).json({
    attendance: data,
    overtime_minutes,
    message: overtime_minutes > 0
      ? `Check-out berhasil! Lembur ${Math.floor(overtime_minutes/60)}j${overtime_minutes%60}m (menunggu persetujuan)`
      : 'Check-out berhasil',
  })
}

export default requireAuth(handler)
