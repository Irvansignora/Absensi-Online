import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const db = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  // Check sudah check-in hari ini?
  const { data: existing } = await db
    .from('attendances')
    .select('id, check_in')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .single()

  if (existing?.check_in) {
    return res.status(400).json({ error: 'Anda sudah check-in hari ini' })
  }

  // Hitung status (hadir / terlambat)
  let status = 'present'
  if (req.user.shift_start) {
    const [sh, sm] = req.user.shift_start.split(':').map(Number)
    const shiftStart = new Date(now)
    shiftStart.setHours(sh, sm + (req.user.late_tolerance_minutes || 15), 0, 0)
    if (new Date(now) > shiftStart) status = 'late'
  }

  const { note, latitude, longitude, face_verified } = req.body

  let attendance
  if (existing) {
    // Update record yang ada (kalau ada tapi belum check-in)
    const { data, error } = await db
      .from('attendances')
      .update({ check_in: now, status, check_in_note: note, check_in_lat: latitude, check_in_lng: longitude, face_verified: face_verified || false })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    attendance = data
  } else {
    // Buat record baru
    const { data, error } = await db
      .from('attendances')
      .insert({
        employee_id: req.user.id,
        branch_id: req.user.branch_id,
        shift_id: req.user.shift_id,
        date: today,
        check_in: now,
        status,
        check_in_note: note,
        check_in_lat: latitude,
        check_in_lng: longitude,
        face_verified: face_verified || false,
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    attendance = data
  }

  return res.status(200).json({ attendance, message: 'Check-in berhasil' })
}

export default requireAuth(handler)
