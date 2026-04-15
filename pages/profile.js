// pages/profile.js — Feature 7: Employee Self-Service Portal
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'

function StatBox({ icon, label, value, sub, color = 'blue' }) {
  const bg = { blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-700' }
  return (
    <div className={`rounded-xl p-4 ${bg[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold font-display">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('info')
  const [editMode, setEditMode] = useState(false)
  const [form, setForm]         = useState({ name: '', phone: '' })
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState({ type: '', text: '' })
  const [requests, setRequests] = useState([])
  const [payrolls, setPayrolls] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [profRes, reqRes, payRes] = await Promise.all([
      fetch('/api/employees/profile'),
      fetch('/api/requests'),
      fetch('/api/payroll'),
    ])
    if (!profRes.ok) { router.push('/'); return }

    const profData = await profRes.json()
    const reqData  = await reqRes.json()
    const payData  = await payRes.json()

    setProfile(profData)
    setForm({ name: profData.employee?.name || '', phone: profData.employee?.phone || '' })
    setRequests(reqData.requests || [])
    setPayrolls(payData.payrolls || [])
    setLoading(false)
  }

  async function handleSaveProfile() {
    setSaving(true); setMsg({ type: '', text: '' })
    const res = await fetch('/api/employees/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg({ type: 'error', text: d.error }); return }
    setMsg({ type: 'success', text: '✅ Profil berhasil diupdate!' })
    setProfile(prev => ({ ...prev, employee: { ...prev.employee, ...form } }))
    setEditMode(false)
    setTimeout(() => setMsg({ type: '', text: '' }), 3000)
  }

  async function handleChangePassword() {
    if (pwForm.next !== pwForm.confirm) {
      setMsg({ type: 'error', text: 'Konfirmasi password baru tidak cocok' }); return
    }
    setSaving(true); setMsg({ type: '', text: '' })
    const res = await fetch('/api/employees/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg({ type: 'error', text: d.error }); return }
    setMsg({ type: 'success', text: '✅ Password berhasil diubah!' })
    setPwForm({ current: '', next: '', confirm: '' })
    setTimeout(() => setMsg({ type: '', text: '' }), 3000)
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
  const fmtMoney = (n) => n != null ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n) : '-'
  const monthStr = (y, m) => new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const TABS = [
    { key: 'info',    label: '👤 Profil' },
    { key: 'stats',   label: '📊 Statistik' },
    { key: 'leave',   label: '🏖️ Cuti & Izin' },
    { key: 'payroll', label: '💰 Slip Gaji' },
    { key: 'password',label: '🔒 Password' },
  ]

  const STATUS_BADGE = {
    pending:  'badge-yellow',
    approved: 'badge-green',
    rejected: 'badge-red',
  }
  const TYPE_LABEL = { izin: 'Izin', cuti: 'Cuti', sakit: 'Sakit', tukar_shift: 'Tukar Shift', tukar_libur: 'Tukar Libur' }

  return (
    <>
      <Head><title>Profil Saya — WorkForce</title></Head>
      <div className="min-h-screen bg-slate-50 font-body">
        {/* Header */}
        <div className="px-4 pt-10 pb-20 text-white" style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1e3a8a 100%)' }}>
          <div className="max-w-lg mx-auto flex items-center justify-between mb-6">
            <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">← Dashboard</Link>
            <span className="text-white font-semibold text-sm font-display">Profil Saya</span>
            <div className="w-16" />
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="spinner" /></div>
          ) : (
            <div className="max-w-lg mx-auto text-center">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-3 border-4 border-white/20">
                {profile?.employee?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <h1 className="text-xl font-bold font-display">{profile?.employee?.name}</h1>
              <p className="text-blue-300 text-sm">{profile?.employee?.position} · {profile?.employee?.department}</p>
              <div className="flex items-center justify-center gap-3 mt-2">
                <span className="text-xs bg-blue-500/30 text-blue-200 px-3 py-1 rounded-full">
                  {profile?.employee?.employee_code}
                </span>
                <span className="text-xs bg-blue-500/30 text-blue-200 px-3 py-1 rounded-full capitalize">
                  {profile?.employee?.role}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-8 pb-10 space-y-4">
          {/* Tab nav */}
          <div className="card p-1.5">
            <div className="flex overflow-x-auto gap-1 no-scrollbar">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-shrink-0 text-xs px-3 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {msg.text && (
            <div className={`p-3 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {msg.text}
            </div>
          )}

          {/* Tab: Info */}
          {tab === 'info' && !loading && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-800">Informasi Pribadi</h2>
                <button onClick={() => setEditMode(e => !e)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium ${editMode ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'}`}>
                  {editMode ? '✕ Batal' : '✏️ Edit'}
                </button>
              </div>

              {editMode ? (
                <div className="space-y-3">
                  <Field label="Nama Lengkap">
                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <Field label="No. WhatsApp">
                    <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="08xxxxxxxxxx" />
                    <p className="text-xs text-slate-400 mt-1">Digunakan untuk notifikasi WA otomatis</p>
                  </Field>
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="btn-primary w-full justify-center">
                    {saving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    ['Nama',       profile?.employee?.name],
                    ['Email',      profile?.employee?.email],
                    ['No. HP/WA',  profile?.employee?.phone || '-'],
                    ['Kode Karyawan', profile?.employee?.employee_code],
                    ['Jabatan',    profile?.employee?.position],
                    ['Departemen', profile?.employee?.department],
                    ['Cabang',     profile?.employee?.branches?.name],
                    ['Shift Default', profile?.employee?.shifts?.name ? `${profile.employee.shifts.name} (${profile.employee.shifts.start_time}–${profile.employee.shifts.end_time})` : '-'],
                    ['Bergabung',  fmtDate(profile?.employee?.created_at)],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                      <span className="text-xs text-slate-500 w-32 flex-shrink-0">{lbl}</span>
                      <span className="text-sm text-slate-800 text-right font-medium">{val || '-'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Statistik */}
          {tab === 'stats' && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatBox icon="✅" label="Hadir Bulan Ini" value={profile?.monthly_stats?.present ?? 0} color="green" />
                <StatBox icon="⚠️" label="Terlambat"       value={profile?.monthly_stats?.late ?? 0}    color="amber" />
                <StatBox icon="❌" label="Absen"           value={profile?.monthly_stats?.absent ?? 0}  color="red" />
                <StatBox icon="⏰" label="Lembur Disetujui"
                  value={`${Math.floor((profile?.monthly_stats?.overtime_approved || 0) / 60)}j`}
                  sub={`${(profile?.monthly_stats?.overtime_approved || 0) % 60}m`} color="blue" />
              </div>

              <div className="card">
                <h3 className="font-bold text-slate-800 mb-4">🏖️ Jatah Cuti Tahun Ini</h3>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1">
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((profile?.leave?.used || 0) / (profile?.leave?.quota || 12)) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700">
                    {profile?.leave?.used} / {profile?.leave?.quota} hari
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Terpakai: <strong className="text-slate-700">{profile?.leave?.used} hari</strong></span>
                  <span>Sisa: <strong className="text-blue-600">{profile?.leave?.remaining} hari</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Cuti & Izin */}
          {tab === 'leave' && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-800">Riwayat Pengajuan</h2>
                <Link href="/requests" className="text-xs text-blue-600 hover:underline">+ Ajukan Baru</Link>
              </div>

              {requests.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-4xl mb-2">📋</div>
                  <p>Belum ada pengajuan</p>
                  <Link href="/requests" className="text-blue-500 text-sm hover:underline mt-2 inline-block">Ajukan sekarang →</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.slice(0, 10).map(r => (
                    <div key={r.id} className="p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="text-sm font-semibold text-slate-800">{TYPE_LABEL[r.type] || r.type}</span>
                          <span className={`ml-2 ${STATUS_BADGE[r.status]}`}>{r.status === 'pending' ? 'Menunggu' : r.status === 'approved' ? 'Disetujui' : 'Ditolak'}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">{fmtDate(r.start_date)}{r.end_date && r.end_date !== r.start_date ? ` s/d ${fmtDate(r.end_date)}` : ''}</p>
                      {r.reason && <p className="text-xs text-slate-600 mt-1">"{r.reason}"</p>}
                      {r.review_note && <p className="text-xs text-blue-600 mt-1">💬 {r.review_note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Slip Gaji */}
          {tab === 'payroll' && (
            <div className="card space-y-3">
              <h2 className="font-bold text-slate-800">Slip Gaji</h2>
              {payrolls.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-4xl mb-2">💰</div>
                  <p>Belum ada slip gaji tersedia</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payrolls.map(p => (
                    <div key={p.id} className="p-4 border border-slate-200 rounded-xl">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-slate-800">{monthStr(p.year, p.month)}</p>
                          <span className={`text-xs ${p.status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                            {p.status === 'paid' ? '✅ Sudah Dibayar' : '⏳ Diproses'}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-blue-600">{fmtMoney(p.net_salary)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
                        <div>Gaji Pokok: <span className="font-medium text-slate-800">{fmtMoney(p.basic_salary)}</span></div>
                        {p.overtime_pay > 0 && <div>Lembur: <span className="font-medium text-amber-700">+{fmtMoney(p.overtime_pay)}</span></div>}
                        {p.deductions > 0 && <div>Potongan: <span className="font-medium text-red-600">-{fmtMoney(p.deductions)}</span></div>}
                        {p.allowances > 0 && <div>Tunjangan: <span className="font-medium text-green-700">+{fmtMoney(p.allowances)}</span></div>}
                      </div>
                      {p.payment_date && (
                        <p className="text-xs text-slate-400 mt-2">Dibayar: {fmtDate(p.payment_date)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Password */}
          {tab === 'password' && (
            <div className="card space-y-4">
              <h2 className="font-bold text-slate-800">🔒 Ganti Password</h2>
              <Field label="Password Lama">
                <input type="password" className="input" value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                  placeholder="Masukkan password saat ini" />
              </Field>
              <Field label="Password Baru">
                <input type="password" className="input" value={pwForm.next}
                  onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                  placeholder="Minimal 6 karakter" />
              </Field>
              <Field label="Konfirmasi Password Baru">
                <input type="password" className="input" value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Ulangi password baru" />
              </Field>
              <button onClick={handleChangePassword} disabled={saving || !pwForm.current || !pwForm.next}
                className="btn-primary w-full justify-center">
                {saving ? '⏳ Menyimpan...' : '🔒 Ubah Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
