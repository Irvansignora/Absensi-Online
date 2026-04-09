// components/AdminLayout.js
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const NAV = [
  { href: '/admin',           label: 'Dashboard',         icon: '📊', exact: true },
  { href: '/admin/employees', label: 'Karyawan',           icon: '👥' },
  { href: '/admin/branches',  label: 'Cabang',             icon: '🏢' },
  { href: '/admin/shifts',    label: 'Shift',              icon: '🕐' },
  { href: '/admin/requests',  label: 'Pengajuan & Lembur', icon: '📋' },
  { href: '/admin/reports',   label: 'Laporan Absensi',    icon: '📈' },
  { href: '/admin/payroll',   label: 'Penggajian',         icon: '💰' },
  { href: '/admin/settings',  label: 'Setting Company',    icon: '⚙️' },
]

export default function AdminLayout({ children, title = 'Dashboard' }) {
  const router = useRouter()
  const [user, setUser]               = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.error) router.push('/')
        else setUser(d.user)
      })
    // Badge count untuk pending requests
    fetch('/api/admin/requests?status=pending')
      .then(r => r.json())
      .then(d => setPendingCount((d.requests || []).length))
      .catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const isActive = (href, exact) =>
    exact ? router.pathname === href : router.pathname.startsWith(href)

  return (
    <div className="min-h-screen bg-slate-50 font-body">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white text-lg font-bold font-display">
              A
            </div>
            <div>
              <p className="text-white font-semibold text-sm font-display leading-tight">AbsensiPro</p>
              <p className="text-slate-500 text-xs">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-600 uppercase tracking-widest">Menu</p>
          {NAV.map(({ href, label, icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${isActive(href, exact) ? 'active' : ''}`}
            >
              <span className="text-base">{icon}</span>
              <span className="flex-1">{label}</span>
              {href === '/admin/requests' && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[20px] text-center">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/10">
          {user && (
            <div className="mb-3 px-2">
              <p className="text-white text-sm font-medium truncate">{user.name}</p>
              <p className="text-slate-500 text-xs truncate">{user.role === 'admin' ? '🔑 Administrator' : '📋 HR Manager'}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">A</div>
          <span className="text-white font-semibold text-sm font-display">AbsensiPro</span>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Link href="/admin/requests">
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">{pendingCount} pending</span>
            </Link>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white p-1">
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setSidebarOpen(false)}>
          <div className="w-64 h-full" style={{ background: '#0B1629' }} onClick={e => e.stopPropagation()}>
            <nav className="px-3 py-16 space-y-0.5">
              {NAV.map(({ href, label, icon, exact }) => (
                <Link
                  key={href} href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`sidebar-link ${isActive(href, exact) ? 'active' : ''}`}
                >
                  <span>{icon}</span>
                  <span className="flex-1">{label}</span>
                  {href === '/admin/requests' && pendingCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
