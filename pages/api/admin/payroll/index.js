// pages/api/admin/payroll/index.js
// GET  → list semua payroll records (per bulan)
// POST → hitung & simpan payroll bulan tertentu (menggunakan company_settings)

import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const DEFAULT_SETTINGS = {
  work_days_per_month:          22,
  late_tolerance_minutes:       15,
  deduction_absent_type:        'daily',
  deduction_absent_percent:     0,
  deduction_late_per_30min:     true,
  deduction_late_custom_amount: 0,
  bpjs_kesehatan_employee:      1,
  bpjs_max_salary_kes:          12_000_000,
  bpjs_jht_employee:            2,
  bpjs_jp_employee:             1,
  bpjs_max_salary_jp:           9_500_000,
  ptkp_tk0:                     54_000_000,
  overtime_rate_hour1:          1.5,
  overtime_rate_hour2plus:      2,
}

const PPH21_BRACKETS = [
  { max: 60_000_000,    rate: 0.05 },
  { max: 250_000_000,   rate: 0.15 },
  { max: 500_000_000,   rate: 0.25 },
  { max: 5_000_000_000, rate: 0.30 },
]

function hitungPPh21Bulanan(penghasilanBrutoSetahun, ptkp) {
  const pkp = Math.max(0, penghasilanBrutoSetahun - ptkp)
  let pajak = 0, sisa = pkp, prevMax = 0
  for (const { max, rate } of PPH21_BRACKETS) {
    if (sisa <= 0) break
    const kena = Math.min(sisa, max - prevMax)
    pajak += kena * rate
    sisa  -= kena
    prevMax = max
  }
  return Math.round(pajak / 12)
}

function hitungPotonganKehadiran(gajiPokok, absenTanpaIzin, terlambatMenit, cfg) {
  const gajiPerHari = gajiPokok / cfg.work_days_per_month
  let potonganAbsen = 0
  if (cfg.deduction_absent_type === 'percent') {
    potonganAbsen = Math.round(gajiPokok * (cfg.deduction_absent_percent / 100) * absenTanpaIzin)
  } else {
    potonganAbsen = Math.round(absenTanpaIzin * gajiPerHari)
  }
  let potonganTerlambat = 0
  if (cfg.deduction_late_per_30min) {
    potonganTerlambat = Math.round((terlambatMenit / 30) * (gajiPerHari / 16))
  } else {
    const kaliTerlambat = terlambatMenit > 0 ? 1 : 0
    potonganTerlambat = Math.round(kaliTerlambat * (cfg.deduction_late_custom_amount || 0))
  }
  return { potonganAbsen, potonganTerlambat }
}

function hitungLembur(gajiPokok, totalMenitLembur, cfg) {
  const upahPerJam = gajiPokok / 173
  const jamLembur  = totalMenitLembur / 60
  const rate1      = cfg.overtime_rate_hour1    || 1.5
  const rate2plus  = cfg.overtime_rate_hour2plus || 2
  let upahLembur = 0
  if (jamLembur <= 1) {
    upahLembur = jamLembur * rate1 * upahPerJam
  } else {
    upahLembur = rate1 * upahPerJam + (jamLembur - 1) * rate2plus * upahPerJam
  }
  return Math.round(upahLembur)
}

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { month, year, employee_id, branch_id } = req.query
    let query = db
      .from('payrolls')
      .select(`*, employees!payrolls_employee_id_fkey(name, employee_code, department, position, branch_id, branches(name))`)
      .order('created_at', { ascending: false })
    if (month && year) query = query.eq('month', parseInt(month)).eq('year', parseInt(year))
    if (employee_id) query = query.eq('employee_id', employee_id)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    const records = (data || []).map(p => ({
      ...p,
      employee_name: p.employees?.name,
      employee_code: p.employees?.employee_code,
      department:    p.employees?.department,
      position:      p.employees?.position,
      branch_name:   p.employees?.branches?.name,
    }))
    const filtered = branch_id ? records.filter(p => p.employees?.branch_id === branch_id) : records
    return res.status(200).json({ payrolls: filtered })
  }

  if (req.method === 'POST') {
    const { month, year, employee_ids, recalculate = false } = req.body
    if (!month || !year) return res.status(400).json({ error: 'month dan year wajib diisi' })

    // Ambil company settings
    const { data: settingsData } = await db.from('company_settings').select('*').limit(1).single()
    const cfg = { ...DEFAULT_SETTINGS, ...(settingsData || {}) }

    const m = parseInt(month), y = parseInt(year)
    const startDate      = format(startOfMonth(new Date(y, m - 1)), 'yyyy-MM-dd')
    const endDate        = format(endOfMonth(new Date(y, m - 1)),   'yyyy-MM-dd')
    const hariKerjaBulan = cfg.work_days_per_month

    let empQuery = db
      .from('employees')
      .select(`id, name, employee_code, department, position, branch_id, salary_basic, allowance_transport, allowance_meal, allowance_position, bpjs_enrolled, ptkp_status`)
      .eq('is_active', true).eq('role', 'employee')
    if (employee_ids?.length) empQuery = empQuery.in('id', employee_ids)
    const { data: employees, error: empErr } = await empQuery
    if (empErr) return res.status(500).json({ error: empErr.message })
    if (!employees?.length) return res.status(400).json({ error: 'Tidak ada karyawan aktif ditemukan' })

    const empIds = employees.map(e => e.id)
    const { data: attendances } = await db.from('attendances')
      .select('employee_id, status, check_in, check_out, overtime_minutes, overtime_approved')
      .gte('date', startDate).lte('date', endDate).in('employee_id', empIds)
    const { data: requests } = await db.from('requests')
      .select('employee_id, type, start_date, end_date, status')
      .gte('start_date', startDate).lte('start_date', endDate)
      .eq('status', 'approved').in('employee_id', empIds).in('type', ['izin', 'cuti', 'sakit'])

    const results = [], errors = []

    for (const emp of employees) {
      try {
        const attEmp = (attendances || []).filter(a => a.employee_id === emp.id)
        const reqEmp = (requests    || []).filter(r => r.employee_id === emp.id)

        const hadir         = attEmp.filter(a => a.status === 'present').length
        const terlambat     = attEmp.filter(a => a.status === 'late').length
        const izinDisetujui = reqEmp.length
        const absenTanpaIzin = Math.max(0, hariKerjaBulan - hadir - terlambat - izinDisetujui)

        const toleransiMenit = cfg.late_tolerance_minutes || 0
        const terlambatMenit = attEmp
          .filter(a => a.status === 'late' && a.check_in)
          .reduce((sum, a) => {
            const ci = new Date(a.check_in)
            const jam = ci.getHours() * 60 + ci.getMinutes()
            const shiftStart = 8 * 60 + toleransiMenit
            return sum + Math.max(0, jam - shiftStart)
          }, 0)

        const totalMenitLembur = attEmp
          .filter(a => a.overtime_approved && a.overtime_minutes > 0)
          .reduce((sum, a) => sum + (a.overtime_minutes || 0), 0)

        const gajiPokok         = emp.salary_basic        || 0
        const tunjanganTransport = emp.allowance_transport || 0
        const tunjanganMakan    = emp.allowance_meal       || 0
        const tunjanganJabatan  = emp.allowance_position   || 0
        const upahLembur        = hitungLembur(gajiPokok, totalMenitLembur, cfg)

        const { potonganAbsen, potonganTerlambat } = hitungPotonganKehadiran(gajiPokok, absenTanpaIzin, terlambatMenit, cfg)

        let potonganBpjsKes = 0, potonganBpjsJht = 0, potonganBpjsJp = 0
        if (emp.bpjs_enrolled !== false) {
          const baseBpjsKes = Math.min(gajiPokok, cfg.bpjs_max_salary_kes)
          const baseBpjsJp  = Math.min(gajiPokok, cfg.bpjs_max_salary_jp)
          potonganBpjsKes = Math.round(baseBpjsKes * (cfg.bpjs_kesehatan_employee / 100))
          potonganBpjsJht = Math.round(gajiPokok   * (cfg.bpjs_jht_employee / 100))
          potonganBpjsJp  = Math.round(baseBpjsJp  * (cfg.bpjs_jp_employee  / 100))
        }

        const penghasilanBruto = gajiPokok + tunjanganTransport + tunjanganMakan + tunjanganJabatan + upahLembur
        const totalPotonganNonPajak = potonganAbsen + potonganTerlambat + potonganBpjsKes + potonganBpjsJht + potonganBpjsJp
        const brutoSetahun = (penghasilanBruto - potonganBpjsKes - potonganBpjsJht - potonganBpjsJp) * 12
        const pph21 = hitungPPh21Bulanan(brutoSetahun, cfg.ptkp_tk0)
        const totalPotongan = totalPotonganNonPajak + pph21
        const totalGajiBersih = Math.max(0, penghasilanBruto - totalPotongan)

        const payload = {
          employee_id: emp.id, month: m, year: y,
          period_start: startDate, period_end: endDate,
          work_days: hariKerjaBulan,
          days_present: hadir, days_late: terlambat, days_absent: absenTanpaIzin,
          days_leave: izinDisetujui, late_minutes: terlambatMenit, overtime_minutes: totalMenitLembur,
          salary_basic: gajiPokok, allowance_transport: tunjanganTransport,
          allowance_meal: tunjanganMakan, allowance_position: tunjanganJabatan,
          overtime_pay: upahLembur, gross_salary: penghasilanBruto,
          deduction_absent: potonganAbsen, deduction_late: potonganTerlambat,
          deduction_bpjs_kes: potonganBpjsKes, deduction_bpjs_jht: potonganBpjsJht,
          deduction_bpjs_jp: potonganBpjsJp, total_deductions: totalPotongan,
          pph21, net_salary: totalGajiBersih, status: 'draft',
          calculated_by: req.user?.id, calculated_at: new Date().toISOString(),
        }

        const { data: existing } = await db.from('payrolls')
          .select('id, status').eq('employee_id', emp.id).eq('month', m).eq('year', y).single()

        if (existing && existing.status === 'paid' && !recalculate) {
          errors.push({ employee: emp.name, message: 'Sudah dibayar, skip' }); continue
        }
        if (existing) { await db.from('payrolls').update(payload).eq('id', existing.id) }
        else { await db.from('payrolls').insert(payload) }
        results.push({ employee: emp.name, net_salary: totalGajiBersih })
      } catch (e) {
        errors.push({ employee: emp.name, message: e.message })
      }
    }

    return res.status(200).json({
      message: `Payroll dihitung: ${results.length} karyawan berhasil, ${errors.length} gagal`,
      success: results.length, errors, results,
    })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
