// pages/api/admin/payroll/index.js
// GET  → list semua payroll records (per bulan)
// POST → hitung & simpan payroll bulan tertentu

import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'
import { format, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns'

// ─── Konstanta BPJS & PPh21 ────────────────────────────────────────────────
const BPJS = {
  kes_perusahaan:  0.04,   // 4% ditanggung perusahaan
  kes_karyawan:    0.01,   // 1% dipotong dari karyawan
  tk_jht_perusahaan: 0.037, // 3.7% JHT perusahaan
  tk_jht_karyawan:   0.02,  // 2% JHT karyawan
  tk_jp_perusahaan:  0.02,  // 2% JP perusahaan
  tk_jp_karyawan:    0.01,  // 1% JP karyawan
  tk_jkk:   0.0024, // 0.24% JKK (perusahaan)
  tk_jkm:   0.003,  // 0.3%  JKM (perusahaan)
}

// Tarif PPh 21 2024 (TER/Tarif Efektif Rata-rata disederhanakan → progressive)
const PTKP_TK0  = 54_000_000  // PTKP TK/0 per tahun
const PPH21_BRACKETS = [
  { max: 60_000_000,   rate: 0.05 },
  { max: 250_000_000,  rate: 0.15 },
  { max: 500_000_000,  rate: 0.25 },
  { max: 5_000_000_000, rate: 0.30 },
]

function hitungPPh21Bulanan(penghasilanBrutoSetahun) {
  const pkp = Math.max(0, penghasilanBrutoSetahun - PTKP_TK0)
  let pajak = 0
  let sisa = pkp
  let prevMax = 0
  for (const { max, rate } of PPH21_BRACKETS) {
    if (sisa <= 0) break
    const kena = Math.min(sisa, max - prevMax)
    pajak += kena * rate
    sisa -= kena
    prevMax = max
  }
  return Math.round(pajak / 12)
}

// ─── Hitung potongan kehadiran ─────────────────────────────────────────────
function hitungPotonganKehadiran(gajiPokok, absenTanpaIzin, terlambatMenit, hariKerjaBulan) {
  const gajiPerHari = gajiPokok / hariKerjaBulan
  const gajiPerJam  = gajiPerHari / 8

  const potonganAbsen     = Math.round(absenTanpaIzin * gajiPerHari)
  // Keterlambatan: potong per 30 menit (1/16 gaji harian per 30 menit)
  const potonganTerlambat = Math.round((terlambatMenit / 30) * (gajiPerHari / 16))

  return { potonganAbsen, potonganTerlambat }
}

// ─── Hitung lembur ─────────────────────────────────────────────────────────
function hitungLembur(gajiPokok, totalMenitLembur) {
  // Upah lembur: 1/173 * gaji pokok per jam pertama, x2 jam berikutnya (UU 13/2003)
  const upahPerJam = gajiPokok / 173
  const jamLembur  = totalMenitLembur / 60

  let upahLembur = 0
  if (jamLembur <= 1) {
    upahLembur = jamLembur * 1.5 * upahPerJam
  } else {
    upahLembur = 1.5 * upahPerJam + (jamLembur - 1) * 2 * upahPerJam
  }
  return Math.round(upahLembur)
}

async function handler(req, res) {
  const db = supabaseAdmin()

  // ── GET: list payroll ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { month, year, employee_id, branch_id } = req.query
    let query = db
      .from('payrolls')
      .select(`
        *,
        employees!payrolls_employee_id_fkey(name, employee_code, department, position, branch_id, branches(name))
      `)
      .order('created_at', { ascending: false })

    if (month && year) {
      query = query.eq('month', parseInt(month)).eq('year', parseInt(year))
    }
    if (employee_id) query = query.eq('employee_id', employee_id)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    const records = (data || []).map(p => ({
      ...p,
      employee_name:   p.employees?.name,
      employee_code:   p.employees?.employee_code,
      department:      p.employees?.department,
      position:        p.employees?.position,
      branch_name:     p.employees?.branches?.name,
    }))

    // Filter branch di JS karena nested join
    const filtered = branch_id
      ? records.filter(p => p.employees?.branch_id === branch_id)
      : records

    return res.status(200).json({ payrolls: filtered })
  }

  // ── POST: hitung & simpan payroll ────────────────────────────────────────
  if (req.method === 'POST') {
    const { month, year, employee_ids, recalculate = false } = req.body

    if (!month || !year) {
      return res.status(400).json({ error: 'month dan year wajib diisi' })
    }

    const m = parseInt(month)
    const y = parseInt(year)
    const startDate = format(startOfMonth(new Date(y, m - 1)), 'yyyy-MM-dd')
    const endDate   = format(endOfMonth(new Date(y, m - 1)),   'yyyy-MM-dd')
    const hariKerjaBulan = getWorkDays(new Date(y, m - 1))

    // Ambil karyawan yang akan dihitung
    let empQuery = db
      .from('employees')
      .select(`id, name, employee_code, department, position, branch_id,
               salary_basic, allowance_transport, allowance_meal, allowance_position,
               bpjs_enrolled, ptkp_status`)
      .eq('is_active', true)
      .eq('role', 'employee')

    if (employee_ids?.length) empQuery = empQuery.in('id', employee_ids)
    const { data: employees, error: empErr } = await empQuery
    if (empErr) return res.status(500).json({ error: empErr.message })
    if (!employees?.length) return res.status(400).json({ error: 'Tidak ada karyawan aktif ditemukan' })

    // Ambil data absensi bulan ini
    const empIds = employees.map(e => e.id)
    const { data: attendances } = await db
      .from('attendances')
      .select('employee_id, status, check_in, check_out, overtime_minutes, overtime_approved')
      .gte('date', startDate)
      .lte('date', endDate)
      .in('employee_id', empIds)

    const { data: requests } = await db
      .from('requests')
      .select('employee_id, type, start_date, end_date, status')
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .eq('status', 'approved')
      .in('employee_id', empIds)
      .in('type', ['izin', 'cuti', 'sakit'])

    const results = []
    const errors  = []

    for (const emp of employees) {
      try {
        const attEmp = (attendances || []).filter(a => a.employee_id === emp.id)
        const reqEmp = (requests    || []).filter(r => r.employee_id === emp.id)

        // Hitung hari kerja per status
        const hadir          = attEmp.filter(a => a.status === 'present').length
        const terlambat      = attEmp.filter(a => a.status === 'late').length
        const absenTotal     = hariKerjaBulan - hadir - terlambat - reqEmp.length
        const absenTanpaIzin = Math.max(0, absenTotal)
        const izinDisetujui  = reqEmp.length

        // Total menit terlambat
        const terlambatMenit = attEmp
          .filter(a => a.status === 'late' && a.check_in)
          .reduce((sum, a) => {
            // Hitung keterlambatan dari jam mulai shift (default 08:00)
            const ci = new Date(a.check_in)
            const jam = ci.getHours() * 60 + ci.getMinutes()
            const shiftStart = 8 * 60 + 15 // 08:15 (dengan toleransi)
            return sum + Math.max(0, jam - shiftStart)
          }, 0)

        // Total lembur (hanya yang approved)
        const totalMenitLembur = attEmp
          .filter(a => a.overtime_approved && a.overtime_minutes > 0)
          .reduce((sum, a) => sum + (a.overtime_minutes || 0), 0)

        // Komponen gaji
        const gajiPokok         = emp.salary_basic || 0
        const tunjanganTransport = emp.allowance_transport || 0
        const tunjanganMakan    = emp.allowance_meal || 0
        const tunjanganJabatan  = emp.allowance_position || 0
        const upahLembur        = hitungLembur(gajiPokok, totalMenitLembur)

        const { potonganAbsen, potonganTerlambat } = hitungPotonganKehadiran(
          gajiPokok, absenTanpaIzin, terlambatMenit, hariKerjaBulan
        )

        // BPJS (hanya jika enrolled)
        let potonganBpjsKes    = 0
        let potonganBpjsJht    = 0
        let potonganBpjsJp     = 0
        if (emp.bpjs_enrolled !== false) {
          const baseBpjs = Math.min(gajiPokok, 12_000_000) // cap BPJS Kes
          potonganBpjsKes = Math.round(baseBpjs * BPJS.kes_karyawan)
          potonganBpjsJht = Math.round(gajiPokok * BPJS.tk_jht_karyawan)
          potonganBpjsJp  = Math.round(Math.min(gajiPokok, 9_559_600) * BPJS.tk_jp_karyawan)
        }

        const penghasilanBruto = gajiPokok + tunjanganTransport + tunjanganMakan + tunjanganJabatan + upahLembur
        const totalPotongan    = potonganAbsen + potonganTerlambat + potonganBpjsKes + potonganBpjsJht + potonganBpjsJp

        // PPh 21 dari penghasilan bruto setahun dikurang BPJS
        const brutoSetahun = (penghasilanBruto - potonganBpjsKes - potonganBpjsJht - potonganBpjsJp) * 12
        const pph21 = hitungPPh21Bulanan(brutoSetahun)

        const totalGajiBersih = Math.max(0, penghasilanBruto - totalPotongan - pph21)

        const payload = {
          employee_id:          emp.id,
          month: m, year: y,
          period_start:         startDate,
          period_end:           endDate,
          work_days:            hariKerjaBulan,
          days_present:         hadir,
          days_late:            terlambat,
          days_absent:          absenTanpaIzin,
          days_leave:           izinDisetujui,
          late_minutes:         terlambatMenit,
          overtime_minutes:     totalMenitLembur,
          salary_basic:         gajiPokok,
          allowance_transport:  tunjanganTransport,
          allowance_meal:       tunjanganMakan,
          allowance_position:   tunjanganJabatan,
          overtime_pay:         upahLembur,
          gross_salary:         penghasilanBruto,
          deduction_absent:     potonganAbsen,
          deduction_late:       potonganTerlambat,
          deduction_bpjs_kes:   potonganBpjsKes,
          deduction_bpjs_jht:   potonganBpjsJht,
          deduction_bpjs_jp:    potonganBpjsJp,
          total_deductions:     totalPotongan + pph21,
          pph21:                pph21,
          net_salary:           totalGajiBersih,
          status:               'draft',
          calculated_by:        req.user.id,
          calculated_at:        new Date().toISOString(),
        }

        // Upsert (recalculate if exists)
        const { data: existing } = await db.from('payrolls')
          .select('id, status').eq('employee_id', emp.id).eq('month', m).eq('year', y).single()

        if (existing && existing.status === 'paid' && !recalculate) {
          errors.push({ employee: emp.name, message: 'Sudah dibayar, skip (gunakan recalculate=true untuk override)' })
          continue
        }

        if (existing) {
          await db.from('payrolls').update(payload).eq('id', existing.id)
        } else {
          await db.from('payrolls').insert(payload)
        }

        results.push({ employee: emp.name, net_salary: totalGajiBersih })
      } catch (e) {
        errors.push({ employee: emp.name, message: e.message })
      }
    }

    return res.status(200).json({
      message: `Payroll dihitung: ${results.length} karyawan berhasil, ${errors.length} gagal`,
      success: results.length,
      errors,
      results,
    })
  }

  return res.status(405).end()
}

function getWorkDays(monthDate) {
  const start = startOfMonth(monthDate)
  const end   = endOfMonth(monthDate)
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export default requireAuth(handler, { adminOnly: true })
