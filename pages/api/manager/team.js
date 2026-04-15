// pages/api/manager/team.js
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { type, status, date } = req.query
    const today = date || new Date().toISOString().split('T')[0]

    // Cari semua karyawan yang manager_id = req.user.id
    const { data: team } = await db
      .from('employees')
      .select('id, name, employee_code, department, position, phone, shift_id, shifts(name, start_time, end_time)')
      .eq('manager_id', req.user.id)
      .eq('is_active', true)
      .order('name')

    if (type === 'attendance') {
      const empIds = (team || []).map(e => e.id)
      if (!empIds.length) return res.status(200).json({ team: [], attendances: [] })

      const { data: attendances } = await db
        .from('attendances')
        .select('*')
        .in('employee_id', empIds)
        .eq('date', today)

      return res.status(200).json({ team: team || [], attendances: attendances || [], date: today })
    }

    if (type === 'requests') {
      const empIds = (team || []).map(e => e.id)
      if (!empIds.length) return res.status(200).json({ requests: [] })

      let q = db
        .from('leave_requests')
        .select('*, employees!leave_requests_employee_id_fkey(name, department)')
        .in('employee_id', empIds)
        .order('created_at', { ascending: false })

      if (status) q = q.eq('status', status)

      const { data: requests } = await q
      return res.status(200).json({ requests: requests || [] })
    }

    return res.status(200).json({ team: team || [] })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { roles: ['admin', 'hr', 'manager'] })
