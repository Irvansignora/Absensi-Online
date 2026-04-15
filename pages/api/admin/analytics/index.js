// pages/api/admin/analytics/index.js
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const db = supabaseAdmin()
  const now = new Date()
  const year  = parseInt(req.query.year  || now.getFullYear())
  const month = parseInt(req.query.month || now.getMonth() + 1)

  const startOfMonth = `${year}-${String(month).padStart(2,'0')}-01`
  const endOfMonth   = new Date(year, month, 0).toISOString().split('T')[0]
  const today        = now.toISOString().split('T')[0]

  // ── 1. Trend kehadiran 30 hari terakhir ────────────────────────────────────
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString().split('T')[0]
  const { data: trendData } = await db
    .from('attendances')
    .select('date, status')
    .gte('date', thirtyDaysAgo)
    .lte('date', today)
    .order('date')

  // Group by date
  const trendMap = {}
  for (const row of trendData || []) {
    if (!trendMap[row.date]) trendMap[row.date] = { date: row.date, present: 0, late: 0, absent: 0, leave: 0 }
    if (row.status === 'present' || row.status === 'half_day') trendMap[row.date].present++
    else if (row.status === 'late')   trendMap[row.date].late++
    else if (row.status === 'absent') trendMap[row.date].absent++
    else if (row.status === 'leave')  trendMap[row.date].leave++
  }
  const trend30 = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date))

  // ── 2. Top 10 paling sering terlambat bulan ini ────────────────────────────
  const { data: lateData } = await db
    .from('attendances')
    .select('employee_id, employees!attendances_employee_id_fkey(name, department)')
    .eq('status', 'late')
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  const lateMap = {}
  for (const row of lateData || []) {
    const id = row.employee_id
    if (!lateMap[id]) lateMap[id] = { id, name: row.employees?.name, department: row.employees?.department, count: 0 }
    lateMap[id].count++
  }
  const topLate = Object.values(lateMap).sort((a, b) => b.count - a.count).slice(0, 10)

  // ── 3. Kehadiran per department bulan ini ─────────────────────────────────
  const { data: deptData } = await db
    .from('attendances')
    .select('status, employees!attendances_employee_id_fkey(department)')
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  const deptMap = {}
  for (const row of deptData || []) {
    const dept = row.employees?.department || 'Lainnya'
    if (!deptMap[dept]) deptMap[dept] = { department: dept, present: 0, late: 0, absent: 0, total: 0 }
    deptMap[dept].total++
    if (['present','half_day'].includes(row.status)) deptMap[dept].present++
    else if (row.status === 'late')                   deptMap[dept].late++
    else if (row.status === 'absent')                 deptMap[dept].absent++
  }
  const byDepartment = Object.values(deptMap).map(d => ({
    ...d,
    rate: d.total > 0 ? Math.round((d.present + d.late) / d.total * 100) : 0,
  })).sort((a, b) => b.rate - a.rate)

  // ── 4. Kehadiran per cabang bulan ini ─────────────────────────────────────
  const { data: branchData } = await db
    .from('attendances')
    .select('status, branches!attendances_branch_id_fkey(name)')
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  const branchMap = {}
  for (const row of branchData || []) {
    const b = row.branches?.name || 'Lainnya'
    if (!branchMap[b]) branchMap[b] = { branch: b, present: 0, late: 0, absent: 0, total: 0 }
    branchMap[b].total++
    if (['present','half_day'].includes(row.status)) branchMap[b].present++
    else if (row.status === 'late')                   branchMap[b].late++
    else if (row.status === 'absent')                 branchMap[b].absent++
  }
  const byBranch = Object.values(branchMap).map(b => ({
    ...b,
    rate: b.total > 0 ? Math.round((b.present + b.late) / b.total * 100) : 0,
  }))

  // ── 5. Karyawan absen 3+ hari berturut-turut (alert) ─────────────────────
  const { data: absentData } = await db
    .from('attendances')
    .select('employee_id, date, employees!attendances_employee_id_fkey(name, department, phone)')
    .eq('status', 'absent')
    .gte('date', thirtyDaysAgo)
    .order('date')

  // Simple streak detection
  const absentByEmp = {}
  for (const row of absentData || []) {
    if (!absentByEmp[row.employee_id]) absentByEmp[row.employee_id] = { ...row.employees, dates: [] }
    absentByEmp[row.employee_id].dates.push(row.date)
  }
  const streakAlerts = []
  for (const [empId, emp] of Object.entries(absentByEmp)) {
    const dates = emp.dates.sort()
    let streak = 1, maxStreak = 1
    for (let i = 1; i < dates.length; i++) {
      const diff = (new Date(dates[i]) - new Date(dates[i-1])) / 86400000
      if (diff === 1) { streak++; maxStreak = Math.max(maxStreak, streak) }
      else streak = 1
    }
    if (maxStreak >= 3) streakAlerts.push({ employee_id: empId, name: emp.name, department: emp.department, streak: maxStreak })
  }

  return res.status(200).json({
    trend30,
    topLate,
    byDepartment,
    byBranch,
    streakAlerts,
    period: { year, month, startOfMonth, endOfMonth },
  })
}

export default requireAuth(handler, { adminOnly: true })
