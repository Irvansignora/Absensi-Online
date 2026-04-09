// pages/requests.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'

const TYPE_CONFIG = {
  izin:        { label: 'Izin',        icon: '📝', color: 'badge-yellow', desc: 'Izin tidak masuk kerja' },
  cuti:        { label: 'Cuti',        icon: '🏖️', color: 'badge-blue',   desc: 'Cuti tahunan / khusus' },
  sakit:       { label: 'Sakit',       icon: '🏥', color: 'badge-red',    desc: 'Tidak masuk karena sakit' },
  tukar_shift: { label: 'Tukar Shift', icon: '🔄', color: 'badge-purple', desc: 'Tukar jadwal shift dengan rekan' },
  tukar_libur: { label: 'Tukar Libur', icon: '📅', color: 'badge-orange', desc: 'Tukar hari libur dengan rekan' },
}

const STATUS_CONFIG = {
  pending:  { label: 'Menunggu', cls: 'badge-yellow', icon: '⏳' },
  approved: { label: 'Disetujui', cls: 'badge-green', icon: '✅' },
  rejected: { label: 'Ditolak',  cls: 'badge-red',   icon: '❌' },
}

const EMPTY_FORM = {
  type: 'izin', start_date: '', end_date: '', reason: '',
  swap_with_employee_id: '', swap_date: '', swap_shift_id: '',
}

function fmtDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function RequestsPage() {
  const router = useRouter()
  const [user, setUser]           = useState(null)
  const [requests, setRequests]   = useState([])
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState({ type: '', text: '' })
  const [tab, setTab]             = useState('all')
  const [overtime, setOvertime]   = useState([])

  useEffect(() => {
    fetchUser()
    fetchRequests()
    fetchOvertime()
  }, [])

  async function fetchUser() {
    const r = await fetch('/api/auth/me')
    const d = await r.json()
    if (d.error) { router.push('/'); return }
    if (['admin', 'hr'].includes(d.user.role)) { router.push('/admin'); return }
    setUser(d.user)
    // Load employees & shifts for swap options
    // Gunakan /api/employees (bukan admin) agar karyawan biasa bisa akses
    const [empR, shiftR] = await Promise.all([
      fetch('/api/employees').then(r => r.json()).catch(() => ({ employees: [] })),
      fetch('/api/shifts').then(r => r.json()).catch(() => ({ shifts: [] })),
    ])
    setEmployees(empR.employees || [])
    setShifts(shiftR.shifts || [])
  }

  async function fetchRequests() {
    setLoading(true)
    const r = await fetch('/api/requests')
    const d = await r.json()
    setRequests(d.requests || [])
    setLoading(false)
  }

  async function fetchOvertime() {
    const r = await fetch('/api/attendance/history?limit=30')
    const d = await r.json()
    const ot = (d.records || []).filter(rec => rec.overtime_minutes > 0)
    setOvertime(ot)
  }

  async function handleSubmit() {
    if (!form.start_date) { setMsg({ type: 'error', text: 'Tanggal mulai wajib diisi' }); return }
    if (!form.reason && !['tukar_shift', 'tukar_libur'].includes(form.type)) {
      setMsg({ type: 'error', text: 'Alasan wajib diisi' }); return
    }
    setSaving(true)
    setMsg({ type: '', text: '' })
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg({ type: 'error', text: data.error }); return }
    setMsg({ type: 'success', text: '✅ Pengajuan berhasil dikirim!' })
    setModal(false)
    setForm(EMPTY_FORM)
    fetchRequests()
  }

  async function handleCancel(id) {
    if (!confirm('Batalkan pengajuan ini?')) return
    const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' })
    if (res.ok) fetchRequests()
  }

  const filtered = tab === 'all' ? requests : requests.filter(r => r.status === tab)
  const isSwap   = form.type === 'tukar_shift' || form.type === 'tukar_libur'

  const stats = {
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  return (
    <>
      <Head><title>Pengajuan — AbsensiPro</title></Head>
      <div className="min-h-screen bg-slate-50 font-body">

        {/* Header */}
        <div className="px-4 pt-10 pb-16 text-white" style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1e3a8a 100%)' }}>
          <div className="flex justify-between items-center max-w-md mx-auto mb-6">
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">← Kembali</Link>
            </div>
            <button
              onClick={() => { setModal(true); setMsg({ type: '', text: '' }) }}
              className="bg-blue-500 hover:bg-blue-400 text-white text-sm px-4 py-2 rounded-xl font-medium transition-all"
            >
              + Ajukan
            </button>
          </div>
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold font-display">Pengajuan</h1>
            <p className="text-blue-300 text-sm mt-1">Izin · Cuti · Sakit · Tukar Shift</p>
          </div>

          {/* Stats */}
          <div className="max-w-md mx-auto mt-5 grid grid-cols-3 gap-3">
            {[
              { label: 'Menunggu', val: stats.pending,  icon: '⏳', color: 'bg-amber-500/20' },
              { label: 'Disetujui', val: stats.approved, icon: '✅', color: 'bg-emerald-500/20' },
              { label: 'Ditolak',   val: stats.rejected, icon: '❌', color: 'bg-red-500/20' },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                <div className="text-xl">{s.icon}</div>
                <div className="text-white font-bold text-xl">{s.val}</div>
                <div className="text-blue-200 text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-8 pb-10 space-y-4">

          {/* Global msg */}
          {msg.text && !modal && (
            <div className={`p-3 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {msg.text}
            </div>
          )}

          {/* Lembur section */}
          {overtime.length > 0 && (
            <div className="card animate-slide-up">
              <h2 className="text-base font-bold font-display mb-3">⏰ Riwayat Lembur</h2>
              <div className="space-y-2">
                {overtime.slice(0, 5).map(rec => (
                  <div key={rec.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{fmtDate(rec.date)}</p>
                      <p className="text-xs text-slate-400 font-mono">
                        {Math.floor(rec.overtime_minutes / 60)}j {rec.overtime_minutes % 60}m lembur
                      </p>
                    </div>
                    <span className={rec.overtime_approved ? 'badge-green' : 'badge-yellow'}>
                      {rec.overtime_approved ? '✅ Disetujui' : '⏳ Menunggu'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab filter */}
          <div className="card animate-slide-up">
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {[['all', 'Semua'], ['pending', 'Menunggu'], ['approved', 'Disetujui'], ['rejected', 'Ditolak']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${tab === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {label} {key !== 'all' && stats[key] > 0 && `(${stats[key]})`}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-10"><div className="spinner spinner-blue" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-slate-400 text-sm">Belum ada pengajuan</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(req => {
                  const tc = TYPE_CONFIG[req.type] || { label: req.type, icon: '📄', color: 'badge-gray' }
                  const sc = STATUS_CONFIG[req.status] || { label: req.status, cls: 'badge-gray', icon: '?' }
                  return (
                    <div key={req.id} className="border border-slate-100 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{tc.icon}</span>
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{tc.label}</p>
                            <p className="text-xs text-slate-400">
                              {fmtDate(req.start_date)}
                              {req.end_date && req.end_date !== req.start_date ? ` s/d ${fmtDate(req.end_date)}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className={sc.cls}>{sc.icon} {sc.label}</span>
                      </div>

                      {req.reason && <p className="text-xs text-slate-500 mb-2 bg-slate-50 rounded-lg p-2">{req.reason}</p>}

                      {(req.type === 'tukar_shift' || req.type === 'tukar_libur') && (
                        <p className="text-xs text-slate-500 mb-2">
                          🔄 Tukar dengan: <strong>{req.swap_employee?.name || '-'}</strong>
                          {req.swap_date && ` · ${fmtDate(req.swap_date)}`}
                        </p>
                      )}

                      {req.review_note && (
                        <p className={`text-xs rounded-lg p-2 mb-2 ${req.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          💬 {req.reviewer?.name}: {req.review_note}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-slate-400">{fmtDate(req.created_at)}</p>
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(req.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Batalkan
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Pengajuan */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
              <h3 className="text-lg font-bold font-display">Buat Pengajuan</h3>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              {msg.text && (
                <div className={`p-3 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {msg.text}
                </div>
              )}

              {/* Tipe */}
              <div>
                <label className="label">Jenis Pengajuan *</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, type: key })}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                        form.type === key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xl">{cfg.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{cfg.label}</p>
                        <p className="text-xs text-slate-400 leading-tight">{cfg.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tanggal */}
              <div className={`grid ${isSwap ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                <div>
                  <label className="label">{isSwap ? 'Tanggal Anda' : 'Tanggal Mulai *'}</label>
                  <input type="date" className="input"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]} />
                </div>
                {!isSwap && (
                  <div>
                    <label className="label">Tanggal Selesai</label>
                    <input type="date" className="input"
                      value={form.end_date}
                      onChange={e => setForm({ ...form, end_date: e.target.value })}
                      min={form.start_date || new Date().toISOString().split('T')[0]} />
                  </div>
                )}
              </div>

              {/* Swap fields */}
              {isSwap && (
                <>
                  <div>
                    <label className="label">Tukar Dengan Karyawan *</label>
                    <select className="input" value={form.swap_with_employee_id}
                      onChange={e => setForm({ ...form, swap_with_employee_id: e.target.value })}>
                      <option value="">Pilih karyawan...</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Tanggal Pengganti</label>
                    <input type="date" className="input"
                      value={form.swap_date}
                      onChange={e => setForm({ ...form, swap_date: e.target.value })} />
                  </div>
                  {form.type === 'tukar_shift' && (
                    <div>
                      <label className="label">Shift Pengganti</label>
                      <select className="input" value={form.swap_shift_id}
                        onChange={e => setForm({ ...form, swap_shift_id: e.target.value })}>
                        <option value="">Pilih shift...</option>
                        {shifts.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Alasan */}
              <div>
                <label className="label">
                  Alasan / Keterangan {!isSwap && '*'}
                </label>
                <textarea className="input" rows={3}
                  placeholder={
                    form.type === 'sakit'       ? 'Contoh: Demam, istirahat atas saran dokter...' :
                    form.type === 'cuti'        ? 'Contoh: Cuti keluarga / keperluan pribadi...' :
                    form.type === 'tukar_shift' ? 'Opsional: alasan tukar shift...' :
                    form.type === 'tukar_libur' ? 'Opsional: alasan tukar libur...' :
                    'Jelaskan keperluan izin Anda...'
                  }
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Batal</button>
                <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <><div className="spinner" />Mengirim...</> : '📤 Kirim Pengajuan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
