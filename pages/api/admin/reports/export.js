import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import * as XLSX from 'xlsx'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const db = supabaseAdmin()
  const { format: fmt, month, year, branch_id, employee_id, status } = req.query

  const m = parseInt(month) || (new Date().getMonth() + 1)
  const y = parseInt(year) || new Date().getFullYear()
  const startDate = format(startOfMonth(new Date(y, m - 1)), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(new Date(y, m - 1)), 'yyyy-MM-dd')

  const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

  let query = db
    .from('attendances')
    .select(`
      id, date, check_in, check_out, status, check_in_note, check_out_note,
      employees!inner(id, name, employee_code, department, position, branch_id, shift_id,
        branches(name), shifts(name, start_time, end_time))
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (employee_id) query = query.eq('employee_id', employee_id)
  if (branch_id) query = query.eq('employees.branch_id', branch_id)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'
  const calcHours = (ci, co) => {
    if (!ci || !co) return '-'
    const mins = Math.floor((new Date(co) - new Date(ci)) / 60000)
    return `${Math.floor(mins / 60)} jam ${mins % 60} menit`
  }
  const statusLabel = (s) => ({ present: 'Hadir', late: 'Terlambat', absent: 'Absen', leave: 'Izin/Cuti', half_day: 'Setengah Hari' }[s] || s)

  const rows = (data || []).map(r => ({
    'Tanggal': fmtDate(r.date),
    'ID Karyawan': r.employees?.employee_code || '-',
    'Nama Karyawan': r.employees?.name || '-',
    'Departemen': r.employees?.department || '-',
    'Jabatan': r.employees?.position || '-',
    'Cabang': r.employees?.branches?.name || '-',
    'Shift': r.employees?.shifts?.name || '-',
    'Jam Masuk Shift': r.employees?.shifts?.start_time || '-',
    'Jam Keluar Shift': r.employees?.shifts?.end_time || '-',
    'Jam Check-In': fmtTime(r.check_in),
    'Jam Check-Out': fmtTime(r.check_out),
    'Total Jam Kerja': calcHours(r.check_in, r.check_out),
    'Status': statusLabel(r.status),
    'Verifikasi Wajah': r.face_verified ? 'Ya' : 'Tidak',
    'Catatan Check-In': r.check_in_note || '',
    'Catatan Check-Out': r.check_out_note || '',
  }))

  const title = `Laporan Absensi - ${MONTHS_ID[m - 1]} ${y}`

  if (fmt === 'csv') {
    const headers = Object.keys(rows[0] || {}).join(',')
    const csvRows = rows.map(row =>
      Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    )
    const csv = [title, '', headers, ...csvRows].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="absensi-${m}-${y}.csv"`)
    return res.send('\ufeff' + csv) // BOM for Excel compatibility
  }

  // Excel
  const wb = XLSX.utils.book_new()

  // Title row styling
  const titleRow = [[title]]
  const infoRows = [
    [`Periode: ${MONTHS_ID[m - 1]} ${y}`],
    [`Digenerate: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`],
    [`Total Record: ${rows.length}`],
    [],
  ]

  const ws = XLSX.utils.aoa_to_sheet([...titleRow, ...infoRows])
  XLSX.utils.sheet_add_json(ws, rows, { origin: -1, skipHeader: false })

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 18 },
    { wch: 20 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 25 }, { wch: 25 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Absensi')

  // Summary sheet
  const summaryData = [
    ['RINGKASAN'],
    [],
    ['Status', 'Jumlah'],
    ['Total Record', rows.length],
    ['Hadir', rows.filter(r => r['Status'] === 'Hadir').length],
    ['Terlambat', rows.filter(r => r['Status'] === 'Terlambat').length],
    ['Absen', rows.filter(r => r['Status'] === 'Absen').length],
    ['Izin/Cuti', rows.filter(r => r['Status'] === 'Izin/Cuti').length],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="absensi-${m}-${y}.xlsx"`)
  return res.send(buffer)
}

export default requireAuth(handler, { adminOnly: true })
