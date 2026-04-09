import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    // Check session on mount
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          if (['admin', 'hr', 'finance'].includes(d.user.role)) {
            router.push('/admin')
          } else {
            router.push('/dashboard')
          }
        } else {
          setCheckingSession(false)
        }
      })
      .catch(() => setCheckingSession(false))
  }, [])

  if (checkingSession) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 animate-page">
      <div className="spinner spinner-blue" />
    </div>
  )

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login gagal')
        setLoading(false)
        return
      }

      if (['admin', 'hr', 'finance'].includes(data.user.role)) {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      setError('Terjadi kesalahan. Coba lagi.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Login - WorkForce</title>
      </Head>
      <div className="min-h-screen flex font-body animate-page">
        {/* Left: decorative panel */}
        <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0B1629 0%, #0f2347 50%, #1a3a6e 100%)' }}>
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          {/* Floating orbs */}
          <div className="absolute top-20 right-20 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-bold font-display">W</div>
              <span className="text-white text-xl font-bold font-display">WorkForce</span>
            </div>
          </div>

          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl font-extrabold text-white font-display leading-tight">
              Kelola Absensi<br />
              <span className="text-blue-400">Multi-Cabang</span><br />
              dengan Mudah
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Sistem absensi terpusat untuk semua cabang perusahaan Anda. Real-time, akurat, dan mudah digunakan.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '🏢', label: 'Multi-Cabang' },
                { icon: '🕐', label: 'Sistem Shift' },
                { icon: '📊', label: 'Laporan HR' },
                { icon: '📍', label: 'GPS Check-in' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-3">
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-white text-sm font-medium">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10">
            <p className="text-slate-600 text-sm">© 2026 WorkForce. All rights reserved.</p>
          </div>
        </div>

        {/* Right: login form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-2 mb-8">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold font-display">W</div>
              <span className="text-xl font-bold font-display text-slate-900">WorkForce</span>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl font-extrabold font-display text-slate-900 mb-2">Selamat Datang 👋</h1>
              <p className="text-slate-500">Masuk ke sistem absensi perusahaan Anda</p>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="nama@perusahaan.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary btn-lg w-full justify-center">
                {loading ? <><div className="spinner" />Masuk...</> : '→ Masuk ke Sistem'}
              </button>
            </form>

            <div className="mt-8 p-4 bg-slate-50 rounded-xl text-sm text-slate-600">
              <p className="font-semibold mb-2 text-slate-700">💡 Demo akun:</p>
              <div className="space-y-1">
                <p>Admin: <code className="bg-white px-1.5 py-0.5 rounded text-blue-700 text-xs">admin@demo.com</code> / <code className="bg-white px-1.5 py-0.5 rounded text-xs">admin123</code></p>
                <p>Karyawan: <code className="bg-white px-1.5 py-0.5 rounded text-blue-700 text-xs">karyawan@demo.com</code> / <code className="bg-white px-1.5 py-0.5 rounded text-xs">karyawan123</code></p>
              </div>
              <p className="mt-2 text-slate-400 text-xs">Jalankan <code>/api/setup</code> untuk membuat data demo</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
