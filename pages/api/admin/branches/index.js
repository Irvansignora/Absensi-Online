import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('branches')
      .select(`*, employees(count)`)
      .order('name')

    const branches = (data || []).map(b => ({
      ...b,
      employee_count: b.employees?.[0]?.count || 0,
      employees: undefined,
    }))

    return res.status(200).json({ branches })
  }

  if (req.method === 'POST') {
    const { name, address, city, phone } = req.body
    if (!name) return res.status(400).json({ error: 'Nama cabang wajib diisi' })

    const { data, error } = await db.from('branches').insert({ name, address, city, phone }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ branch: data })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
