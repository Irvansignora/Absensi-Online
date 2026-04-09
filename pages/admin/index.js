import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect } from 'react'

function StatCard({ icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    yellow: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-violet-50 text-violet-600',
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

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [todayList, setTodayList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/reports?type=today-summary')
      .then(r => r.json())
      .then(d => { setStats(d.stats); setTodayList(d.records || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const Badge = ({ status }) => {
    const map = { present: ['Hadir', 'badge-green'], late: ['Terlambat', 'badge-yellow'], absent: ['Absen', 'badge-red'], leave: ['Izin', 'badge-blue'], half_day: ['½ Hari', 'badge-orange'] }
    const [lbl, cls] = map[status] || [status, 'badge-gray']
    return <span className={cls}>{lbl}</span>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">Dashboard</h1>
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="👥" label="Total Karyawan Aktif" value={loading ? '...' : stats?.total_employees ?? 0} color="blue" />
          <StatCard icon="✅" label="Hadir Hari Ini" value={loading ? '...' : stats?.present_today ?? 0} sub={`dari ${stats?.total_employees ?? 0} karyawan`} color="green" />
          <StatCard icon="⚠️" label="Terlambat" value={loading ? '...' : stats?.late_today ?? 0} color="yellow" />
          <StatCard icon="❌" label="Absen" value={loading ? '...' : stats?.absent_today ?? 0} color="red" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard icon="🏢" label="Jumlah Cabang" value={loading ? '...' : stats?.total_branches ?? 0} color="purple" />
          <StatCard icon="🕐" label="Jumlah Shift" value={loading ? '...' : stats?.total_shifts ?? 0} color="blue" />
          <StatCard icon="📈" label="Kehadiran Bulan Ini" value={loading ? '...' : `${stats?.monthly_attendance_rate ?? 0}%`} sub="rata-rata kehadiran" color="green" />
        </div>

        {/* Today's attendance */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold font-display">Absensi Hari Ini</h2>
              <p className="text-sm text-slate-500 mt-0.5">{today}</p>
            </div>
            <a href="/admin/reports" className="btn-secondary text-sm">Lihat Semua →</a>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner spinner-blue" />
            </div>
          ) : todayList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-2">📋</div>
              <p>Belum ada data absensi hari ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Cabang</th>
                    <th>Shift</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Jam Kerja</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayList.map(r => {
                    const workMins = r.check_in && r.check_out
                      ? Math.floor((new Date(r.check_out) - new Date(r.check_in)) / 60000) : null
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                              {r.employee_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{r.employee_name}</p>
                              <p className="text-xs text-slate-400">{r.employee_code}</p>
                            </div>
                          </div>
                        </td>
                        <td><span className="text-slate-600">{r.branch_name || '-'}</span></td>
                        <td><span className="text-slate-600">{r.shift_name || '-'}</span></td>
                        <td><span className="font-mono text-sm">{fmt(r.check_in)}</span></td>
                        <td><span className="font-mono text-sm">{fmt(r.check_out)}</span></td>
                        <td>
                          <span className="font-mono text-sm text-blue-700">
                            {workMins !== null ? `${Math.floor(workMins / 60)}j ${workMins % 60}m` : '-'}
                          </span>
                        </td>
                        <td><Badge status={r.status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
  )
}

AdminDashboard.getLayout = (page) => <AdminLayout>{page}</AdminLayout>
