// pages/api/payroll/index.js
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    // Only fetch payrolls for the logged-in employee
    // Only show 'approved' or 'paid' status
    const { data, error } = await db
      .from('payrolls')
      .select('*, employees!payrolls_employee_id_fkey(name, employee_code, department, position, branches(name))')
      .eq('employee_id', req.user.id)
      .in('status', ['approved', 'paid'])
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    const formatted = (data || []).map(p => ({
      ...p,
      employee_name: p.employees?.name,
      employee_code: p.employees?.employee_code,
      department:    p.employees?.department,
      position:      p.employees?.position,
      branch_name:   p.employees?.branches?.name,
    }))

    return res.status(200).json({ payrolls: formatted })
  }

  return res.status(405).end()
}

export default requireAuth(handler)
