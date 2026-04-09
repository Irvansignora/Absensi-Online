// pages/api/admin/overtime/index.js
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { status } = req.query
    let query = db
      .from('overtime_logs')
      .select('*, employees!overtime_logs_employee_id_fkey(name, employee_code, department), approver:employees!overtime_logs_approved_by_fkey(name)')
      .order('date', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ overtime: data || [] })
  }

  if (req.method === 'PUT') {
    const { id, status, notes } = req.body
    if (!id || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Data tidak valid' })
    }

    const { data, error } = await db
      .from('overtime_logs')
      .update({ status, notes, approved_by: req.user.id, approved_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Sync ke attendances
    if (status === 'approved') {
      await db.from('attendances')
        .update({ overtime_approved: true })
        .eq('id', data.attendance_id)
    }

    return res.status(200).json({ overtime: data })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
