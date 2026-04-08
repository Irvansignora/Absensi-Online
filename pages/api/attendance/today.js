import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await db
    .from('attendances')
    .select('*')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .single()

  return res.status(200).json({ attendance: data || null })
}

export default requireAuth(handler)
