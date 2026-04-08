import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect } from 'react'

const ROLES = [
  { value: 'employee', label: 'Karyawan' },
  { value: 'hr', label: 'HR Manager' },
  { value: 'admin', label: 'Administrator' },
]

const EMPTY_FORM = {
  name: '', email: '', password: '', employee_code: '',
  role: 'employee', branch_id: '', shift_id: '',
  department: '', position: '', phone: '', is_active: true
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [branches, setBranches] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')

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
      phone: e.phone || '', is_active: e.is_active
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

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()) || e.employee_code?.toLowerCase().includes(search.toLowerCase())
    const matchBranch = !filterBranch || e.branch_id === filterBranch
    return matchSearch && matchBranch
  })

  const roleLabel = (r) => ROLES.find(x => x.value === r)?.label || r
  const roleBadge = (r) => ({ admin: 'badge-red', hr: 'badge-blue', employee: 'badge-gray' }[r] || 'badge-gray')

  return (
    <AdminLayout title="Manajemen Karyawan">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-3 flex-1 min-w-0">
            <input className="input max-w-xs" placeholder="🔍 Cari nama, email, ID karyawan..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="input max-w-44" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button onClick={openNew} className="btn-primary">+ Tambah Karyawan</button>
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

      {/* Modal */}
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
                  <label className="label">ID Karyawan *</label>
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
    </AdminLayout>
  )
}
