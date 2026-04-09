// pages/admin/payroll.js
import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect } from 'react'

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const STATUS_CFG = {
  draft:    { label: 'Draft',     cls: 'badge-gray',   icon: '📝' },
  approved: { label: 'Disetujui', cls: 'badge-blue',   icon: '✅' },
  paid:     { label: 'Dibayar',   cls: 'badge-green',  icon: '💰' },
}

function fmt(n) {
  return 'Rp ' + (n || 0).toLocaleString('id-ID')
}

export default function PayrollPage() {
  const now = new Date()
  const [month, setMonth]         = useState(now.getMonth() + 1)
  const [year, setYear]           = useState(now.getFullYear())
  const [payrolls, setPayrolls]   = useState([])
  const [employees, setEmployees] = useState([])
  const [branches, setBranches]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [calculating, setCalc]    = useState(false)
  const [filterBranch, setFilterBranch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selected, setSelected]   = useState(new Set())
  const [msg, setMsg]             = useState({ type: '', text: '' })
  const [detailModal, setDetailModal] = useState(null)

  useEffect(() => {
    fetch('/api/admin/branches').then(r => r.json()).then(d => setBranches(d.branches || []))
    fetch('/api/admin/employees').then(r => r.json()).then(d => setEmployees(d.employees || []))
  }, [])

  useEffect(() => { fetchPayrolls() }, [month, year, filterBranch, filterStatus])

  async function fetchPayrolls() {
    setLoading(true)
    const params = new URLSearchParams({ month, year })
    if (filterBranch) params.set('branch_id', filterBranch)
    if (filterStatus) params.set('status', filterStatus)
    const r = await fetch(`/api/admin/payroll?${params}`)
    const d = await r.json()
    setPayrolls(d.payrolls || [])
    setSelected(new Set())
    setLoading(false)
  }

  async function handleCalculate() {
    if (!confirm(`Hitung payroll untuk ${MONTHS[month-1]} ${year}?\n\nSemua karyawan aktif akan dihitung ulang.`)) return
    setCalc(true)
    setMsg({ type: '', text: '' })
    const res = await fetch('/api/admin/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, year }),
    })
    const d = await res.json()
    setCalc(false)
    if (!res.ok) { setMsg({ type: 'error', text: d.error }); return }
    setMsg({ type: 'success', text: `✅ ${d.message}` })
    fetchPayrolls()
  }

  async function handleStatusChange(id, status) {
    const labels = { approved: 'setujui', paid: 'tandai sudah dibayar' }
    if (!confirm(`${labels[status] || 'ubah status'} payroll ini?`)) return
    const res = await fetch(`/api/admin/payroll/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) fetchPayrolls()
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return
    if (!confirm(`Setujui ${selected.size} payroll sekaligus?`)) return
    for (const id of selected) {
      await fetch(`/api/admin/payroll/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
    }
    fetchPayrolls()
  }

  async function handleBulkPay() {
    if (selected.size === 0) return
    if (!confirm(`Tandai ${selected.size} payroll sebagai SUDAH DIBAYAR?`)) return
    for (const id of selected) {
      await fetch(`/api/admin/payroll/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })
    }
    fetchPayrolls()
  }

  function openSlip(id) {
    window.open(`/api/admin/payroll/slip?id=${id}`, '_blank', 'width=900,height=700')
  }

  function toggleSelect(id) {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => p.id)))
  }

  const filtered = payrolls.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false
    if (filterBranch && p.employees?.branch_id !== filterBranch) return false
    return true
  })

  const summary = {
    total:    filtered.length,
    draft:    filtered.filter(p => p.status === 'draft').length,
    approved: filtered.filter(p => p.status === 'approved').length,
    paid:     filtered.filter(p => p.status === 'paid').length,
    totalGaji: filtered.reduce((s, p) => s + (p.net_salary || 0), 0),
  }

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i)

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">Penggajian (Payroll)</h1>

        {/* Filter bar */}
        <div className="card">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="label">Bulan</label>
                <select className="input w-36" value={month} onChange={e => setMonth(+e.target.value)}>
                  {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tahun</label>
                <select className="input w-24" value={year} onChange={e => setYear(+e.target.value)}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Cabang</label>
                <select className="input w-40" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                  <option value="">Semua Cabang</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">Semua Status</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Disetujui</option>
                  <option value="paid">Dibayar</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="btn-primary"
            >
              {calculating ? <><div className="spinner" />Menghitung...</> : '🔄 Hitung Payroll'}
            </button>
          </div>
        </div>

        {/* Alert */}
        {msg.text && (
          <div className={`p-3 rounded-xl text-sm font-medium ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {msg.text}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Karyawan', val: summary.total,             color: 'bg-slate-50',   text: 'text-slate-700' },
            { label: '📝 Draft',      val: summary.draft,             color: 'bg-slate-50',   text: 'text-slate-700' },
            { label: '✅ Disetujui',  val: summary.approved,          color: 'bg-blue-50',    text: 'text-blue-700'  },
            { label: '💰 Dibayar',   val: summary.paid,              color: 'bg-green-50',   text: 'text-green-700' },
            { label: '💵 Total Gaji Bersih', val: fmt(summary.totalGaji), color: 'bg-indigo-50', text: 'text-indigo-700', wide: true },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-4 text-center ${s.wide ? 'md:col-span-1 col-span-2' : ''}`}>
              <div className={`text-xl font-bold font-display ${s.text}`}>{s.val}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-blue-700 text-sm font-medium">{selected.size} dipilih</span>
            <button onClick={handleBulkApprove} className="btn-secondary text-xs">✅ Setujui Semua</button>
            <button onClick={handleBulkPay}     className="btn-success text-xs">💰 Tandai Dibayar</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:text-slate-600 ml-auto">Batal pilih</button>
          </div>
        )}

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><div className="spinner spinner-blue" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">💼</div>
              <p className="text-slate-500 font-medium">Belum ada data payroll</p>
              <p className="text-slate-400 text-sm mt-1">Klik "Hitung Payroll" untuk generate data bulan ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} className="rounded" />
                    </th>
                    <th>Karyawan</th>
                    <th>Gaji Pokok</th>
                    <th>Tunjangan</th>
                    <th>Lembur</th>
                    <th>Potongan</th>
                    <th>PPh21 + BPJS</th>
                    <th className="text-blue-700">Gaji Bersih</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const sc = STATUS_CFG[p.status] || STATUS_CFG.draft
                    const tunjangan = (p.allowance_transport||0)+(p.allowance_meal||0)+(p.allowance_position||0)
                    const bpjsTotal = (p.deduction_bpjs_kes||0)+(p.deduction_bpjs_jht||0)+(p.deduction_bpjs_jp||0)
                    return (
                      <tr key={p.id}>
                        <td>
                          <input type="checkbox" checked={selected.has(p.id)}
                            onChange={() => toggleSelect(p.id)} className="rounded" />
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                              {p.employee_name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{p.employee_name}</p>
                              <p className="text-xs text-slate-400">{p.department} · {p.branch_name}</p>
                            </div>
                          </div>
                        </td>
                        <td><span className="font-mono text-sm">{fmt(p.salary_basic)}</span></td>
                        <td>
                          <span className="font-mono text-sm text-green-600">{fmt(tunjangan)}</span>
                          <p className="text-xs text-slate-400">transport+makan+jabatan</p>
                        </td>
                        <td>
                          {p.overtime_pay > 0
                            ? <span className="font-mono text-sm text-purple-600">+{fmt(p.overtime_pay)}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td>
                          <span className="font-mono text-sm text-red-500">-{fmt((p.deduction_absent||0)+(p.deduction_late||0))}</span>
                          {(p.days_absent > 0 || p.days_late > 0) && (
                            <p className="text-xs text-slate-400">{p.days_absent}h absen · {p.days_late}h telat</p>
                          )}
                        </td>
                        <td>
                          <span className="font-mono text-sm text-orange-500">-{fmt((p.pph21||0)+bpjsTotal)}</span>
                          <p className="text-xs text-slate-400">PPh21+BPJS</p>
                        </td>
                        <td>
                          <span className="font-bold text-blue-700 font-mono">{fmt(p.net_salary)}</span>
                        </td>
                        <td><span className={sc.cls}>{sc.icon} {sc.label}</span></td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            <button
                              onClick={() => openSlip(p.id)}
                              className="btn-secondary px-2 py-1 text-xs"
                              title="Download Slip PDF"
                            >📄 Slip</button>
                            {p.status === 'draft' && (
                              <button
                                onClick={() => handleStatusChange(p.id, 'approved')}
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg text-xs font-medium transition-all"
                              >✅ Setujui</button>
                            )}
                            {p.status === 'approved' && (
                              <button
                                onClick={() => handleStatusChange(p.id, 'paid')}
                                className="bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded-lg text-xs font-medium transition-all"
                              >💰 Bayar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Catatan formula */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">📋 Keterangan Perhitungan:</p>
          <p>• <strong>Potongan Absen</strong> = (Gaji Pokok ÷ Hari Kerja) × Hari Absen Tanpa Izin</p>
          <p>• <strong>Potongan Telat</strong> = (Gaji Pokok ÷ Hari Kerja ÷ 16) per 30 menit keterlambatan</p>
          <p>• <strong>Lembur</strong> = 1.5× upah/jam untuk jam pertama, 2× untuk jam berikutnya (UU 13/2003)</p>
          <p>• <strong>BPJS Kes</strong> = 1% dari gaji (maks Rp 12 juta) · <strong>JHT</strong> = 2% · <strong>JP</strong> = 1% (maks Rp 9,5 juta)</p>
          <p>• <strong>PPh 21</strong> = Progressive 5%-30% dari PKP tahunan (PTKP TK/0 = Rp 54 juta)</p>
          <p>• Pastikan kolom <strong>salary_basic, allowance_transport, allowance_meal, allowance_position</strong> sudah diisi di data karyawan</p>
        </div>
    </div>
  )
}

PayrollPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>
