import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const db = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  const { data: attendance } = await db
    .from('attendances')
    .select('*')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .single()

  if (!attendance?.check_in) {
    return res.status(400).json({ error: 'Anda belum check-in hari ini' })
  }
  if (attendance.check_out) {
    return res.status(400).json({ error: 'Anda sudah check-out hari ini' })
  }

  const { note, latitude, longitude } = req.body

  // Hitung jam kerja - kalau < 4 jam = half_day
  const workMins = Math.floor((new Date(now) - new Date(attendance.check_in)) / 60000)
  let status = attendance.status
  if (workMins < 240 && status === 'present') status = 'half_day'

  const { data, error } = await db
    .from('attendances')
    .update({
      check_out: now,
      check_out_note: note,
      check_out_lat: latitude,
      check_out_lng: longitude,
      work_minutes: workMins,
      status,
    })
    .eq('id', attendance.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ attendance: data, message: 'Check-out berhasil' })
}

export default requireAuth(handler)
