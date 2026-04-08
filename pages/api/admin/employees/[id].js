import bcrypt from 'bcryptjs'
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { name, email, password, employee_code, role, branch_id, shift_id, department, position, phone, is_active } = req.body

    const updateData = {
      ...(name && { name }),
      ...(email && { email: email.toLowerCase() }),
      ...(employee_code !== undefined && { employee_code }),
      ...(role && { role }),
      ...(branch_id !== undefined && { branch_id: branch_id || null }),
      ...(shift_id !== undefined && { shift_id: shift_id || null }),
      ...(department !== undefined && { department }),
      ...(position !== undefined && { position }),
      ...(phone !== undefined && { phone }),
      ...(is_active !== undefined && { is_active }),
      updated_at: new Date().toISOString(),
    }

    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10)
    }

    const { data, error } = await db.from('employees').update(updateData).eq('id', id).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ employee: data })
  }

  if (req.method === 'DELETE') {
    // Soft delete - just deactivate
    const { error } = await db.from('employees').update({ is_active: false }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('employees')
      .select('*, branches(name), shifts(name, start_time, end_time)')
      .eq('id', id)
      .single()
    if (error) return res.status(404).json({ error: 'Karyawan tidak ditemukan' })
    return res.status(200).json({ employee: data })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
