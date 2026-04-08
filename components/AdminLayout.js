import { useRouter } from 'next/router'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/admin/employees', label: 'Karyawan', icon: '👥' },
  { href: '/admin/branches', label: 'Cabang', icon: '🏢' },
  { href: '/admin/shifts', label: 'Shift', icon: '🕐' },
  { href: '/admin/reports', label: 'Laporan Absensi', icon: '📋' },
]

export default function AdminLayout({ children, title = 'Dashboard' }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.error) router.push('/')
        else setUser(d.user)
      })
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
              <span>{label}</span>
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

      {/* Main content */}
      <main className="page-content">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold font-display text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {user.name?.[0]?.toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="p-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
