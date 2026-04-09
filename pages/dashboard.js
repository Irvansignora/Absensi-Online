// pages/dashboard.js
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const FaceRecognition = dynamic(() => import('../components/FaceRecognition'), { ssr: false })

// Clock menampilkan jam sesuai timezone cabang karyawan
function Clock({ timezoneOffset, timezoneLabel }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Konversi ke timezone cabang jika ada, fallback ke local
  const displayTime = timezoneOffset != null
    ? new Date(time.getTime() + (timezoneOffset - (-time.getTimezoneOffset() / 60)) * 3600 * 1000)
    : time

  return (
    <div className="text-center">
      <div className="text-5xl font-bold text-white tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {displayTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-blue-200 text-sm mt-1.5">
        {displayTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
      {timezoneLabel && (
        <div className="mt-1">
          <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full font-mono">
            🕐 {timezoneLabel}
          </span>
        </div>
      )}
    </div>
  )
}

function Badge({ status }) {
  const map = {
    present:  { label: 'Hadir',         cls: 'badge-green'  },
    late:     { label: 'Terlambat',     cls: 'badge-yellow' },
    absent:   { label: 'Absen',         cls: 'badge-red'    },
    half_day: { label: 'Setengah Hari', cls: 'badge-orange' },
    leave:    { label: 'Izin/Cuti',     cls: 'badge-blue'   },
  }
  const s = map[status] || { label: status, cls: 'badge-gray' }
  return <span className={s.cls}>{s.label}</span>
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser]                     = useState(null)
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [history, setHistory]               = useState([])
  const [loading, setLoading]               = useState(false)
  const [note, setNote]                     = useState('')
  const [msg, setMsg]                       = useState({ type: '', text: '' })
  const [coords, setCoords]                 = useState(null)
  const [locLoading, setLocLoading]         = useState(false)
  const [faceMode, setFaceMode]             = useState(null)
  const [faceVerified, setFaceVerified]     = useState(false)
  const [facePhotoUrl, setFacePhotoUrl]     = useState(null)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [lastOvertime, setLastOvertime]     = useState(null)
  const pendingModeRef                      = useRef(null)

  useEffect(() => { fetchUser(); fetchToday(); fetchHistory(); fetchPendingRequests() }, [])

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
    const records = d.records || []
    setHistory(records)
    // Ambil lembur terakhir
    const withOT = records.find(r => r.overtime_minutes > 0)
    if (withOT) setLastOvertime(withOT)
  }

  async function fetchPendingRequests() {
    const res = await fetch('/api/requests')
    const d = await res.json()
    const pending = (d.requests || []).filter(r => r.status === 'pending').length
    setPendingRequests(pending)
  }

  async function getLocation() {
    setLocLoading(true)
    return new Promise((resolve) => {
      if (!navigator.geolocation) { setLocLoading(false); resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => { const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setCoords(c); setLocLoading(false); resolve(c) },
        () => { setLocLoading(false); resolve(null) },
        { timeout: 8000 }
      )
    })
  }

  function startCheckIn()  { pendingModeRef.current = 'checkin';  setFaceMode('checkin');  setMsg({ type: '', text: '' }) }
  function startCheckOut() { pendingModeRef.current = 'checkout'; setFaceMode('checkout'); setMsg({ type: '', text: '' }) }

  async function handleFaceVerified({ snapshot, photoUrl }) {
    const mode = pendingModeRef.current
    setFaceMode(null)
    setFaceVerified(true)
    if (photoUrl) setFacePhotoUrl(photoUrl)
    const loc = await getLocation()
    if (mode === 'checkin') await doCheckIn(loc, true, photoUrl)
    else await doCheckOut(loc, true, photoUrl)
  }

  async function handleFaceSkip() {
    const mode = pendingModeRef.current
    setFaceMode(null)
    const loc = await getLocation()
    if (mode === 'checkin') await doCheckIn(loc, false, null)
    else await doCheckOut(loc, false, null)
  }

  async function doCheckIn(loc, faceOk, photoUrl) {
    setLoading(true)
    try {
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, latitude: loc?.lat, longitude: loc?.lng, face_verified: faceOk, face_photo_url: photoUrl || null }),
      })
      const d = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: d.error }) }
      else { setMsg({ type: 'success', text: '✅ Check-in berhasil!' + (faceOk ? ' Wajah terverifikasi 🤖' : '') }); setNote(''); fetchToday() }
    } catch { setMsg({ type: 'error', text: 'Gagal check-in, coba lagi' }) }
    setLoading(false)
  }

  async function doCheckOut(loc, faceOk, photoUrl) {
    setLoading(true)
    try {
      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, latitude: loc?.lat, longitude: loc?.lng, face_verified: faceOk, face_photo_url: photoUrl || null }),
      })
      const d = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: d.error }) }
      else {
        // Tampilkan info lembur jika ada
        const otMsg = d.overtime_minutes > 0
          ? ` ⏰ Lembur ${Math.floor(d.overtime_minutes / 60)}j${d.overtime_minutes % 60}m tercatat!`
          : ''
        setMsg({ type: 'success', text: d.message + otMsg })
        setNote('')
        setFaceVerified(false)
        setFacePhotoUrl(null)
        fetchToday()
        fetchHistory()
      }
    } catch { setMsg({ type: 'error', text: 'Gagal check-out, coba lagi' }) }
    setLoading(false)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const fmt     = iso => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
  const fmtDate = d   => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  const workMins = todayAttendance?.check_in && todayAttendance?.check_out
    ? Math.floor((new Date(todayAttendance.check_out) - new Date(todayAttendance.check_in)) / 60000) : null

  // Timezone dari branch user
  const tzOffset = user?.branch_timezone_offset ?? null
  const tzLabel  = user?.branch_timezone ?? null

  return (
    <>
      <Head><title>Absensi — AbsensiPro</title></Head>

      {faceMode && (
        <FaceRecognition mode={faceMode} onVerified={handleFaceVerified} onSkip={handleFaceSkip} />
      )}

      <div className="min-h-screen bg-slate-50 font-body">

        {/* Header */}
        <div className="px-4 pt-10 pb-16 text-center text-white"
          style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1e3a8a 100%)' }}>
          <div className="flex justify-between items-center max-w-md mx-auto mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">A</div>
              <span className="text-white font-bold font-display">AbsensiPro</span>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm">🚪 Logout</button>
          </div>

          <Clock timezoneOffset={tzOffset} timezoneLabel={tzLabel} />

          {user && (
            <div className="mt-4">
              <p className="text-xl font-bold font-display">Halo, {user.name}! 👋</p>
              <p className="text-blue-300 mt-1 text-xs">
                {user.branch_name && `🏢 ${user.branch_name}`}
                {user.shift_name  && ` · ⏰ ${user.shift_name} (${user.shift_start}–${user.shift_end})`}
              </p>
            </div>
          )}

          {/* Quick action shortcuts */}
          <div className="max-w-md mx-auto mt-5 grid grid-cols-3 gap-2">
            <Link href="/requests"
              className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 rounded-xl py-3 px-2 transition-all">
              <span className="text-xl">📝</span>
              <span className="text-xs text-blue-200 font-medium">Pengajuan</span>
              {pendingRequests > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 leading-5 font-bold">{pendingRequests}</span>
              )}
            </Link>
            <Link href="/requests?tab=leave"
              className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 rounded-xl py-3 px-2 transition-all">
              <span className="text-xl">🏖️</span>
              <span className="text-xs text-blue-200 font-medium">Cuti/Izin</span>
            </Link>
            <Link href="/requests?tab=overtime"
              className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 rounded-xl py-3 px-2 transition-all">
              <span className="text-xl">⏰</span>
              <span className="text-xs text-blue-200 font-medium">Lembur</span>
            </Link>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-8 pb-10 space-y-4">

          {/* Card absensi hari ini */}
          <div className="card animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-display">Status Hari Ini</h2>
              {todayAttendance?.status && <Badge status={todayAttendance.status} />}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Check In',  val: fmt(todayAttendance?.check_in),  dot: 'bg-green-500', show: !!todayAttendance?.check_in },
                { label: 'Check Out', val: fmt(todayAttendance?.check_out), dot: 'bg-red-500',   show: !!todayAttendance?.check_out },
                { label: 'Jam Kerja', val: workMins !== null ? `${Math.floor(workMins/60)}j${workMins%60}m` : '--', dot: null, show: false },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-mono font-bold text-slate-800">{item.val}</div>
                  <div className="text-xs text-slate-500 mt-1">{item.label}</div>
                  {item.show && <div className={`status-dot ${item.dot} mx-auto mt-1.5`} />}
                </div>
              ))}
            </div>

            {/* Overtime today badge */}
            {todayAttendance?.overtime_minutes > 0 && (
              <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <span>⏰</span>
                <div>
                  <p className="text-amber-700 text-sm font-medium">
                    Lembur {Math.floor(todayAttendance.overtime_minutes / 60)}j{todayAttendance.overtime_minutes % 60}m tercatat
                  </p>
                  <p className="text-amber-500 text-xs">
                    {todayAttendance.overtime_approved ? '✅ Sudah disetujui' : '⏳ Menunggu persetujuan admin'}
                  </p>
                </div>
              </div>
            )}

            {/* Face verified badge */}
            {faceVerified && (
              <div className="mb-3 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                {facePhotoUrl
                  ? <img src={facePhotoUrl} alt="Foto wajah" className="w-10 h-10 rounded-lg object-cover border border-emerald-300" />
                  : <span>🤖</span>
                }
                <div>
                  <p className="text-emerald-700 text-sm font-medium">Wajah terverifikasi oleh AI</p>
                  {facePhotoUrl && <p className="text-emerald-500 text-xs">📸 Foto tersimpan di cloud</p>}
                </div>
              </div>
            )}

            <input
              className="input text-sm mb-3"
              placeholder="Catatan (opsional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={!!todayAttendance?.check_out}
            />

            {coords && (
              <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
                📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}

            {msg.text && (
              <div className={`mb-3 p-3 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {msg.text}
              </div>
            )}

            {!todayAttendance?.check_in ? (
              <button onClick={startCheckIn} disabled={loading} className="btn-success btn-lg w-full justify-center">
                {loading ? <><div className="spinner" />Memproses...</> : '🤖 SCAN WAJAH & CHECK IN'}
              </button>
            ) : !todayAttendance?.check_out ? (
              <button onClick={startCheckOut} disabled={loading} className="btn-danger btn-lg w-full justify-center"
                style={{ background: '#dc2626' }}>
                {loading ? <><div className="spinner" />Memproses...</> : '🤖 SCAN WAJAH & CHECK OUT'}
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-800 text-sm font-medium">
                ✅ Absensi hari ini sudah lengkap. Sampai jumpa besok!
              </div>
            )}

            {!todayAttendance?.check_out && (
              <p className="text-center text-xs text-slate-400 mt-2">
                🔒 Verifikasi wajah AI · Bisa dilewati jika kamera tidak tersedia
              </p>
            )}
          </div>

          {/* Shortcut pengajuan */}
          <div className="card animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold font-display">Pengajuan Cepat</h2>
              <Link href="/requests" className="text-xs text-blue-600 font-medium hover:underline">Lihat semua →</Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/requests', label: '📝 Izin',        desc: 'Ajukan izin tidak masuk' },
                { href: '/requests', label: '🏖️ Cuti',         desc: 'Ajukan cuti tahunan' },
                { href: '/requests', label: '🏥 Sakit',        desc: 'Lapor tidak masuk sakit' },
                { href: '/requests', label: '🔄 Tukar Shift',  desc: 'Tukar shift dengan rekan' },
              ].map(item => (
                <Link key={item.label} href={item.href}
                  className="border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl p-3 transition-all">
                  <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Riwayat absensi */}
          <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-lg font-bold font-display mb-3">Riwayat Absensi</h2>
            {history.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">Belum ada riwayat</p>
            ) : history.map(r => (
              <div key={r.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{fmtDate(r.date)}</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    {fmt(r.check_in)} → {fmt(r.check_out)}
                    {r.check_in && r.check_out && ` · ${Math.floor((new Date(r.check_out) - new Date(r.check_in)) / 3600000)}j`}
                  </p>
                  {r.overtime_minutes > 0 && (
                    <p className="text-xs text-amber-500 mt-0.5">
                      ⏰ Lembur {Math.floor(r.overtime_minutes / 60)}j{r.overtime_minutes % 60}m
                      {r.overtime_approved ? ' ✅' : ' ⏳'}
                    </p>
                  )}
                </div>
                <Badge status={r.status} />
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}
