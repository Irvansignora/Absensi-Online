import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('shifts')
      .select(`
        id, name, start_time, end_time, branch_id, late_tolerance_minutes, work_days, created_at,
        branches(name)
      `)
      .order('name')

    if (error) return res.status(500).json({ error: error.message })

    // Count employees per shift
    const shifts = await Promise.all((data || []).map(async (s) => {
      const { count } = await db.from('employees').select('id', { count: 'exact', head: true }).eq('shift_id', s.id).eq('is_active', true)
      return {
        ...s,
        branch_name: s.branches?.name,
        employee_count: count || 0,
        branches: undefined,
      }
    }))

    return res.status(200).json({ shifts })
  }

  if (req.method === 'POST') {
    const { name, start_time, end_time, branch_id, late_tolerance_minutes, work_days } = req.body
    if (!name || !start_time || !end_time) return res.status(400).json({ error: 'Nama, jam masuk, dan jam keluar wajib diisi' })

    const { data, error } = await db.from('shifts').insert({
      name, start_time, end_time,
      branch_id: branch_id || null,
      late_tolerance_minutes: late_tolerance_minutes || 15,
      work_days: work_days || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ shift: data })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
