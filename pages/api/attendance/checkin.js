// pages/api/attendance/checkin.js
import { requireAuth }   from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { checkGeofence } from '../../../lib/geofence'
import { notifyCheckIn } from '../../../lib/notify'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const db    = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]
  const now   = new Date().toISOString()

  const { data: existing } = await db
    .from('attendances')
    .select('id, check_in')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .single()

  if (existing?.check_in) {
    return res.status(400).json({ error: 'Anda sudah check-in hari ini' })
  }

  const { note, latitude, longitude, face_verified, face_photo_url } = req.body

  // ── Geofence validation ─────────────────────────────────────────────────────
  if (req.user.branch_id && latitude && longitude) {
    const { data: branch } = await db
      .from('branches')
      .select('latitude, longitude, geofence_radius, name')
      .eq('id', req.user.branch_id)
      .single()

    if (branch) {
      const geo = checkGeofence(branch, latitude, longitude)
      if (!geo.valid && !geo.bypassed) {
        return res.status(400).json({
          error: `Gagal check-in: ${geo.message}`,
          geofence: { distance: geo.distance, radius: geo.radius },
        })
      }
    }
  }

  // ── Hitung status (hadir / terlambat) ──────────────────────────────────────
  let status = 'present'
  if (req.user.shift_start) {
    const [sh, sm] = req.user.shift_start.split(':').map(Number)
    const shiftStart = new Date(now)
    shiftStart.setHours(sh, sm + (req.user.late_tolerance_minutes || 15), 0, 0)
    if (new Date(now) > shiftStart) status = 'late'
  }

  const payload = {
    check_in:       now,
    status,
    check_in_note:  note,
    check_in_lat:   latitude,
    check_in_lng:   longitude,
    face_verified:  face_verified || false,
    face_photo_url: face_photo_url || null,
  }

  let attendance
  if (existing) {
    const { data, error } = await db
      .from('attendances').update(payload).eq('id', existing.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    attendance = data
  } else {
    const { data, error } = await db
      .from('attendances')
      .insert({
        employee_id: req.user.id,
        branch_id:   req.user.branch_id,
        shift_id:    req.user.shift_id,
        date:        today,
        ...payload,
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    attendance = data
  }

  // ── WA Notification (fire & forget) ───────────────────────────────────────
  notifyCheckIn({ employee: req.user, attendance }).catch(() => {})

  return res.status(200).json({
    attendance,
    message: status === 'late' ? 'Check-in berhasil (terlambat)' : 'Check-in berhasil',
  })
}

export default requireAuth(handler)
