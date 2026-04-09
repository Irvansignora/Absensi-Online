// pages/api/admin/requests/index.js
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { status, type, employee_id } = req.query

    let query = db
      .from('requests')
      .select(`
        *,
        employees!requests_employee_id_fkey(name, employee_code, department, branch_id, branches(name, timezone)),
        swap_employee:employees!requests_swap_with_employee_id_fkey(name, employee_code),
        swap_shift:shifts!requests_swap_shift_id_fkey(name, start_time, end_time),
        reviewer:employees!requests_reviewed_by_fkey(name)
      `)
      .order('created_at', { ascending: false })

    if (status)      query = query.eq('status', status)
    if (type)        query = query.eq('type', type)
    if (employee_id) query = query.eq('employee_id', employee_id)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ requests: data || [] })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
