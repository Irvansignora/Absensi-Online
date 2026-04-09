// pages/api/shifts/index.js
// Endpoint untuk karyawan biasa - ambil daftar shift untuk tukar shift
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const db = supabaseAdmin()

  const { data, error } = await db
    .from('shifts')
    .select('id, name, start_time, end_time, branch_id')
    .order('name')

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ shifts: data || [] })
}

export default requireAuth(handler)
