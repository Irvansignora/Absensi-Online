// pages/api/admin/payroll/slip.js
// GET /api/admin/payroll/slip?id=xxx  → download PDF slip gaji

import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// Generate PDF menggunakan html → string, dikirim sebagai response
// Menggunakan pendekatan HTML-in-PDF via built-in browser print (client side)
// Server side: kembalikan data JSON, PDF di-generate di frontend
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const db = supabaseAdmin()
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id payroll wajib' })

  const { data: p, error } = await db
    .from('payrolls')
    .select(`
      *,
      employees!payrolls_employee_id_fkey(
        name, employee_code, department, position, phone, email,
        branch_id, branches(name, address, phone)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !p) return res.status(404).json({ error: 'Payroll tidak ditemukan' })

  const emp = p.employees
  const branch = emp?.branches

  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const bulan = MONTHS[p.month - 1]
  const fmt = (n) => 'Rp ' + (n || 0).toLocaleString('id-ID')

  // Generate HTML slip
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Slip Gaji – ${emp?.name} – ${bulan} ${p.year}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }
  .page { width: 210mm; min-height: 148mm; margin: 0 auto; padding: 16mm 14mm; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px; }
  .company h1 { font-size: 16px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.5px; }
  .company p  { font-size: 9px; color: #64748b; margin-top: 2px; }
  .slip-title { text-align: right; }
  .slip-title h2 { font-size: 13px; font-weight: 700; color: #1e3a8a; }
  .slip-title .period { background: #eff6ff; color: #1e40af; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-top: 4px; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
  .info-item label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-item p    { font-size: 11px; font-weight: 600; color: #1e293b; margin-top: 1px; }

  .section-title { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; margin-top: 10px; }

  table { width: 100%; border-collapse: collapse; }
  table td { padding: 4px 6px; }
  table .label { color: #475569; width: 55%; }
  table .value { text-align: right; font-weight: 500; color: #1e293b; }
  table tr:nth-child(even) td { background: #f8fafc; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  .total-box { margin-top: 12px; background: #1e3a8a; color: #fff; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
  .total-box .label { font-size: 12px; font-weight: 600; }
  .total-box .amount { font-size: 17px; font-weight: 800; letter-spacing: -0.5px; }

  .attendance-row { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
  .att-chip { background: #f1f5f9; border-radius: 5px; padding: 4px 8px; text-align: center; min-width: 55px; }
  .att-chip .num { font-size: 14px; font-weight: 700; color: #1e3a8a; }
  .att-chip .lbl { font-size: 8px; color: #94a3b8; }
  .att-chip.red .num { color: #dc2626; }
  .att-chip.green .num { color: #16a34a; }
  .att-chip.yellow .num { color: #d97706; }

  .footer { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sign-box { text-align: center; }
  .sign-box .line { border-top: 1px solid #94a3b8; width: 100px; margin: 28px auto 4px; }
  .sign-box p { font-size: 9px; color: #64748b; }
  .note { font-size: 9px; color: #94a3b8; font-style: italic; }

  .badge-green { background: #dcfce7; color: #166534; padding: 2px 7px; border-radius: 99px; font-size: 9px; font-weight: 600; }
  .badge-yellow { background: #fef9c3; color: #854d0e; padding: 2px 7px; border-radius: 99px; font-size: 9px; font-weight: 600; }
  .badge-red { background: #fee2e2; color: #991b1b; padding: 2px 7px; border-radius: 99px; font-size: 9px; font-weight: 600; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="company">
      <h1>🏢 ${branch?.name || 'Perusahaan'}</h1>
      <p>${branch?.address || ''}</p>
      <p>${branch?.phone || ''}</p>
    </div>
    <div class="slip-title">
      <h2>SLIP GAJI KARYAWAN</h2>
      <div class="period">${bulan} ${p.year}</div>
      <div style="margin-top:4px; font-size:9px; color:#94a3b8;">
        Status: <span class="${p.status === 'paid' ? 'badge-green' : p.status === 'approved' ? 'badge-yellow' : 'badge-yellow'}">${p.status === 'paid' ? '✓ Dibayar' : p.status === 'approved' ? '✓ Disetujui' : '⏳ Draft'}</span>
      </div>
    </div>
  </div>

  <!-- Info Karyawan -->
  <div class="info-grid">
    <div class="info-item"><label>Nama Karyawan</label><p>${emp?.name || '-'}</p></div>
    <div class="info-item"><label>ID Karyawan</label><p>${emp?.employee_code || '-'}</p></div>
    <div class="info-item"><label>Departemen</label><p>${emp?.department || '-'}</p></div>
    <div class="info-item"><label>Jabatan</label><p>${emp?.position || '-'}</p></div>
    <div class="info-item"><label>Periode</label><p>${p.period_start} s/d ${p.period_end}</p></div>
    <div class="info-item"><label>Hari Kerja</label><p>${p.work_days} hari</p></div>
  </div>

  <!-- Kehadiran chips -->
  <div class="section-title">📊 Rekap Kehadiran</div>
  <div class="attendance-row">
    <div class="att-chip green"><div class="num">${p.days_present}</div><div class="lbl">Hadir</div></div>
    <div class="att-chip yellow"><div class="num">${p.days_late}</div><div class="lbl">Terlambat</div></div>
    <div class="att-chip red"><div class="num">${p.days_absent}</div><div class="lbl">Absen</div></div>
    <div class="att-chip"><div class="num">${p.days_leave}</div><div class="lbl">Izin/Cuti</div></div>
    <div class="att-chip"><div class="num">${Math.floor((p.overtime_minutes || 0) / 60)}j ${(p.overtime_minutes || 0) % 60}m</div><div class="lbl">Lembur</div></div>
    <div class="att-chip yellow"><div class="num">${p.late_minutes || 0}m</div><div class="lbl">Mnt Telat</div></div>
  </div>

  <!-- Pendapatan & Potongan -->
  <div class="two-col">
    <div>
      <div class="section-title">💰 Pendapatan</div>
      <table>
        <tr><td class="label">Gaji Pokok</td><td class="value">${fmt(p.salary_basic)}</td></tr>
        ${p.allowance_transport > 0 ? `<tr><td class="label">Tunjangan Transport</td><td class="value">${fmt(p.allowance_transport)}</td></tr>` : ''}
        ${p.allowance_meal > 0 ? `<tr><td class="label">Tunjangan Makan</td><td class="value">${fmt(p.allowance_meal)}</td></tr>` : ''}
        ${p.allowance_position > 0 ? `<tr><td class="label">Tunjangan Jabatan</td><td class="value">${fmt(p.allowance_position)}</td></tr>` : ''}
        ${p.overtime_pay > 0 ? `<tr><td class="label">Upah Lembur</td><td class="value">${fmt(p.overtime_pay)}</td></tr>` : ''}
        <tr style="border-top:1px solid #e2e8f0;">
          <td class="label" style="font-weight:700;">Total Pendapatan</td>
          <td class="value" style="font-weight:700; color:#1e3a8a;">${fmt(p.gross_salary)}</td>
        </tr>
      </table>
    </div>
    <div>
      <div class="section-title">✂️ Potongan</div>
      <table>
        ${p.deduction_absent > 0 ? `<tr><td class="label">Potongan Absen (${p.days_absent}h)</td><td class="value" style="color:#dc2626;">-${fmt(p.deduction_absent)}</td></tr>` : ''}
        ${p.deduction_late > 0 ? `<tr><td class="label">Potongan Terlambat</td><td class="value" style="color:#dc2626;">-${fmt(p.deduction_late)}</td></tr>` : ''}
        ${p.deduction_bpjs_kes > 0 ? `<tr><td class="label">BPJS Kesehatan (1%)</td><td class="value" style="color:#dc2626;">-${fmt(p.deduction_bpjs_kes)}</td></tr>` : ''}
        ${p.deduction_bpjs_jht > 0 ? `<tr><td class="label">BPJS TK – JHT (2%)</td><td class="value" style="color:#dc2626;">-${fmt(p.deduction_bpjs_jht)}</td></tr>` : ''}
        ${p.deduction_bpjs_jp > 0 ? `<tr><td class="label">BPJS TK – JP (1%)</td><td class="value" style="color:#dc2626;">-${fmt(p.deduction_bpjs_jp)}</td></tr>` : ''}
        ${p.pph21 > 0 ? `<tr><td class="label">PPh 21</td><td class="value" style="color:#dc2626;">-${fmt(p.pph21)}</td></tr>` : ''}
        <tr style="border-top:1px solid #e2e8f0;">
          <td class="label" style="font-weight:700;">Total Potongan</td>
          <td class="value" style="font-weight:700; color:#dc2626;">-${fmt(p.total_deductions)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Total Gaji Bersih -->
  <div class="total-box">
    <span class="label">💵 GAJI BERSIH DITERIMA</span>
    <span class="amount">${fmt(p.net_salary)}</span>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="note">
      Slip gaji ini digenerate otomatis oleh sistem AbsensiPro.<br>
      Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
    </div>
    <div class="sign-box">
      <div class="line"></div>
      <p>HRD / Manager</p>
    </div>
  </div>

</div>

<!-- Print button (hilang saat print) -->
<div class="no-print" style="text-align:center; padding:20px;">
  <button onclick="window.print()" style="background:#1e3a8a;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;">
    🖨️ Print / Simpan PDF
  </button>
  <button onclick="window.close()" style="background:#f1f5f9;color:#475569;border:none;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;margin-left:8px;">
    Tutup
  </button>
</div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.end(html)
}

export default requireAuth(handler, { adminOnly: true })
