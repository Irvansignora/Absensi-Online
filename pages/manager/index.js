// pages/manager/index.js — Feature 9: Manager Dashboard
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'

const ATTENDANCE_BADGE = {
  present:  ['✅ Hadir',         'badge-green'],
  late:     ['⚠️ Terlambat',     'badge-yellow'],
  absent:   ['❌ Absen',         'badge-red'],
  half_day: ['🌓 ½ Hari',        'badge-orange'],
  leave:    ['🏖️ Izin/Cuti',    'badge-blue'],
}

const REQ_STATUS = {
  pending:  ['⏳ Menunggu',  'badge-yellow'],
  approved: ['✅ Disetujui', 'badge-green'],
  rejected: ['❌ Ditolak',   'badge-red'],
}
const TYPE_LABEL = { izin: 'Izin', cuti: 'Cuti', sakit: 'Sakit', tukar_shift: 'Tukar Shift' }

function fmtTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ManagerDashboard() {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [team, setTeam]         = useState([])
  const [attendances, setAtt]   = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('attendance')
  const [reqFilter, setReqFilter] = useState('pending')
  const [reviewModal, setReviewModal] = useState(null)
  const [reviewNote, setReviewNote]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error || !['admin', 'hr', 'manager'].includes(d.user?.role)) {
        router.push('/')
        return
      }
      setUser(d.user)
      fetchAll()
    })
  }, [])

  useEffect(() => {
    if (user) fetchAttendance()
  }, [selectedDate, user])

  useEffect(() => {
    if (user) fetchRequests()
  }, [reqFilter, user])

  async function fetchAll() {
    await Promise.all([fetchAttendance(), fetchRequests()])
    setLoading(false)
  }

  async function fetchAttendance() {
    const r = await fetch(`/api/manager/team?type=attendance&date=${selectedDate}`)
    const d = await r.json()
    setTeam(d.team || [])
    setAtt(d.attendances || [])
  }

  async function fetchRequests() {
    const r = await fetch(`/api/manager/team?type=requests&status=${reqFilter}`)
    const d = await r.json()
    setRequests(d.requests || [])
  }

  async function handleReview(status) {
    if (!reviewModal) return
    setSaving(true)
    const res = await fetch(`/api/admin/requests/${reviewModal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, review_note: reviewNote }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg(d.error); return }
    setReviewModal(null)
    setReviewNote('')
    fetchRequests()
  }

  // Summary stats dari attendance hari ini
  const summary = {
    total:   team.length,
    present: attendances.filter(a => ['present', 'half_day'].includes(a.status)).length,
    late:    attendances.filter(a => a.status === 'late').length,
    absent:  team.filter(e => !attendances.find(a => a.employee_id === e.id)).length,
    leave:   attendances.filter(a => a.status === 'leave').length,
  }
  const pendingCount = requests.filter(r => r.status === 'pending').length

  function getAtt(empId) {
    return attendances.find(a => a.employee_id === empId) || null
  }

  return (
    <>
      <Head><title>Manager Dashboard — WorkForce</title></Head>
      <div className="min-h-screen bg-slate-50 font-body">
        {/* Header */}
        <div className="px-4 pt-10 pb-20 text-white" style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1e3a8a 100%)' }}>
          <div className="max-w-2xl mx-auto flex items-center justify-between mb-6">
            <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">← Absensi</Link>
            <span className="text-white font-semibold text-sm font-display">Manager Dashboard</span>
            <Link href="/profile" className="text-slate-400 hover:text-white text-sm">Profil →</Link>
          </div>

          <div className="max-w-2xl mx-auto">
            <p className="text-blue-300 text-sm">Halo, {user?.name} 👋</p>
            <h1 className="text-2xl font-bold font-display mt-1">Tim Saya</h1>

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              {[
                { lbl: 'Total',    val: summary.total,   cls: 'bg-white/10' },
                { lbl: 'Hadir',    val: summary.present, cls: 'bg-emerald-500/20' },
                { lbl: 'Terlambat',val: summary.late,    cls: 'bg-amber-500/20' },
                { lbl: 'Absen',    val: summary.absent,  cls: 'bg-red-500/20' },
              ].map(({ lbl, val, cls }) => (
                <div key={lbl} className={`${cls} rounded-xl p-3 text-center backdrop-blur`}>
                  <div className="text-2xl font-bold text-white">{val}</div>
                  <div className="text-xs text-blue-200 mt-0.5">{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 -mt-8 pb-10 space-y-4">
          {/* Tabs */}
          <div className="card p-1.5">
            <div className="flex gap-1">
              {[
                { key: 'attendance', label: '📋 Kehadiran Tim' },
                { key: 'requests',   label: `📝 Pengajuan${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 text-sm py-2 rounded-lg font-medium transition-all ${tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {msg && (
            <div className="p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">{msg}</div>
          )}

          {/* Attendance Tab */}
          {tab === 'attendance' && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-800">Kehadiran Tim</h2>
                <input type="date" className="input text-sm py-1.5 w-36"
                  value={selectedDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setSelectedDate(e.target.value)} />
              </div>

              {loading ? (
                <div className="flex justify-center py-8"><div className="spinner spinner-blue" /></div>
              ) : team.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <div className="text-4xl mb-2">👥</div>
                  <p>Belum ada anggota tim</p>
                  <p className="text-xs mt-1">Minta admin untuk mengatur manager_id karyawan</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {team.map(emp => {
                    const att = getAtt(emp.id)
                    const [statusLabel, statusCls] = att
                      ? (ATTENDANCE_BADGE[att.status] || [att.status, 'badge-gray'])
                      : ['❓ Belum Absen', 'badge-gray']

                    return (
                      <div key={emp.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.department} · {emp.shifts?.name}</p>
                          {att && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {att.check_in ? `Masuk ${fmtTime(att.check_in)}` : ''}
                              {att.check_out ? ` · Keluar ${fmtTime(att.check_out)}` : ''}
                            </p>
                          )}
                        </div>
                        <span className={statusCls}>{statusLabel}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Requests Tab */}
          {tab === 'requests' && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-800">Pengajuan Tim</h2>
                <div className="flex gap-1">
                  {['pending', 'approved', 'rejected', ''].map((s, i) => (
                    <button key={i} onClick={() => setReqFilter(s)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${reqFilter === s ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                      {s === '' ? 'Semua' : s === 'pending' ? 'Menunggu' : s === 'approved' ? 'Disetujui' : 'Ditolak'}
                    </button>
                  ))}
                </div>
              </div>

              {requests.length === 0 ? (
                <div className="text-center py-10 text-slate-400">Tidak ada pengajuan</div>
              ) : (
                <div className="space-y-2">
                  {requests.map(r => {
                    const [statusLabel, statusCls] = REQ_STATUS[r.status] || [r.status, 'badge-gray']
                    return (
                      <div key={r.id} className="p-3 border border-slate-200 rounded-xl">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{r.employees?.name}</p>
                            <p className="text-xs text-slate-400">{r.employees?.department}</p>
                          </div>
                          <span className={statusCls}>{statusLabel}</span>
                        </div>
                        <div className="text-sm text-slate-700 mb-1">
                          <span className="font-medium">{TYPE_LABEL[r.type] || r.type}</span>
                          {' · '}
                          <span className="text-slate-500">{fmtDate(r.start_date)}{r.end_date && r.end_date !== r.start_date ? ` s/d ${fmtDate(r.end_date)}` : ''}</span>
                        </div>
                        {r.reason && <p className="text-xs text-slate-500 mb-2">"{r.reason}"</p>}

                        {r.status === 'pending' && (
                          <button onClick={() => { setReviewModal(r); setReviewNote('') }}
                            className="btn-primary text-xs py-1.5 w-full justify-center">
                            Review Pengajuan
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Review Modal */}
        {reviewModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-lg font-display">Review Pengajuan</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {TYPE_LABEL[reviewModal.type] || reviewModal.type} dari {reviewModal.employees?.name}
                </p>
                <p className="text-sm text-slate-600 mt-0.5">{fmtDate(reviewModal.start_date)}{reviewModal.end_date && reviewModal.end_date !== reviewModal.start_date ? ` s/d ${fmtDate(reviewModal.end_date)}` : ''}</p>
                {reviewModal.reason && <p className="text-sm text-slate-500 mt-1 italic">"{reviewModal.reason}"</p>}
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="label">Catatan (opsional)</label>
                  <textarea className="input resize-none h-20" value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    placeholder="Tambahkan catatan untuk karyawan..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleReview('rejected')} disabled={saving}
                    className="py-2.5 rounded-xl font-semibold text-sm border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                    ❌ Tolak
                  </button>
                  <button onClick={() => handleReview('approved')} disabled={saving}
                    className="btn-primary justify-center">
                    {saving ? '⏳...' : '✅ Setujui'}
                  </button>
                </div>
                <button onClick={() => setReviewModal(null)} className="w-full text-center text-sm text-slate-400 hover:text-slate-600">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
