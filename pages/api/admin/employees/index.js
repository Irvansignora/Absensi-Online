import bcrypt from 'bcryptjs'
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('employees')
      .select(`id, name, email, employee_code, role, branch_id, shift_id, department, position, phone, is_active, created_at, branches(name), shifts(name)`)
      .order('name')

    const employees = (data || []).map(e => ({
      ...e,
      branch_name: e.branches?.name,
      shift_name: e.shifts?.name,
      branches: undefined,
      shifts: undefined,
    }))

    return res.status(200).json({ employees })
  }

  if (req.method === 'POST') {
    const { name, email, password, employee_code, role, branch_id, shift_id, department, position, phone, is_active } = req.body
    if (!name || !email || !password) return res.status(400).json({ error: 'Nama, email, dan password wajib diisi' })

    const password_hash = await bcrypt.hash(password, 10)

    const { data, error } = await db.from('employees').insert({
      name, email: email.toLowerCase(), password_hash, employee_code,
      role: role || 'employee', branch_id: branch_id || null, shift_id: shift_id || null,
      department, position, phone, is_active: is_active !== false
    }).select().single()

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Email sudah terdaftar' })
      return res.status(500).json({ error: error.message })
    }
    return res.status(201).json({ employee: data })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
