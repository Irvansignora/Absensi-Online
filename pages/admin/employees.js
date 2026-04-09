import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect, useRef } from 'react'

const ROLES = [
  { value: 'employee', label: 'Karyawan' },
  { value: 'hr', label: 'HR Manager' },
  { value: 'admin', label: 'Administrator' },
]

const EMPTY_FORM = {
  name: '', email: '', password: '', employee_code: '',
  role: 'employee', branch_id: '', shift_id: '',
  department: '', position: '', phone: '', is_active: true,
  salary_basic: '', allowance_transport: '', allowance_meal: '',
  allowance_position: '', bpjs_enrolled: true,
}

export default function EmployeesPage() {
  const [employees, setEmployees]       = useState([])
  const [branches, setBranches]         = useState([])
  const [shifts, setShifts]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [editId, setEditId]             = useState(null)
  const [saving, setSaving]             = useState(false)
  const [search, setSearch]             = useState('')
  const [filterBranch, setFilterBranch] = useState('')

  // Import state
  const [importModal, setImportModal]   = useState(false)
  const [importFile, setImportFile]     = useState(null)
  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [emp, br, sh] = await Promise.all([
      fetch('/api/admin/employees').then(r => r.json()),
      fetch('/api/admin/branches').then(r => r.json()),
      fetch('/api/admin/shifts').then(r => r.json()),
    ])
    setEmployees(emp.employees || [])
    setBranches(br.branches || [])
    setShifts(sh.shifts || [])
    setLoading(false)
  }

  function openNew() { setForm(EMPTY_FORM); setEditId(null); setModal(true) }

  function openEdit(e) {
    setForm({
      name: e.name, email: e.email, password: '',
      employee_code: e.employee_code, role: e.role,
      branch_id: e.branch_id || '', shift_id: e.shift_id || '',
      department: e.department || '', position: e.position || '',
      phone: e.phone || '', is_active: e.is_active,
      salary_basic: e.salary_basic || '', allowance_transport: e.allowance_transport || '',
      allowance_meal: e.allowance_meal || '', allowance_position: e.allowance_position || '',
      bpjs_enrolled: e.bpjs_enrolled !== false,
    })
    setEditId(e.id)
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const url = editId ? `/api/admin/employees/${editId}` : '/api/admin/employees'
    const method = editId ? 'PUT' : 'POST'
    const body = { ...form }
    if (editId && !body.password) delete body.password
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json()
    if (!res.ok) { alert(d.error); setSaving(false); return }
    setSaving(false)
    setModal(false)
    fetchAll()
  }

  async function handleToggle(id, active) {
    await fetch(`/api/admin/employees/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !active }) })
    fetchAll()
  }

  // ── Import handlers ────────────────────────────────────────────────────────
  function openImport() {
    setImportFile(null)
    setImportResult(null)
    setImportModal(true)
  }

  async function handleDownloadTemplate() {
    const res = await fetch('/api/admin/employees/template')
    if (!res.ok) { alert('Gagal download template'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-import-karyawan.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    if (!importFile) { alert('Pilih file Excel terlebih dahulu'); return }
    setImporting(true)
    setImportResult(null)
    const fd = new FormData()
    fd.append('file', importFile)
    const res = await fetch('/api/admin/employees/import', { method: 'POST', body: fd })
    const d = await res.json()
    setImporting(false)
    setImportResult(d)
    if (d.summary?.success > 0) fetchAll()
  }

  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code?.toLowerCase().includes(search.toLowerCase())
    const matchBranch = !filterBranch || e.branch_id === filterBranch
    return matchSearch && matchBranch
  })

  const roleLabel = (r) => ROLES.find(x => x.value === r)?.label || r
  const roleBadge = (r) => ({ admin: 'badge-red', hr: 'badge-blue', employee: 'badge-gray' }[r] || 'badge-gray')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">Manajemen Karyawan</h1>
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-3 flex-1 min-w-0">
            <input className="input max-w-xs" placeholder="🔍 Cari nama, email, ID karyawan..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="input max-w-44" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={openImport} className="btn-secondary">
              ⬆️ Import Excel
            </button>
            <button onClick={openNew} className="btn-primary">+ Tambah Karyawan</button>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><div className="spinner spinner-blue" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>ID Karyawan</th>
                    <th>Role</th>
                    <th>Cabang</th>
                    <th>Shift</th>
                    <th>Jabatan</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-slate-400">Tidak ada karyawan</td></tr>
                  ) : filtered.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                            {e.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{e.name}</p>
                            <p className="text-xs text-slate-400">{e.email}</p>
                          </div>
                        </div>
                      </td>
                      <td><code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{e.employee_code}</code></td>
                      <td><span className={roleBadge(e.role)}>{roleLabel(e.role)}</span></td>
                      <td>{e.branch_name || <span className="text-slate-300">-</span>}</td>
                      <td>{e.shift_name ? <span className="text-sm">{e.shift_name}</span> : <span className="text-slate-300">-</span>}</td>
                      <td>
                        <div>
                          <p className="text-sm">{e.position || '-'}</p>
                          {e.department && <p className="text-xs text-slate-400">{e.department}</p>}
                        </div>
                      </td>
                      <td>
                        <span className={e.is_active ? 'badge-green' : 'badge-gray'}>
                          {e.is_active ? '● Aktif' : '○ Nonaktif'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(e)} className="btn-secondary px-2.5 py-1.5 text-xs">✏️</button>
                          <button onClick={() => handleToggle(e.id, e.is_active)} className="btn-secondary px-2.5 py-1.5 text-xs">
                            {e.is_active ? '⏸️' : '▶️'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Tambah/Edit ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="text-lg font-bold font-display">{editId ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}</h3>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nama Lengkap *</label>
                  <input className="input" placeholder="Budi Santoso" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" className="input" placeholder="budi@perusahaan.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">ID Karyawan</label>
                  <input className="input" placeholder="EMP-001" value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">{editId ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</label>
                  <input type="password" className="input" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">No. Telepon</label>
                  <input className="input" placeholder="08123456789" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Cabang</label>
                  <select className="input" value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })}>
                    <option value="">Pilih Cabang</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Shift</label>
                  <select className="input" value={form.shift_id} onChange={e => setForm({ ...form, shift_id: e.target.value })}>
                    <option value="">Pilih Shift</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Departemen</label>
                  <input className="input" placeholder="Marketing" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
                </div>
                <div>
                  <label className="label">Jabatan</label>
                  <input className="input" placeholder="Staff Senior" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                </div>
              </div>

              {/* Divider Gaji */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">💰 Komponen Gaji</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Gaji Pokok (Rp)</label>
                    <input type="number" className="input" placeholder="5000000" value={form.salary_basic}
                      onChange={e => setForm({ ...form, salary_basic: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Tunjangan Jabatan (Rp)</label>
                    <input type="number" className="input" placeholder="500000" value={form.allowance_position}
                      onChange={e => setForm({ ...form, allowance_position: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Tunjangan Transport (Rp)</label>
                    <input type="number" className="input" placeholder="300000" value={form.allowance_transport}
                      onChange={e => setForm({ ...form, allowance_transport: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Tunjangan Makan (Rp)</label>
                    <input type="number" className="input" placeholder="200000" value={form.allowance_meal}
                      onChange={e => setForm({ ...form, allowance_meal: e.target.value })} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <input type="checkbox" id="bpjs" checked={form.bpjs_enrolled}
                      onChange={e => setForm({ ...form, bpjs_enrolled: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600" />
                    <label htmlFor="bpjs" className="text-sm text-slate-700 cursor-pointer">
                      Peserta BPJS (Kesehatan + Ketenagakerjaan)
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModal(false)} className="btn-secondary">Batal</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.email} className="btn-primary">
                {saving ? <><div className="spinner" />Menyimpan...</> : '💾 Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Import Excel ── */}
      {importModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !importing && setImportModal(false)}>
          <div className="modal" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="text-lg font-bold font-display">⬆️ Import Karyawan dari Excel</h3>
              <button onClick={() => !importing && setImportModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="modal-body space-y-4">

              {/* Step 1: Download template */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📥</span>
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900 text-sm">Langkah 1 — Download Template</p>
                    <p className="text-blue-700 text-xs mt-1">Download template Excel, isi data karyawan, lalu upload kembali.</p>
                    <button
                      onClick={handleDownloadTemplate}
                      className="mt-2 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ⬇️ Download Template Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Upload file */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:border-blue-300 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => { setImportFile(e.target.files[0]); setImportResult(null) }}
                />
                {importFile ? (
                  <div className="space-y-2">
                    <div className="text-3xl">📊</div>
                    <p className="font-medium text-slate-800 text-sm">{importFile.name}</p>
                    <p className="text-xs text-slate-400">{(importFile.size / 1024).toFixed(1)} KB</p>
                    <button onClick={() => { setImportFile(null); setImportResult(null); fileInputRef.current.value = '' }} className="text-xs text-red-500 hover:text-red-700">
                      × Ganti file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-3xl">📂</div>
                    <p className="text-slate-500 text-sm">Klik untuk pilih file Excel</p>
                    <p className="text-slate-400 text-xs">Format: .xlsx atau .xls · Maks. 5MB · Maks. 500 baris</p>
                    <button onClick={() => fileInputRef.current.click()} className="btn-secondary text-sm mt-1">
                      Pilih File
                    </button>
                  </div>
                )}
              </div>

              {/* Import result */}
              {importResult && (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className={`rounded-xl p-3 text-sm font-medium ${importResult.summary?.error > 0 && importResult.summary?.success === 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {importResult.message}
                  </div>
                  {importResult.summary && (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '✅ Berhasil', val: importResult.summary.success, cls: 'bg-green-50 text-green-700' },
                        { label: '⏭️ Dilewati', val: importResult.summary.skip,    cls: 'bg-amber-50 text-amber-700' },
                        { label: '❌ Gagal',    val: importResult.summary.error,   cls: 'bg-red-50 text-red-600'    },
                      ].map(s => (
                        <div key={s.label} className={`${s.cls} rounded-lg p-2 text-center`}>
                          <div className="text-xl font-bold">{s.val}</div>
                          <div className="text-xs">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Detail per row */}
                  {importResult.results && importResult.results.length > 0 && (
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 text-slate-500 font-medium">Baris</th>
                            <th className="text-left px-3 py-2 text-slate-500 font-medium">Email</th>
                            <th className="text-left px-3 py-2 text-slate-500 font-medium">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.results.map((r, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="px-3 py-1.5 font-mono text-slate-400">{r.row}</td>
                              <td className="px-3 py-1.5 text-slate-700">{r.email}</td>
                              <td className={`px-3 py-1.5 ${r.status === 'success' ? 'text-green-600' : r.status === 'skip' ? 'text-amber-600' : 'text-red-600'}`}>
                                {r.status === 'success' ? '✅ ' : r.status === 'skip' ? '⏭️ ' : '❌ '}{r.message}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setImportModal(false)} className="btn-secondary" disabled={importing}>
                {importResult ? 'Tutup' : 'Batal'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="btn-primary"
                >
                  {importing ? <><div className="spinner" />Mengimport...</> : '⬆️ Mulai Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

EmployeesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>
