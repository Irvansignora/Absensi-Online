// pages/api/admin/branches/[id].js
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

const TIMEZONE_MAP = { WIB: 7, WITA: 8, WIT: 9 }

async function handler(req, res) {
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { name, address, city, phone, timezone } = req.body
    if (!name) return res.status(400).json({ error: 'Nama cabang wajib diisi' })

    const tz        = timezone || 'WIB'
    const tz_offset = TIMEZONE_MAP[tz] ?? 7

    const { data, error } = await db
      .from('branches')
      .update({ name, address, city, phone, timezone: tz, timezone_offset: tz_offset })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ branch: data })
  }

  if (req.method === 'DELETE') {
    const { count } = await db
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', id)
      .eq('is_active', true)

    if (count > 0) {
      return res.status(400).json({ error: `Tidak bisa hapus cabang yang masih punya ${count} karyawan aktif` })
    }

    const { error } = await db.from('branches').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ message: 'Cabang berhasil dihapus' })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
