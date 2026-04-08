import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { name, start_time, end_time, branch_id, late_tolerance_minutes, work_days } = req.body
    const { data, error } = await db.from('shifts').update({
      ...(name && { name }),
      ...(start_time && { start_time }),
      ...(end_time && { end_time }),
      ...(branch_id !== undefined && { branch_id: branch_id || null }),
      ...(late_tolerance_minutes !== undefined && { late_tolerance_minutes }),
      ...(work_days && { work_days }),
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ shift: data })
  }

  if (req.method === 'DELETE') {
    // Check if any employee uses this shift
    const { count } = await db.from('employees').select('id', { count: 'exact', head: true }).eq('shift_id', id).eq('is_active', true)
    if (count > 0) return res.status(400).json({ error: `Shift tidak bisa dihapus karena masih digunakan oleh ${count} karyawan` })

    const { error } = await db.from('shifts').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
