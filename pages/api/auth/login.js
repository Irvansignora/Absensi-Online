import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../../../lib/supabase'
import { signToken, setAuthCookie } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' })

  const db = supabaseAdmin()
  const { data: user, error } = await db
    .from('employees')
    .select('id, name, email, password_hash, role, branch_id, shift_id, is_active, employee_code')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !user) return res.status(401).json({ error: 'Email atau password salah' })
  if (!user.is_active) return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Email atau password salah' })

  // Get branch & shift names
  let branch_name = null, shift_name = null, shift_start = null, shift_end = null
  if (user.branch_id) {
    const { data: branch } = await db.from('branches').select('name').eq('id', user.branch_id).single()
    branch_name = branch?.name
  }
  if (user.shift_id) {
    const { data: shift } = await db.from('shifts').select('name, start_time, end_time').eq('id', user.shift_id).single()
    shift_name = shift?.name; shift_start = shift?.start_time; shift_end = shift?.end_time
  }

  const payload = { id: user.id, email: user.email, name: user.name, role: user.role, branch_id: user.branch_id, shift_id: user.shift_id, branch_name, shift_name, shift_start, shift_end, employee_code: user.employee_code }
  const token = signToken(payload)
  setAuthCookie(res, token)

  return res.status(200).json({ user: payload })
}
