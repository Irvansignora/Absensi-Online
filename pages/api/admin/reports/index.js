import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const db = supabaseAdmin()
  const { type, month, year, branch_id, employee_id, status } = req.query

  // ─── TODAY SUMMARY for dashboard ─────────────────────────────────────────
  if (type === 'today-summary') {
    const today = format(new Date(), 'yyyy-MM-dd')

    // Get today's attendance
    let query = db
      .from('attendances')
      .select(`
        id, date, check_in, check_out, status, check_in_note, check_out_note,
        employees!inner(id, name, employee_code, branch_id, shift_id, is_active, branches(name), shifts(name))
      `)
      .eq('date', today)

    if (branch_id) query = query.eq('employees.branch_id', branch_id)
    const { data: todayRecords } = await query

    // Active employees count
    let empQuery = db.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true)
    if (branch_id) empQuery = empQuery.eq('branch_id', branch_id)
    const { count: totalEmployees } = await empQuery

    // Branch & shift counts
    const { count: totalBranches } = await db.from('branches').select('id', { count: 'exact', head: true })
    const { count: totalShifts } = await db.from('shifts').select('id', { count: 'exact', head: true })

    // Monthly attendance rate
    const startOfThisMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const endOfThisMonth = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const { count: monthlyPresent } = await db.from('attendances')
      .select('id', { count: 'exact', head: true })
      .gte('date', startOfThisMonth)
      .lte('date', endOfThisMonth)
      .in('status', ['present', 'late'])

    const workDaysPassed = Math.max(1, getWorkDaysPassed())
    const monthlyRate = totalEmployees > 0
      ? Math.round((monthlyPresent / (totalEmployees * workDaysPassed)) * 100)
      : 0

    const records = (todayRecords || []).map(r => ({
      id: r.id, date: r.date, check_in: r.check_in, check_out: r.check_out,
      status: r.status, check_in_note: r.check_in_note, check_out_note: r.check_out_note,
      employee_name: r.employees?.name,
      employee_code: r.employees?.employee_code,
      branch_name: r.employees?.branches?.name,
      shift_name: r.employees?.shifts?.name,
    }))

    const stats = {
      total_employees: totalEmployees || 0,
      present_today: records.filter(r => r.status === 'present').length,
      late_today: records.filter(r => r.status === 'late').length,
      absent_today: Math.max(0, (totalEmployees || 0) - records.length),
      total_branches: totalBranches || 0,
      total_shifts: totalShifts || 0,
      monthly_attendance_rate: Math.min(100, monthlyRate),
    }

    return res.status(200).json({ stats, records })
  }

  // ─── MONTHLY REPORT ──────────────────────────────────────────────────────
  const m = parseInt(month) || (new Date().getMonth() + 1)
  const y = parseInt(year) || new Date().getFullYear()
  const startDate = format(startOfMonth(new Date(y, m - 1)), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(new Date(y, m - 1)), 'yyyy-MM-dd')

  let query = db
    .from('attendances')
    .select(`
      id, date, check_in, check_out, status, check_in_note, check_out_note,
      check_in_lat, check_in_lng,
      employees!inner(id, name, employee_code, branch_id, shift_id, branches(name), shifts(name))
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (employee_id) query = query.eq('employee_id', employee_id)
  if (branch_id) query = query.eq('employees.branch_id', branch_id)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const records = (data || []).map(r => ({
    id: r.id, date: r.date, check_in: r.check_in, check_out: r.check_out,
    status: r.status, check_in_note: r.check_in_note, check_out_note: r.check_out_note,
    check_in_lat: r.check_in_lat, check_in_lng: r.check_in_lng,
    face_verified: r.face_verified || false,
    employee_name: r.employees?.name,
    employee_code: r.employees?.employee_code,
    branch_name: r.employees?.branches?.name,
    shift_name: r.employees?.shifts?.name,
  }))

  const summary = {
    total: records.length,
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
    leave: records.filter(r => r.status === 'leave').length,
  }

  return res.status(200).json({ records, summary })
}

function getWorkDaysPassed() {
  const now = new Date()
  const start = startOfMonth(now)
  let count = 0
  const cur = new Date(start)
  while (cur <= now) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export default requireAuth(handler, { adminOnly: true })
