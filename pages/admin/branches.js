import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect } from 'react'

export default function BranchesPage() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { fetchBranches() }, [])

  async function fetchBranches() {
    setLoading(true)
    const r = await fetch('/api/admin/branches')
    const d = await r.json()
    setBranches(d.branches || [])
    setLoading(false)
  }

  function openNew() {
    setForm({ name: '', address: '', city: '', phone: '' })
    setEditId(null)
    setModal(true)
  }

  function openEdit(b) {
    setForm({ name: b.name, address: b.address || '', city: b.city || '', phone: b.phone || '' })
    setEditId(b.id)
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const url = editId ? `/api/admin/branches/${editId}` : '/api/admin/branches'
    const method = editId ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    setModal(false)
    fetchBranches()
  }

  async function handleDelete(id) {
    if (!confirm('Hapus cabang ini?')) return
    await fetch(`/api/admin/branches/${id}`, { method: 'DELETE' })
    fetchBranches()
  }

  return (
    <AdminLayout title="Manajemen Cabang">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-sm">{branches.length} cabang terdaftar</p>
          <button onClick={openNew} className="btn-primary">+ Tambah Cabang</button>
        </div>

        {loading ? (
          <div className="card flex justify-center py-16"><div className="spinner spinner-blue" /></div>
        ) : branches.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-3">🏢</div>
            <p className="text-slate-600 font-medium">Belum ada cabang</p>
            <p className="text-slate-400 text-sm mt-1">Klik "Tambah Cabang" untuk memulai</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map(b => (
              <div key={b.id} className="card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">🏢</div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(b)} className="btn-secondary px-3 py-1.5 text-xs">✏️ Edit</button>
                    <button onClick={() => handleDelete(b.id)} className="btn-danger px-3 py-1.5 text-xs">🗑️</button>
                  </div>
                </div>
                <h3 className="font-bold font-display text-slate-900 mb-1">{b.name}</h3>
                {b.city && <p className="text-sm text-slate-500">📍 {b.city}</p>}
                {b.address && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{b.address}</p>}
                {b.phone && <p className="text-sm text-slate-500 mt-2">📞 {b.phone}</p>}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">{b.employee_count || 0} karyawan terdaftar</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="text-lg font-bold font-display">{editId ? 'Edit Cabang' : 'Tambah Cabang Baru'}</h3>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="modal-body">
              <div>
                <label className="label">Nama Cabang *</label>
                <input className="input" placeholder="Cabang Jakarta Pusat" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Kota</label>
                <input className="input" placeholder="Jakarta" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="label">Alamat</label>
                <textarea className="input" rows={3} placeholder="Jl. Sudirman No. 1, Jakarta Pusat" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="label">Nomor Telepon</label>
                <input className="input" placeholder="021-12345678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModal(false)} className="btn-secondary">Batal</button>
              <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary">
                {saving ? <><div className="spinner" />Menyimpan...</> : '💾 Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
