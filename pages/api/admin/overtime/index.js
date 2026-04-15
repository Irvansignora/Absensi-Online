// pages/api/admin/overtime/index.js
import { requireAuth }         from '../../../../lib/auth'
import { supabaseAdmin }       from '../../../../lib/supabase'
import { notifyOvertimeReview } from '../../../../lib/notify'

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { status, employee_id, month, year } = req.query
    let query = db
      .from('overtime_logs')
      .select('*, employees!overtime_logs_employee_id_fkey(name, employee_code, department, phone), approver:employees!overtime_logs_approved_by_fkey(name)')
      .order('date', { ascending: false })

    if (status)      query = query.eq('status', status)
    if (employee_id) query = query.eq('employee_id', employee_id)
    if (month && year) {
      const start = `${year}-${String(month).padStart(2,'0')}-01`
      const end   = new Date(year, month, 0).toISOString().split('T')[0]
      query = query.gte('date', start).lte('date', end)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Summary stats
    const total_pending  = (data || []).filter(o => o.status === 'pending').length
    const total_approved = (data || []).filter(o => o.status === 'approved').length
    const total_minutes  = (data || []).filter(o => o.status === 'approved').reduce((s, o) => s + (o.minutes || 0), 0)

    return res.status(200).json({
      overtime: data || [],
      stats: { total_pending, total_approved, total_minutes },
    })
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
      .select('*, employees!overtime_logs_employee_id_fkey(name, phone, employee_code)')
      .single()

    if (error) return res.status(500).json({ error: error.message })

    if (status === 'approved') {
      await db.from('attendances')
        .update({ overtime_approved: true })
        .eq('id', data.attendance_id)
    }

    // WA Notification
    if (data.employees?.phone) {
      notifyOvertimeReview({ employee: data.employees, overtime: data, status }).catch(() => {})
    }

    return res.status(200).json({ overtime: data })
  }

  // BULK approve/reject
  if (req.method === 'POST') {
    const { ids, status } = req.body
    if (!ids?.length || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Data tidak valid' })
    }

    const { data, error } = await db
      .from('overtime_logs')
      .update({ status, approved_by: req.user.id, approved_at: new Date().toISOString() })
      .in('id', ids)
      .select('*, employees!overtime_logs_employee_id_fkey(name, phone)')

    if (error) return res.status(500).json({ error: error.message })

    if (status === 'approved') {
      const attIds = data.map(o => o.attendance_id).filter(Boolean)
      if (attIds.length) {
        await db.from('attendances').update({ overtime_approved: true }).in('id', attIds)
      }
    }

    return res.status(200).json({ updated: data?.length || 0 })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
