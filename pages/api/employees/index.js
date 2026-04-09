// pages/api/employees/index.js
// Endpoint untuk karyawan biasa - ambil daftar rekan kerja untuk tukar shift/libur
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const db = supabaseAdmin()

  // Ambil semua karyawan aktif KECUALI diri sendiri
  const { data, error } = await db
    .from('employees')
    .select('id, name, employee_code, department, position, branch_id, shift_id, branches(name), shifts(name)')
    .eq('is_active', true)
    .neq('id', req.user.id)
    .order('name')

  if (error) return res.status(500).json({ error: error.message })

  const employees = (data || []).map(e => ({
    id: e.id,
    name: e.name,
    employee_code: e.employee_code,
    department: e.department,
    position: e.position,
    branch_id: e.branch_id,
    branch_name: e.branches?.name,
    shift_id: e.shift_id,
    shift_name: e.shifts?.name,
  }))

  return res.status(200).json({ employees })
}

export default requireAuth(handler)
