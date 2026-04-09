// pages/admin/requests.js
import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect } from 'react'

const TYPE_CONFIG = {
  izin:        { label: 'Izin',        icon: '📝', color: 'badge-yellow' },
  cuti:        { label: 'Cuti',        icon: '🏖️', color: 'badge-blue'   },
  sakit:       { label: 'Sakit',       icon: '🏥', color: 'badge-red'    },
  tukar_shift: { label: 'Tukar Shift', icon: '🔄', color: 'badge-purple' },
  tukar_libur: { label: 'Tukar Libur', icon: '📅', color: 'badge-orange' },
}

const STATUS_CONFIG = {
  pending:  { label: 'Menunggu',  cls: 'badge-yellow' },
  approved: { label: 'Disetujui', cls: 'badge-green'  },
  rejected: { label: 'Ditolak',   cls: 'badge-red'    },
}

function fmtDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminRequestsPage() {
  const [requests, setRequests]   = useState([])
  const [overtime, setOvertime]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('requests')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [reviewModal, setReviewModal]   = useState(null)
  const [reviewNote, setReviewNote]     = useState('')
  const [saving, setSaving]             = useState(false)

  useEffect(() => { fetchAll() }, [statusFilter])

  async function fetchAll() {
    setLoading(true)
    const [reqR, otR] = await Promise.all([
      fetch(`/api/admin/requests?status=${statusFilter}`).then(r => r.json()),
      fetch('/api/admin/overtime?status=pending').then(r => r.json()),
    ])
    setRequests(reqR.requests || [])
    setOvertime(otR.overtime || [])
    setLoading(false)
  }

  async function handleReview(status) {
    if (!reviewModal) return
    setSaving(true)
    await fetch(`/api/admin/requests/${reviewModal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, review_note: reviewNote }),
    })
    setSaving(false)
    setReviewModal(null)
    setReviewNote('')
    fetchAll()
  }

  async function handleOvertimeAction(id, status) {
    await fetch('/api/admin/overtime', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    fetchAll()
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">Pengajuan & Lembur</h1>

        {/* Tab switch */}
        <div className="flex gap-2">
          {[
            { key: 'requests', label: '📋 Pengajuan', badge: pendingCount },
            { key: 'overtime', label: '⏰ Lembur',    badge: overtime.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── REQUESTS TAB ── */}
        {tab === 'requests' && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {['pending', 'approved', 'rejected'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {s === 'pending' ? '⏳ Menunggu' : s === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="card flex justify-center py-16"><div className="spinner spinner-blue" /></div>
            ) : requests.length === 0 ? (
              <div className="card text-center py-16">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-slate-500">Tidak ada pengajuan</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map(req => {
                  const tc = TYPE_CONFIG[req.type] || { label: req.type, icon: '📄', color: 'badge-gray' }
                  const sc = STATUS_CONFIG[req.status] || { label: req.status, cls: 'badge-gray' }
                  const emp = req.employees
                  return (
                    <div key={req.id} className="card">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">{tc.icon}</div>
                          <div>
                            <p className="font-bold text-slate-900">{emp?.name || '-'}</p>
                            <p className="text-xs text-slate-400">{emp?.employee_code} · {emp?.department || '-'}</p>
                            {emp?.branches?.name && (
                              <p className="text-xs text-slate-400">🏢 {emp.branches.name} · {emp.branches.timezone || 'WIB'}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={sc.cls}>{sc.label}</span>
                          <p className="text-xs text-slate-400 mt-1">{fmtDate(req.created_at)}</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={tc.color}>{tc.label}</span>
                          <span className="text-sm text-slate-700 font-medium">
                            {fmtDate(req.start_date)}
                            {req.end_date && req.end_date !== req.start_date ? ` s/d ${fmtDate(req.end_date)}` : ''}
                          </span>
                        </div>
                        {req.reason && <p className="text-sm text-slate-600">{req.reason}</p>}
                        {req.swap_employee && (
                          <p className="text-xs text-slate-500">🔄 Tukar dengan: <strong>{req.swap_employee.name}</strong>
                            {req.swap_date ? ` · ${fmtDate(req.swap_date)}` : ''}
                            {req.swap_shift ? ` · Shift: ${req.swap_shift.name}` : ''}
                          </p>
                        )}
                      </div>

                      {req.review_note && (
                        <p className={`text-xs p-2 rounded-lg mb-3 ${req.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          💬 Catatan: {req.review_note} {req.reviewer ? `(${req.reviewer.name})` : ''}
                        </p>
                      )}

                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setReviewModal(req); setReviewNote('') }}
                            className="btn-primary text-xs flex-1 justify-center"
                          >
                            ✍️ Review
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── OVERTIME TAB ── */}
        {tab === 'overtime' && (
          <>
            <p className="text-slate-500 text-sm">{overtime.length} lembur menunggu persetujuan</p>
            {overtime.length === 0 ? (
              <div className="card text-center py-16">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-slate-500">Tidak ada lembur yang perlu disetujui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {overtime.map(ot => (
                  <div key={ot.id} className="card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-900">{ot.employees?.name || '-'}</p>
                        <p className="text-xs text-slate-400">{ot.employees?.employee_code} · {ot.employees?.department || '-'}</p>
                      </div>
                      <span className="badge-yellow">⏳ Menunggu</span>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-3 mb-3">
                      <p className="text-sm font-semibold text-amber-800">
                        ⏰ {Math.floor(ot.minutes / 60)}j {ot.minutes % 60}m lembur
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        📅 {fmtDate(ot.date)} · Multiplier {ot.multiplier}×
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOvertimeAction(ot.id, 'approved')}
                        className="btn-success text-xs flex-1 justify-center"
                      >
                        ✅ Setujui
                      </button>
                      <button
                        onClick={() => handleOvertimeAction(ot.id, 'rejected')}
                        className="btn-danger text-xs flex-1 justify-center"
                      >
                        ❌ Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setReviewModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="text-lg font-bold font-display">Review Pengajuan</h3>
              <button onClick={() => setReviewModal(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="modal-body">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="font-semibold text-slate-800">{reviewModal.employees?.name}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {TYPE_CONFIG[reviewModal.type]?.label} · {fmtDate(reviewModal.start_date)}
                  {reviewModal.end_date && reviewModal.end_date !== reviewModal.start_date ? ` s/d ${fmtDate(reviewModal.end_date)}` : ''}
                </p>
                {reviewModal.reason && <p className="text-sm text-slate-500 mt-2 italic">"{reviewModal.reason}"</p>}
              </div>
              <div>
                <label className="label">Catatan (opsional)</label>
                <textarea
                  className="input" rows={3}
                  placeholder="Tambahkan catatan untuk karyawan..."
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setReviewModal(null)} className="btn-secondary">Batal</button>
              <button onClick={() => handleReview('rejected')} disabled={saving} className="btn-danger">❌ Tolak</button>
              <button onClick={() => handleReview('approved')} disabled={saving} className="btn-success">✅ Setujui</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

AdminRequestsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>
