// pages/admin/branches.js
import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect } from 'react'

const TIMEZONES = [
  { value: 'WIB',  label: 'WIB — Waktu Indonesia Barat',   offset: 7,  cities: 'Jakarta, Bandung, Surabaya, Medan' },
  { value: 'WITA', label: 'WITA — Waktu Indonesia Tengah', offset: 8,  cities: 'Makassar, Bali, Lombok, Balikpapan' },
  { value: 'WIT',  label: 'WIT — Waktu Indonesia Timur',   offset: 9,  cities: 'Jayapura, Ambon, Sorong' },
]

const EMPTY_FORM = { name: '', address: '', city: '', phone: '', timezone: 'WIB' }

const TZ_BADGE = { WIB: 'bg-blue-100 text-blue-700', WITA: 'bg-orange-100 text-orange-700', WIT: 'bg-purple-100 text-purple-700' }

export default function BranchesPage() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)

  useEffect(() => { fetchBranches() }, [])

  async function fetchBranches() {
    setLoading(true)
    const r = await fetch('/api/admin/branches')
    const d = await r.json()
    setBranches(d.branches || [])
    setLoading(false)
  }

  function openNew()  { setForm(EMPTY_FORM); setEditId(null); setModal(true) }
  function openEdit(b) {
    setForm({ name: b.name, address: b.address || '', city: b.city || '', phone: b.phone || '', timezone: b.timezone || 'WIB' })
    setEditId(b.id); setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const url    = editId ? `/api/admin/branches/${editId}` : '/api/admin/branches'
    const method = editId ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); setModal(false); fetchBranches()
  }

  async function handleDelete(id) {
    if (!confirm('Hapus cabang ini?')) return
    const r = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE' })
    const d = await r.json()
    if (!r.ok) { alert(d.error); return }
    fetchBranches()
  }

  const selectedTZ = TIMEZONES.find(t => t.value === form.timezone) || TIMEZONES[0]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">Manajemen Cabang</h1>
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-sm">{branches.length} cabang terdaftar</p>
          <button onClick={openNew} className="btn-primary">+ Tambah Cabang</button>
        </div>

        {/* Timezone legend */}
        <div className="card bg-blue-50 border-blue-100">
          <p className="text-sm font-semibold text-blue-800 mb-2">🌏 Zona Waktu Indonesia</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TIMEZONES.map(tz => (
              <div key={tz.value} className={`rounded-lg px-3 py-2 ${TZ_BADGE[tz.value]}`}>
                <p className="font-bold text-sm">{tz.value} (UTC+{tz.offset})</p>
                <p className="text-xs opacity-75">{tz.cities}</p>
              </div>
            ))}
          </div>
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
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{b.employee_count || 0} karyawan</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${TZ_BADGE[b.timezone || 'WIB']}`}>
                    🕐 {b.timezone || 'WIB'} (UTC+{b.timezone_offset || 7})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
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
                <label className="label">Zona Waktu *</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIMEZONES.map(tz => (
                    <button
                      key={tz.value}
                      type="button"
                      onClick={() => setForm({ ...form, timezone: tz.value })}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        form.timezone === tz.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-bold text-sm text-slate-800">{tz.value}</p>
                      <p className="text-xs text-slate-400">UTC+{tz.offset}</p>
                    </button>
                  ))}
                </div>
                {selectedTZ && (
                  <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2">
                    🌏 {selectedTZ.label} · Contoh kota: {selectedTZ.cities}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Kota</label>
                <input className="input" placeholder="Jakarta" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="label">Alamat</label>
                <textarea className="input" rows={3} placeholder="Jl. Sudirman No. 1" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
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
    </div>
  )
}

BranchesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>
