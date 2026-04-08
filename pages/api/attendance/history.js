import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()
  const limit = parseInt(req.query.limit) || 30

  const { data, error } = await db
    .from('attendances')
    .select('*')
    .eq('employee_id', req.user.id)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ records: data || [] })
}

export default requireAuth(handler)
