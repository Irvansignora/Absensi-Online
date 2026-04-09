// pages/api/admin/payroll/[id].js
// PUT → update status payroll (approved / paid)
// GET → detail satu payroll

import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('payrolls')
      .select(`*, employees!payrolls_employee_id_fkey(name, employee_code, department, position, branches(name))`)
      .eq('id', id)
      .single()
    if (error) return res.status(404).json({ error: 'Tidak ditemukan' })
    return res.status(200).json({ payroll: data })
  }

  if (req.method === 'PUT') {
    const { status, paid_at, payment_note } = req.body
    const validStatus = ['draft', 'approved', 'paid']
    if (!validStatus.includes(status)) return res.status(400).json({ error: 'Status tidak valid' })

    const payload = { status }
    if (status === 'approved') payload.approved_by = req.user.id
    if (status === 'paid') {
      payload.paid_at = paid_at || new Date().toISOString()
      payload.payment_note = payment_note || null
    }

    const { data, error } = await db.from('payrolls').update(payload).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ payroll: data })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
