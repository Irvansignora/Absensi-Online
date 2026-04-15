// pages/admin/index.js — Feature 4: Analytics Dashboard
import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect } from 'react'
import Link from 'next/link'

function StatCard({ icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600',
    yellow: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600',
    purple: 'bg-violet-50 text-violet-600', orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <div className="stat-card animate-slide-up">
      <div className={`stat-icon ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold font-display text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function MiniBar({ label, value, max, color = '#3b82f6' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-slate-600 mb-1">
        <span className="truncate max-w-[140px]">{label}</span>
        <span className="font-bold ml-2">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function TrendChart({ data }) {
  if (!data?.length) return <div className="text-center text-slate-400 py-8 text-sm">Belum ada data</div>
  const max = Math.max(...data.map(d => d.present + d.late + d.absent), 1)
  const recent = data.slice(-14)

  return (
    <div className="mt-2">
      <div className="flex items-end gap-1 h-24">
        {recent.map((d, i) => {
          const total = d.present + d.late + d.absent
          const h = total > 0 ? Math.round((total / max) * 88) : 4
          const pctLate = total > 0 ? (d.late / total) * 100 : 0
          const date = new Date(d.date)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${total} orang`}>
              <div className="w-full rounded-t overflow-hidden flex flex-col justify-end" style={{ height: '88px' }}>
                {total > 0 && (
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${h}px`,
                      background: isWeekend ? '#e2e8f0' : pctLate > 30 ? '#f59e0b' : '#3b82f6',
                      opacity: isWeekend ? 0.5 : 1,
                    }}
                  />
                )}
              </div>
              {i % 3 === 0 && (
                <span className="text-[9px] text-slate-400">
                  {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Hadir</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> Banyak terlambat</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-200 inline-block" /> Akhir pekan</span>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats]       = useState(null)
  const [todayList, setTodayList] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [analyticsTab, setAnalyticsTab] = useState('trend')

  const now   = new Date()
  const today = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/reports?type=today-summary').then(r => r.json()),
      fetch(`/api/admin/analytics?year=${now.getFullYear()}&month=${now.getMonth()+1}`).then(r => r.json()),
    ]).then(([d, a]) => {
      setStats(d.stats)
      setTodayList(d.records || [])
      setAnalytics(a)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'

  const Badge = ({ status }) => {
    const map = {
      present: ['Hadir', 'badge-green'], late: ['Terlambat', 'badge-yellow'],
      absent: ['Absen', 'badge-red'], leave: ['Izin', 'badge-blue'], half_day: ['½ Hari', 'badge-orange'],
    }
    const [lbl, cls] = map[status] || [status, 'badge-gray']
    return <span className={cls}>{lbl}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">{today}</p>
        </div>
        {analytics?.streakAlerts?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <span>🚨</span>
            <span><strong>{analytics.streakAlerts.length}</strong> karyawan absen 3+ hari berturut-turut</span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="👥" label="Karyawan Aktif"    value={loading ? '...' : stats?.total_employees ?? 0} color="blue" />
        <StatCard icon="✅" label="Hadir Hari Ini"    value={loading ? '...' : stats?.present_today ?? 0} sub={`dari ${stats?.total_employees ?? 0}`} color="green" />
        <StatCard icon="⚠️" label="Terlambat"         value={loading ? '...' : stats?.late_today ?? 0} color="yellow" />
        <StatCard icon="❌" label="Absen"             value={loading ? '...' : stats?.absent_today ?? 0} color="red" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="🏢" label="Cabang"            value={loading ? '...' : stats?.total_branches ?? 0} color="purple" />
        <StatCard icon="🕐" label="Shift"             value={loading ? '...' : stats?.total_shifts ?? 0} color="blue" />
        <StatCard icon="📈" label="Rate Bulan Ini"    value={loading ? '...' : `${stats?.monthly_attendance_rate ?? 0}%`} sub="rata-rata kehadiran" color="green" />
      </div>

      {/* Analytics Tabs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 font-display">📊 Analitik</h2>
          <div className="flex gap-1 text-xs">
            {[
              { key: 'trend',  label: 'Trend 30 Hari' },
              { key: 'dept',   label: 'Per Dept' },
              { key: 'branch', label: 'Per Cabang' },
              { key: 'late',   label: 'Top Terlambat' },
            ].map(t => (
              <button key={t.key} onClick={() => setAnalyticsTab(t.key)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${analyticsTab === t.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner spinner-blue" /></div>
        ) : analyticsTab === 'trend' ? (
          <TrendChart data={analytics?.trend30} />
        ) : analyticsTab === 'dept' ? (
          <div className="space-y-2">
            {(analytics?.byDepartment || []).slice(0, 8).map(d => (
              <div key={d.department} className="flex items-center gap-3">
                <div className="w-28 text-xs text-slate-600 truncate">{d.department}</div>
                <div className="flex-1">
                  <MiniBar label="" value={d.present + d.late} max={d.total} color="#10b981" />
                </div>
                <span className="text-xs font-bold text-slate-700 w-8 text-right">{d.rate}%</span>
              </div>
            ))}
          </div>
        ) : analyticsTab === 'branch' ? (
          <div className="space-y-3">
            {(analytics?.byBranch || []).map(b => (
              <div key={b.branch}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{b.branch}</span>
                  <span className="font-bold">{b.rate}% hadir</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${b.total > 0 ? b.present/b.total*100 : 0}%` }} />
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${b.total > 0 ? b.late/b.total*100 : 0}%` }} />
                  <div className="h-full bg-red-400 transition-all" style={{ width: `${b.total > 0 ? b.absent/b.total*100 : 0}%` }} />
                </div>
                <div className="flex gap-3 text-[10px] text-slate-500 mt-1">
                  <span>✅ {b.present} hadir</span>
                  <span>⚠️ {b.late} terlambat</span>
                  <span>❌ {b.absent} absen</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {analytics?.topLate?.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">Tidak ada data keterlambatan bulan ini 🎉</p>
            ) : (
              <div className="space-y-2">
                {(analytics?.topLate || []).map((e, i) => (
                  <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-red-100 text-red-600' : i === 1 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{e.name}</p>
                      <p className="text-xs text-slate-400">{e.department}</p>
                    </div>
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {e.count}x terlambat
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alert: Absen berturut-turut */}
      {analytics?.streakAlerts?.length > 0 && (
        <div className="card border border-red-200">
          <h3 className="font-bold text-red-700 mb-3">🚨 Alert — Absen 3+ Hari Berturut-turut</h3>
          <div className="space-y-2">
            {analytics.streakAlerts.map(e => (
              <div key={e.employee_id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-800">{e.name}</p>
                  <p className="text-xs text-slate-500">{e.department}</p>
                </div>
                <span className="text-red-600 font-bold text-sm">{e.streak} hari</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daftar hadir hari ini */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 font-display">Absensi Hari Ini</h2>
          <Link href="/admin/reports" className="text-xs text-blue-600 hover:underline">Lihat semua →</Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="spinner spinner-blue" /></div>
        ) : todayList.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Belum ada absensi hari ini</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left pb-2 font-medium">Karyawan</th>
                  <th className="text-left pb-2 font-medium">Check In</th>
                  <th className="text-left pb-2 font-medium">Check Out</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {todayList.slice(0, 10).map(r => (
                  <tr key={r.id}>
                    <td className="py-2.5">
                      <p className="font-medium text-slate-800">{r.employees?.name}</p>
                      <p className="text-xs text-slate-400">{r.employees?.department}</p>
                    </td>
                    <td className="py-2.5 font-mono text-xs">{fmt(r.check_in)}</td>
                    <td className="py-2.5 font-mono text-xs">{fmt(r.check_out)}</td>
                    <td className="py-2.5"><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {todayList.length > 10 && (
              <p className="text-center text-xs text-slate-400 mt-3">+{todayList.length - 10} lainnya</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

AdminDashboard.getLayout = (page) => <AdminLayout>{page}</AdminLayout>
