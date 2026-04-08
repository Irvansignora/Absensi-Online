import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect } from 'react'

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const EMPTY_FORM = { name: '', start_time: '08:00', end_time: '17:00', branch_id: '', late_tolerance_minutes: 15, work_days: ['Senin','Selasa','Rabu','Kamis','Jumat'] }

function TimeDisplay({ start, end }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{start}</span>
      <span className="text-slate-400">→</span>
      <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{end}</span>
    </div>
  )
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [sh, br] = await Promise.all([
      fetch('/api/admin/shifts').then(r => r.json()),
      fetch('/api/admin/branches').then(r => r.json()),
    ])
    setShifts(sh.shifts || [])
    setBranches(br.branches || [])
    setLoading(false)
  }

  function openNew() { setForm(EMPTY_FORM); setEditId(null); setModal(true) }
  function openEdit(s) {
    setForm({
      name: s.name, start_time: s.start_time, end_time: s.end_time,
      branch_id: s.branch_id || '', late_tolerance_minutes: s.late_tolerance_minutes || 15,
      work_days: s.work_days || ['Senin','Selasa','Rabu','Kamis','Jumat']
    })
    setEditId(s.id)
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const url = editId ? `/api/admin/shifts/${editId}` : '/api/admin/shifts'
    const method = editId ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    setModal(false)
    fetchAll()
  }

  async function handleDelete(id) {
    if (!confirm('Hapus shift ini?')) return
    await fetch(`/api/admin/shifts/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  function toggleDay(day) {
    const days = form.work_days.includes(day)
      ? form.work_days.filter(d => d !== day)
      : [...form.work_days, day]
    setForm({ ...form, work_days: days })
  }

  const getDuration = (start, end) => {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60
    return `${Math.floor(mins / 60)}j ${mins % 60}m`
  }

  const SHIFT_ICONS = { Pagi: '🌅', Siang: '☀️', Sore: '🌆', Malam: '🌙', default: '🕐' }
  const getIcon = (name) => Object.keys(SHIFT_ICONS).find(k => name?.includes(k)) ? SHIFT_ICONS[Object.keys(SHIFT_ICONS).find(k => name?.includes(k))] : SHIFT_ICONS.default

  return (
    <AdminLayout title="Manajemen Shift">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-sm">{shifts.length} shift terdaftar</p>
          <button onClick={openNew} className="btn-primary">+ Tambah Shift</button>
        </div>

        {loading ? (
          <div className="card flex justify-center py-16"><div className="spinner spinner-blue" /></div>
        ) : shifts.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-3">🕐</div>
            <p className="text-slate-600 font-medium">Belum ada shift</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map(s => (
              <div key={s.id} className="card-hover">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">{getIcon(s.name)}</div>
                    <div>
                      <h3 className="font-bold font-display text-slate-900">{s.name}</h3>
                      {s.branch_name && <p className="text-xs text-slate-400">🏢 {s.branch_name}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="btn-secondary px-2.5 py-1.5 text-xs">✏️</button>
                    <button onClick={() => handleDelete(s.id)} className="btn-danger px-2.5 py-1.5 text-xs">🗑️</button>
                  </div>
                </div>

                <TimeDisplay start={s.start_time} end={s.end_time} />

                <div className="mt-3 flex items-center gap-3">
                  <span className="badge-blue">⏱ {getDuration(s.start_time, s.end_time)}</span>
                  <span className="badge-yellow">⚠️ Toleransi {s.late_tolerance_minutes || 15} mnt</span>
                </div>

                {s.work_days?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {DAYS.map(d => (
                      <span key={d} className={`text-xs px-2 py-0.5 rounded-md font-medium ${s.work_days?.includes(d) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {d.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">{s.employee_count || 0} karyawan di shift ini</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="text-lg font-bold font-display">{editId ? 'Edit Shift' : 'Tambah Shift Baru'}</h3>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="modal-body">
              <div>
                <label className="label">Nama Shift *</label>
                <input className="input" placeholder="Shift Pagi / Shift Malam / dll" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Jam Masuk *</label>
                  <input type="time" className="input" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="label">Jam Keluar *</label>
                  <input type="time" className="input" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Toleransi Keterlambatan (menit)</label>
                <input type="number" className="input" min={0} max={60} value={form.late_tolerance_minutes} onChange={e => setForm({ ...form, late_tolerance_minutes: parseInt(e.target.value) })} />
              </div>
              <div>
                <label className="label">Cabang (opsional - kosong = semua cabang)</label>
                <select className="input" value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })}>
                  <option value="">Semua Cabang</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Hari Kerja</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(d => (
                    <button
                      key={d} type="button"
                      onClick={() => toggleDay(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${form.work_days?.includes(d) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {d.slice(0, 3)}
                    </button>
                  ))}
                </div>
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
