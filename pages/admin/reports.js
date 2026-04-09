import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect } from 'react'

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export default function ReportsPage() {
  const now = new Date()
  const [records, setRecords] = useState([])
  const [branches, setBranches] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    branch_id: '',
    employee_id: '',
    status: '',
  })
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    fetch('/api/admin/branches').then(r => r.json()).then(d => setBranches(d.branches || []))
    fetch('/api/admin/employees').then(r => r.json()).then(d => setEmployees(d.employees || []))
  }, [])

  useEffect(() => { fetchReports() }, [filters])

  async function fetchReports() {
    setLoading(true)
    const params = new URLSearchParams({ type: 'monthly', ...filters }).toString()
    const r = await fetch(`/api/admin/reports?${params}`)
    const d = await r.json()
    setRecords(d.records || [])
    setSummary(d.summary)
    setLoading(false)
  }

  async function handleExport(type) {
    setExporting(true)
    const params = new URLSearchParams({ format: type, ...filters }).toString()
    const res = await fetch(`/api/admin/reports/export?${params}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `laporan-absensi-${MONTHS[filters.month - 1]}-${filters.year}.${type === 'excel' ? 'xlsx' : 'csv'}`
      a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'

  const Badge = ({ status }) => {
    const map = { present: ['Hadir', 'badge-green'], late: ['Terlambat', 'badge-yellow'], absent: ['Absen', 'badge-red'], leave: ['Izin', 'badge-blue'], half_day: ['½ Hari', 'badge-orange'] }
    const [lbl, cls] = map[status] || [status, 'badge-gray']
    return <span className={cls}>{lbl}</span>
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const filteredEmployees = filters.branch_id ? employees.filter(e => e.branch_id === filters.branch_id) : employees

  return (
    <AdminLayout title="Laporan Absensi">
      <div className="space-y-5">
        {/* Filters */}
        <div className="card">
          <h3 className="font-semibold font-display text-slate-800 mb-4">🔍 Filter Laporan</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="label">Bulan</label>
              <select className="input" value={filters.month} onChange={e => setFilters({ ...filters, month: e.target.value })}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tahun</label>
              <select className="input" value={filters.year} onChange={e => setFilters({ ...filters, year: e.target.value })}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cabang</label>
              <select className="input" value={filters.branch_id} onChange={e => setFilters({ ...filters, branch_id: e.target.value, employee_id: '' })}>
                <option value="">Semua Cabang</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Karyawan</label>
              <select className="input" value={filters.employee_id} onChange={e => setFilters({ ...filters, employee_id: e.target.value })}>
                <option value="">Semua Karyawan</option>
                {filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                <option value="">Semua Status</option>
                <option value="present">Hadir</option>
                <option value="late">Terlambat</option>
                <option value="absent">Absen</option>
                <option value="leave">Izin/Cuti</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Record', value: summary.total, color: 'bg-slate-50', textColor: 'text-slate-800' },
              { label: '✅ Hadir', value: summary.present, color: 'bg-green-50', textColor: 'text-green-700' },
              { label: '⚠️ Terlambat', value: summary.late, color: 'bg-amber-50', textColor: 'text-amber-700' },
              { label: '❌ Absen', value: summary.absent, color: 'bg-red-50', textColor: 'text-red-600' },
              { label: '📋 Izin/Cuti', value: summary.leave, color: 'bg-blue-50', textColor: 'text-blue-700' },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
                <div className={`text-2xl font-bold font-display ${s.textColor}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Export buttons */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-slate-500">
            📊 {records.length} record ditemukan untuk {MONTHS[filters.month - 1]} {filters.year}
          </p>
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')} disabled={exporting || records.length === 0} className="btn-secondary">
              {exporting ? <><div className="spinner spinner-blue" />...</> : '📄 Export CSV'}
            </button>
            <button onClick={() => handleExport('excel')} disabled={exporting || records.length === 0} className="btn-success">
              {exporting ? <><div className="spinner" />...</> : '📊 Export Excel'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><div className="spinner spinner-blue" /></div>
          ) : records.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-slate-500">Tidak ada data untuk filter yang dipilih</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Karyawan</th>
                    <th>Cabang</th>
                    <th>Shift</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Jam Kerja</th>
                    <th>Status</th>
                    <th>Lokasi</th>
                    <th>Wajah</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => {
                    const workMins = r.check_in && r.check_out
                      ? Math.floor((new Date(r.check_out) - new Date(r.check_in)) / 60000) : null
                    return (
                      <tr key={r.id}>
                        <td><span className="font-mono text-sm">{fmtDate(r.date)}</span></td>
                        <td>
                          <p className="font-medium text-slate-800">{r.employee_name}</p>
                          <p className="text-xs text-slate-400">{r.employee_code}</p>
                        </td>
                        <td>{r.branch_name || '-'}</td>
                        <td>{r.shift_name || '-'}</td>
                        <td><span className="font-mono text-sm">{fmt(r.check_in)}</span></td>
                        <td><span className="font-mono text-sm">{fmt(r.check_out)}</span></td>
                        <td>
                          <span className="font-mono text-sm text-blue-700">
                            {workMins !== null ? `${Math.floor(workMins / 60)}j ${workMins % 60}m` : '-'}
                          </span>
                        </td>
                        <td><Badge status={r.status} /></td>
                        <td className="text-center">
                          {r.check_in_lat && r.check_in_lng ? (
                            <a
                              href={`https://www.google.com/maps?q=${r.check_in_lat},${r.check_in_lng}`}
                              target="_blank"
                              rel="noreferrer"
                              title={`Lat: ${parseFloat(r.check_in_lat).toFixed(5)}, Lng: ${parseFloat(r.check_in_lng).toFixed(5)}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-mono bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              📍 Maps
                            </a>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="text-center">
                          {r.face_photo_url ? (
                            <a href={r.face_photo_url} target="_blank" rel="noreferrer" title="Lihat foto check-in">
                              <img src={r.face_photo_url} alt="foto"
                                className="w-9 h-9 rounded-full object-cover border-2 border-emerald-400 inline-block hover:scale-110 transition-transform" />
                            </a>
                          ) : r.face_verified ? (
                            <span title="Terverifikasi tanpa foto" className="text-emerald-500 text-base">✅</span>
                          ) : (
                            <span title="Tidak ada foto" className="text-slate-300 text-base">—</span>
                          )}
                        </td>
                        <td className="text-xs text-slate-500 max-w-32 truncate">{r.check_in_note || r.check_out_note || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
