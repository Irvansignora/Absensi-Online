import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { name, address, city, phone } = req.body
    const { data, error } = await db.from('branches').update({ name, address, city, phone }).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ branch: data })
  }

  if (req.method === 'DELETE') {
    const { error } = await db.from('branches').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
