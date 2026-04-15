// pages/api/admin/roster/index.js
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  // GET: ambil roster untuk rentang tanggal
  if (req.method === 'GET') {
    const { start_date, end_date, branch_id } = req.query
    if (!start_date || !end_date) return res.status(400).json({ error: 'start_date dan end_date wajib' })

    let empQuery = db
      .from('employees')
      .select('id, name, employee_code, department, shift_id, branch_id, shifts(id, name, start_time, end_time)')
      .eq('is_active', true)
      .order('name')

    if (branch_id) empQuery = empQuery.eq('branch_id', branch_id)

    const { data: employees, error: empErr } = await empQuery
    if (empErr) return res.status(500).json({ error: empErr.message })

    // Ambil roster overrides
    const { data: rosters } = await db
      .from('roster_schedules')
      .select('*, shifts(id, name, start_time, end_time)')
      .gte('date', start_date)
      .lte('date', end_date)

    // Ambil attendance untuk preview status
    const { data: attendances } = await db
      .from('attendances')
      .select('employee_id, date, status, check_in, check_out')
      .gte('date', start_date)
      .lte('date', end_date)

    const { data: shifts } = await db
      .from('shifts')
      .select('id, name, start_time, end_time')
      .order('start_time')

    return res.status(200).json({
      employees: employees || [],
      rosters:   rosters   || [],
      attendances: attendances || [],
      shifts:    shifts    || [],
    })
  }

  // PUT: set/update roster untuk satu karyawan satu hari
  if (req.method === 'PUT') {
    const { employee_id, date, shift_id, is_off } = req.body
    if (!employee_id || !date) return res.status(400).json({ error: 'employee_id dan date wajib' })

    const { data, error } = await db
      .from('roster_schedules')
      .upsert(
        { employee_id, date, shift_id: is_off ? null : shift_id, is_off: is_off || false },
        { onConflict: 'employee_id,date' }
      )
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ roster: data })
  }

  // POST: bulk set roster (paste dari template)
  if (req.method === 'POST') {
    const { entries } = req.body // [{ employee_id, date, shift_id, is_off }]
    if (!entries?.length) return res.status(400).json({ error: 'entries wajib diisi' })

    const { data, error } = await db
      .from('roster_schedules')
      .upsert(entries, { onConflict: 'employee_id,date' })
      .select()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ updated: data?.length || 0 })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
