// pages/history.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'

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

export default function HistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
    try {
      const res = await fetch('/api/attendance/history?limit=50')
      const d = await res.json()
      setHistory(d.records || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const fmt     = iso => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
  const fmtDate = d   => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'long' })

  return (
    <>
      <Head><title>Riwayat Absensi — WorkForce</title></Head>
      <div className="min-h-screen bg-slate-50 font-body">
        {/* Header */}
        <div className="px-4 pt-10 pb-16 text-white" style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1e3a8a 100%)' }}>
          <div className="flex justify-between items-center max-w-md mx-auto mb-6">
            <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">← Kembali</Link>
          </div>
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold font-display">Riwayat Absensi</h1>
            <p className="text-blue-300 text-sm mt-1">Cek kehadiran Anda 30 hari terakhir</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-8 pb-10">
          <div className="card animate-slide-up">
            {loading ? (
              <div className="flex justify-center py-10"><div className="spinner spinner-blue" /></div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 text-slate-400">Belum ada riwayat absensi</div>
            ) : (
              <div className="space-y-4">
                {history.map(r => (
                  <div key={r.id} className="p-3 border-b border-slate-50 last:border-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{fmtDate(r.date)}</p>
                        <Badge status={r.status} />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total Kerja</p>
                        <p className="text-sm font-mono font-bold text-blue-600">
                          {r.check_in && r.check_out 
                            ? `${Math.floor((new Date(r.check_out) - new Date(r.check_in)) / 3600000)}j ${Math.floor(((new Date(r.check_out) - new Date(r.check_in)) % 3600000) / 60000)}m`
                            : '--'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-3">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Check In</p>
                        <p className="text-sm font-bold text-slate-700">{fmt(r.check_in)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Check Out</p>
                        <p className="text-sm font-bold text-slate-700">{fmt(r.check_out)}</p>
                      </div>
                    </div>
                    {r.overtime_minutes > 0 && (
                      <div className="mt-2 flex items-center justify-between text-xs text-amber-600 font-medium bg-amber-50 rounded-lg px-2 py-1.5 border border-amber-100">
                        <span>⏰ Lembur {Math.floor(r.overtime_minutes / 60)}j {r.overtime_minutes % 60}m</span>
                        <span>{r.overtime_approved ? '✓ Disetujui' : '⏳ Pending'}</span>
                      </div>
                    )}
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
