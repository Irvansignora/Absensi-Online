// pages/admin/branches.js — Feature 3: Geofence per Cabang
import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect, useRef } from 'react'

const TIMEZONES = [
  { value: 'WIB',  label: 'WIB — Waktu Indonesia Barat',   offset: 7,  cities: 'Jakarta, Bandung, Surabaya, Medan' },
  { value: 'WITA', label: 'WITA — Waktu Indonesia Tengah', offset: 8,  cities: 'Makassar, Bali, Lombok, Balikpapan' },
  { value: 'WIT',  label: 'WIT — Waktu Indonesia Timur',   offset: 9,  cities: 'Jayapura, Ambon, Sorong' },
]
const TZ_BADGE = { WIB: 'bg-blue-100 text-blue-700', WITA: 'bg-orange-100 text-orange-700', WIT: 'bg-purple-100 text-purple-700' }
const EMPTY_FORM = { name: '', address: '', city: '', phone: '', timezone: 'WIB', latitude: '', longitude: '', geofence_radius: '100' }

function RadiusOption({ value, label, onClick, active }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${active ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>
      {label}
    </button>
  )
}

export default function BranchesPage() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [msg, setMsg]           = useState('')

  useEffect(() => { fetchBranches() }, [])

  async function fetchBranches() {
    setLoading(true)
    const r = await fetch('/api/admin/branches')
    const d = await r.json()
    setBranches(d.branches || [])
    setLoading(false)
  }

  function openNew()  { setForm(EMPTY_FORM); setEditId(null); setModal(true); setMsg('') }
  function openEdit(b) {
    setForm({
      name: b.name, address: b.address || '', city: b.city || '',
      phone: b.phone || '', timezone: b.timezone || 'WIB',
      latitude: b.latitude || '', longitude: b.longitude || '',
      geofence_radius: b.geofence_radius || '100',
    })
    setEditId(b.id); setModal(true); setMsg('')
  }

  async function handleSave() {
    if (!form.name) return
    setSaving(true)
    const url    = editId ? `/api/admin/branches/${editId}` : '/api/admin/branches'
    const method = editId ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { setMsg(d.error); return }
    setModal(false); fetchBranches()
  }

  async function handleDelete(id) {
    if (!confirm('Hapus cabang ini?')) return
    const r = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE' })
    const d = await r.json()
    if (!r.ok) { alert(d.error); return }
    fetchBranches()
  }

  async function autoFillLocation() {
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }))
        setGeoLoading(false)
      },
      () => { alert('Gagal mengambil lokasi. Pastikan izin lokasi diberikan.'); setGeoLoading(false) }
    )
  }

  const hasGeo = form.latitude && form.longitude

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">Manajemen Cabang</h1>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{branches.length} cabang terdaftar</p>
        <button onClick={openNew} className="btn-primary">+ Tambah Cabang</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner spinner-blue" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {branches.map(b => (
            <div key={b.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏢</span>
                  <div>
                    <p className="font-bold text-slate-800">{b.name}</p>
                    <p className="text-xs text-slate-400">{b.city}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TZ_BADGE[b.timezone] || 'bg-gray-100 text-gray-700'}`}>
                  {b.timezone}
                </span>
              </div>

              {b.address && <p className="text-xs text-slate-500 mb-2">📍 {b.address}</p>}
              {b.phone   && <p className="text-xs text-slate-500 mb-2">📞 {b.phone}</p>}

              {/* Geofence Badge */}
              <div className="mb-3">
                {b.latitude && b.longitude ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs">
                    <span>🛰️</span>
                    <div>
                      <p className="font-semibold text-green-700">Geofence Aktif</p>
                      <p className="text-green-600">Radius {b.geofence_radius || 100}m · {parseFloat(b.latitude).toFixed(4)}, {parseFloat(b.longitude).toFixed(4)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500">
                    <span>📍</span>
                    <span>Geofence belum diset — absensi dari mana saja</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{b.employee_count} karyawan</span>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(b)} className="btn-secondary text-xs py-1">Edit</button>
                  <button onClick={() => handleDelete(b.id)} className="text-red-500 hover:text-red-700 text-xs font-medium px-2">Hapus</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg font-display">{editId ? 'Edit Cabang' : 'Tambah Cabang'}</h3>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {msg && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{msg}</div>}

              <div>
                <label className="label">Nama Cabang *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Kantor Pusat" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Kota</label>
                  <input className="input" value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} placeholder="Jakarta" />
                </div>
                <div>
                  <label className="label">No. Telepon</label>
                  <input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="021-..." />
                </div>
              </div>

              <div>
                <label className="label">Alamat</label>
                <input className="input" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="Jl. Sudirman No. 1" />
              </div>

              <div>
                <label className="label">Timezone</label>
                <select className="input" value={form.timezone} onChange={e => setForm(f => ({...f, timezone: e.target.value}))}>
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1">{TIMEZONES.find(t => t.value === form.timezone)?.cities}</p>
              </div>

              {/* Geofence Section */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">🛰️ Geofence</p>
                    <p className="text-xs text-slate-500">Batasi radius check-in dari lokasi kantor</p>
                  </div>
                  <button type="button" onClick={autoFillLocation} disabled={geoLoading}
                    className="btn-secondary text-xs py-1.5 flex items-center gap-1">
                    {geoLoading ? '⏳' : '📍'} {geoLoading ? 'Mengambil...' : 'Lokasi Saya'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Latitude</label>
                    <input className="input text-sm font-mono" value={form.latitude}
                      onChange={e => setForm(f => ({...f, latitude: e.target.value}))} placeholder="-6.200000" />
                  </div>
                  <div>
                    <label className="label text-xs">Longitude</label>
                    <input className="input text-sm font-mono" value={form.longitude}
                      onChange={e => setForm(f => ({...f, longitude: e.target.value}))} placeholder="106.816666" />
                  </div>
                </div>

                <div>
                  <label className="label text-xs">Radius Check-in</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {[
                      { v: '50',  l: '50m (ketat)' },
                      { v: '100', l: '100m (normal)' },
                      { v: '200', l: '200m (longgar)' },
                      { v: '500', l: '500m (luas)' },
                    ].map(o => (
                      <RadiusOption key={o.v} value={o.v} label={o.l} active={form.geofence_radius === o.v}
                        onClick={() => setForm(f => ({...f, geofence_radius: o.v}))} />
                    ))}
                  </div>
                  <input type="number" className="input mt-2 text-sm" value={form.geofence_radius}
                    onChange={e => setForm(f => ({...f, geofence_radius: e.target.value}))}
                    placeholder="Radius dalam meter" min="10" max="5000" />
                </div>

                {!hasGeo && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                    ℹ️ Kosongkan latitude & longitude untuk menonaktifkan geofence (karyawan bisa absen dari mana saja)
                  </p>
                )}
                {hasGeo && (
                  <p className="text-xs text-green-600 bg-green-50 rounded-lg p-2">
                    ✅ Geofence aktif — karyawan hanya bisa check-in dalam radius {form.geofence_radius}m dari koordinat ini
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModal(false)} className="btn-secondary">Batal</button>
              <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary min-w-[100px]">
                {saving ? '⏳ Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
