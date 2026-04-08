import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="text-center">
      <div className="text-6xl font-mono font-bold text-white tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-blue-200 text-lg mt-2">
        {time.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  )
}

function Badge({ status }) {
  const map = {
    present: { label: 'Hadir', cls: 'badge-green' },
    late: { label: 'Terlambat', cls: 'badge-yellow' },
    absent: { label: 'Absen', cls: 'badge-red' },
    half_day: { label: 'Setengah Hari', cls: 'badge-orange' },
    leave: { label: 'Izin/Cuti', cls: 'badge-blue' },
  }
  const s = map[status] || { label: status, cls: 'badge-gray' }
  return <span className={s.cls}>{s.label}</span>
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [locLoading, setLocLoading] = useState(false)
  const [coords, setCoords] = useState(null)

  useEffect(() => {
    fetchUser()
    fetchToday()
    fetchHistory()
  }, [])

  async function fetchUser() {
    const res = await fetch('/api/auth/me')
    const d = await res.json()
    if (d.error) { router.push('/'); return }
    if (['admin', 'hr'].includes(d.user.role)) { router.push('/admin'); return }
    setUser(d.user)
  }

  async function fetchToday() {
    const res = await fetch('/api/attendance/today')
    const d = await res.json()
    setTodayAttendance(d.attendance)
  }

  async function fetchHistory() {
    const res = await fetch('/api/attendance/history?limit=10')
    const d = await res.json()
    setHistory(d.records || [])
  }

  async function getLocation() {
    setLocLoading(true)
    return new Promise((resolve) => {
      if (!navigator.geolocation) { setLocLoading(false); resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }) },
        () => { setLocLoading(false); resolve(null) }
      )
    })
  }

  async function handleCheckIn() {
    setLoading(true)
    setMsg({ type: '', text: '' })
    const loc = await getLocation()
    try {
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, latitude: loc?.lat, longitude: loc?.lng }),
      })
      const d = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: d.error }); setLoading(false); return }
      setMsg({ type: 'success', text: '✅ Check-in berhasil!' })
      setNote('')
      fetchToday()
    } catch { setMsg({ type: 'error', text: 'Gagal check-in' }) }
    setLoading(false)
  }

  async function handleCheckOut() {
    setLoading(true)
    setMsg({ type: '', text: '' })
    const loc = await getLocation()
    try {
      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, latitude: loc?.lat, longitude: loc?.lng }),
      })
      const d = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: d.error }); setLoading(false); return }
      setMsg({ type: 'success', text: '✅ Check-out berhasil!' })
      setNote('')
      fetchToday()
      fetchHistory()
    } catch { setMsg({ type: 'error', text: 'Gagal check-out' }) }
    setLoading(false)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
  const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  const workMins = todayAttendance?.check_in && todayAttendance?.check_out
    ? Math.floor((new Date(todayAttendance.check_out) - new Date(todayAttendance.check_in)) / 60000)
    : null

  return (
    <>
      <Head><title>Dashboard Karyawan - AbsensiPro</title></Head>
      <div className="min-h-screen bg-slate-50 font-body">
        {/* Hero header */}
        <div className="px-4 py-10 text-center text-white" style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1e3a8a 100%)' }}>
          <div className="flex justify-between items-center max-w-2xl mx-auto mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold font-display text-sm">A</div>
              <span className="text-white font-bold font-display">AbsensiPro</span>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm transition-colors">🚪 Logout</button>
          </div>
          <Clock />
          {user && (
            <div className="mt-6">
              <p className="text-2xl font-bold font-display">Halo, {user.name}! 👋</p>
              <p className="text-blue-200 mt-1 text-sm">
                {user.branch_name && `🏢 ${user.branch_name}`}
                {user.shift_name && ` · ⏰ Shift ${user.shift_name} (${user.shift_start}–${user.shift_end})`}
              </p>
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto px-4 -mt-6 pb-10 space-y-5">
          {/* Today status card */}
          <div className="card animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-display">Status Hari Ini</h2>
              {todayAttendance?.status && <Badge status={todayAttendance.status} />}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-mono font-bold text-slate-800">{fmt(todayAttendance?.check_in)}</div>
                <div className="text-xs text-slate-500 mt-1">Check In</div>
                {todayAttendance?.check_in && <div className="status-dot bg-green-500 mx-auto mt-2" />}
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-mono font-bold text-slate-800">{fmt(todayAttendance?.check_out)}</div>
                <div className="text-xs text-slate-500 mt-1">Check Out</div>
                {todayAttendance?.check_out && <div className="status-dot bg-red-500 mx-auto mt-2" />}
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-mono font-bold text-blue-700">
                  {workMins !== null ? `${Math.floor(workMins / 60)}j ${workMins % 60}m` : '--'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Jam Kerja</div>
              </div>
            </div>

            {/* Note input */}
            <div className="mb-4">
              <input
                className="input text-sm"
                placeholder="Catatan (opsional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                disabled={!!todayAttendance?.check_out}
              />
            </div>

            {/* GPS status */}
            {coords && (
              <div className="mb-3 text-xs text-slate-500 flex items-center gap-1">
                <span>📍</span> GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            )}

            {/* Action button */}
            {msg.text && (
              <div className={`mb-3 p-3 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {msg.text}
              </div>
            )}

            {!todayAttendance?.check_in ? (
              <button onClick={handleCheckIn} disabled={loading || locLoading} className="btn-success btn-lg w-full justify-center">
                {loading ? <><div className="spinner" />Memproses...</> : '✅ CHECK IN SEKARANG'}
              </button>
            ) : !todayAttendance?.check_out ? (
              <button onClick={handleCheckOut} disabled={loading || locLoading} className="btn-danger btn-lg w-full justify-center">
                {loading ? <><div className="spinner spinner-blue" />Memproses...</> : '🚪 CHECK OUT'}
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-800 text-sm font-medium">
                ✅ Absensi hari ini sudah lengkap. Sampai jumpa besok!
              </div>
            )}
          </div>

          {/* History */}
          <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-lg font-bold font-display mb-4">Riwayat Absensi</h2>
            {history.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">Belum ada riwayat absensi</p>
            ) : (
              <div className="space-y-2">
                {history.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{fmtDate(r.date)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Masuk: {fmt(r.check_in)} · Keluar: {fmt(r.check_out)}
                        {r.check_in && r.check_out && ` · ${Math.floor((new Date(r.check_out) - new Date(r.check_in)) / 3600000)}j kerja`}
                      </p>
                    </div>
                    <Badge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
