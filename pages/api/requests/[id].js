// pages/api/requests/[id].js
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'DELETE') {
    // Karyawan hanya bisa hapus request milik sendiri yang masih pending
    const { data: existing } = await db
      .from('requests')
      .select('id, status, employee_id')
      .eq('id', id)
      .single()

    if (!existing) return res.status(404).json({ error: 'Pengajuan tidak ditemukan' })
    if (existing.employee_id !== req.user.id && !['admin', 'hr'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Tidak punya akses' })
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({ error: 'Hanya pengajuan berstatus pending yang bisa dibatalkan' })
    }

    await db.from('requests').delete().eq('id', id)
    return res.status(200).json({ message: 'Pengajuan dibatalkan' })
  }

  return res.status(405).end()
}

export default requireAuth(handler)
