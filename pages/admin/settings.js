// pages/admin/settings.js
import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect, useRef } from 'react'

function SectionCard({ title, icon, children }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <span className="text-xl">{icon}</span>
        <h3 className="font-bold text-slate-800 font-display">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

function NumInput({ value, onChange, min, max, step = 0.1, suffix }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        className="input w-32"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step}
      />
      {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
    </div>
  )
}

function BlastButton({ customMessage }) {
  const [blasting, setBlasting] = useState(false)
  const [result, setResult]     = useState(null)

  async function handleBlast() {
    if (!confirm('Kirim pengingat WA ke semua karyawan yang belum absen hari ini?')) return
    setBlasting(true); setResult(null)
    const res = await fetch('/api/admin/notify/blast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'not_checkin', message: customMessage }),
    })
    const d = await res.json()
    setBlasting(false)
    setResult(d)
  }

  return (
    <div className="space-y-2">
      <button onClick={handleBlast} disabled={blasting}
        className="btn-primary flex items-center gap-2">
        {blasting ? <><div className="spinner" />Mengirim...</> : '📣 Kirim Blast Sekarang'}
      </button>
      {result && (
        <p className={`text-sm ${result.sent > 0 ? 'text-green-600' : 'text-slate-500'}`}>
          {result.message} {result.sent > 0 ? `(${result.sent} pesan)` : ''}
        </p>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [s, setS] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [activeTab, setActiveTab] = useState('perusahaan')
  const logoRef = useRef()

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => { setS(d.settings); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function set(key, val) {
    setS(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    setMsg({ type: '', text: '' })
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) {
      setMsg({ type: 'error', text: '❌ ' + d.error })
    } else {
      setMsg({ type: 'success', text: '✅ Settings berhasil disimpan!' })
      setS(d.settings)
      setTimeout(() => setMsg({ type: '', text: '' }), 3000)
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'error', text: '❌ Ukuran logo maksimal 2MB' })
      return
    }
    setUploadingLogo(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result
      const res = await fetch('/api/admin/settings/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const d = await res.json()
      setUploadingLogo(false)
      if (!res.ok) {
        setMsg({ type: 'error', text: '❌ Gagal upload: ' + d.error })
      } else {
        set('company_logo_url', d.url)
        setMsg({ type: 'success', text: '✅ Logo berhasil diupload' })
      }
    }
    reader.readAsDataURL(file)
  }

  const TABS = [
    { id: 'perusahaan', label: '🏢 Perusahaan',     },
    { id: 'kehadiran',  label: '🕐 Kehadiran',       },
    { id: 'potongan',   label: '✂️ Potongan',        },
    { id: 'bpjs',       label: '🏥 BPJS',            },
    { id: 'lembur',     label: '⏰ Lembur & PPh21',  },
    { id: 'slip',       label: '📄 Slip Gaji',        },
    { id: 'notifikasi', label: '📱 Notifikasi WA',    },
  ]

  if (loading) return (
    <div className="flex justify-center py-20"><div className="spinner spinner-blue" /></div>
  )

  if (!s) return (
    <div className="text-center py-20 text-slate-400">Gagal memuat settings</div>
  )

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">⚙️ Pengaturan Perusahaan</h1>

        {/* Tab navigation */}
        <div className="card p-1.5">
          <div className="flex flex-wrap gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {/* Alert */}
        {msg.text && (
          <div className={`p-3 rounded-xl text-sm font-medium ${
            msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {msg.text}
          </div>
        )}

        {/* ── TAB: Perusahaan ───────────────────────────────────────── */}
        {activeTab === 'perusahaan' && (
          <div className="space-y-5">
            <SectionCard title="Identitas Perusahaan" icon="🏢">
              {/* Logo upload */}
              <div className="flex items-start gap-6">
                <div>
                  <label className="label">Logo Perusahaan</label>
                  <p className="text-xs text-slate-400 mb-2">Format PNG/JPG, maks 2MB. Tampil di slip gaji.</p>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden">
                      {s.company_logo_url ? (
                        <img src={s.company_logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="text-3xl">🏢</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={logoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <button
                        onClick={() => logoRef.current?.click()}
                        disabled={uploadingLogo}
                        className="btn-secondary text-sm"
                      >
                        {uploadingLogo ? '⏳ Mengupload...' : '📤 Upload Logo'}
                      </button>
                      {s.company_logo_url && (
                        <button
                          onClick={() => set('company_logo_url', null)}
                          className="block text-xs text-red-400 hover:text-red-600"
                        >Hapus logo</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nama Perusahaan *">
                  <input className="input" value={s.company_name || ''} onChange={e => set('company_name', e.target.value)} placeholder="PT. Nama Perusahaan" />
                </Field>
                <Field label="NPWP Perusahaan">
                  <input className="input" value={s.npwp || ''} onChange={e => set('npwp', e.target.value)} placeholder="00.000.000.0-000.000" />
                </Field>
              </div>

              <Field label="Alamat Perusahaan *">
                <textarea className="input min-h-[72px] resize-y" value={s.company_address || ''} onChange={e => set('company_address', e.target.value)} placeholder="Jl. Contoh No. 1, Kota, Provinsi" />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="No. Telepon">
                  <input className="input" value={s.company_phone || ''} onChange={e => set('company_phone', e.target.value)} placeholder="021-12345678" />
                </Field>
                <Field label="Email Perusahaan">
                  <input className="input" type="email" value={s.company_email || ''} onChange={e => set('company_email', e.target.value)} placeholder="info@perusahaan.com" />
                </Field>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── TAB: Kehadiran ────────────────────────────────────────── */}
        {activeTab === 'kehadiran' && (
          <SectionCard title="Aturan Kehadiran" icon="🕐">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Hari Kerja per Bulan" hint="Digunakan sebagai pembagi untuk menghitung gaji harian">
                <NumInput
                  value={s.work_days_per_month}
                  onChange={v => set('work_days_per_month', v)}
                  min={1} max={31} step={1}
                  suffix="hari"
                />
              </Field>
              <Field label="Toleransi Keterlambatan" hint="Menit toleransi sebelum dihitung terlambat">
                <NumInput
                  value={s.late_tolerance_minutes}
                  onChange={v => set('late_tolerance_minutes', v)}
                  min={0} max={120} step={5}
                  suffix="menit"
                />
              </Field>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
              <p className="font-semibold mb-1">📊 Rumus Perhitungan Gaji Harian:</p>
              <p className="font-mono">Gaji Harian = Gaji Pokok ÷ {s.work_days_per_month} hari</p>
            </div>
          </SectionCard>
        )}

        {/* ── TAB: Potongan ─────────────────────────────────────────── */}
        {activeTab === 'potongan' && (
          <div className="space-y-5">
            <SectionCard title="Potongan Absensi" icon="❌">
              <Field label="Metode Potongan Absen">
                <select className="input w-full max-w-xs" value={s.deduction_absent_type} onChange={e => set('deduction_absent_type', e.target.value)}>
                  <option value="daily">Per Hari (Gaji Pokok ÷ Hari Kerja)</option>
                  <option value="percent">Persentase dari Gaji Pokok</option>
                </select>
              </Field>
              {s.deduction_absent_type === 'percent' && (
                <Field label="Persentase Potongan per Hari Absen">
                  <NumInput
                    value={s.deduction_absent_percent}
                    onChange={v => set('deduction_absent_percent', v)}
                    min={0} max={100} step={0.5}
                    suffix="% dari gaji pokok"
                  />
                </Field>
              )}
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                {s.deduction_absent_type === 'daily'
                  ? `Contoh: Gaji Rp 5.000.000, absen 2 hari → potongan = (5.000.000 ÷ ${s.work_days_per_month}) × 2 = Rp ${((5000000 / s.work_days_per_month) * 2).toLocaleString('id-ID')}`
                  : `Contoh: Gaji Rp 5.000.000, absen 2 hari, ${s.deduction_absent_percent}% → potongan = Rp ${(5000000 * (s.deduction_absent_percent / 100) * 2).toLocaleString('id-ID')}`
                }
              </div>
            </SectionCard>

            <SectionCard title="Potongan Keterlambatan" icon="⏱️">
              <Field label="Metode Potongan Terlambat">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={s.deduction_late_per_30min === true} onChange={() => { set('deduction_late_per_30min', true); set('deduction_late_custom_amount', 0) }} />
                    <span className="text-sm">Per 30 menit (Gaji Harian ÷ 16 per 30 menit)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={s.deduction_late_per_30min === false} onChange={() => set('deduction_late_per_30min', false)} />
                    <span className="text-sm">Nominal tetap per kejadian keterlambatan</span>
                  </label>
                </div>
              </Field>

              {!s.deduction_late_per_30min && (
                <Field label="Nominal Potongan per Keterlambatan" hint="Dipotong flat setiap karyawan terlambat (apapun durasinya)">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Rp</span>
                    <input
                      type="number"
                      className="input w-40"
                      value={s.deduction_late_custom_amount || 0}
                      onChange={e => set('deduction_late_custom_amount', parseInt(e.target.value) || 0)}
                      min={0} step={5000}
                    />
                  </div>
                </Field>
              )}

              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                {s.deduction_late_per_30min
                  ? `Contoh: Gaji harian Rp ${Math.round(5000000 / s.work_days_per_month).toLocaleString('id-ID')}, terlambat 45 menit → potongan = ${Math.round(5000000 / s.work_days_per_month / 16 * (45/30)).toLocaleString('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0})}`
                  : `Setiap keterlambatan dipotong flat Rp ${(s.deduction_late_custom_amount || 0).toLocaleString('id-ID')}`
                }
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── TAB: BPJS ─────────────────────────────────────────────── */}
        {activeTab === 'bpjs' && (
          <div className="space-y-5">
            <SectionCard title="BPJS Kesehatan" icon="🏥">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ditanggung Karyawan" hint="Dipotong dari gaji karyawan">
                  <NumInput value={s.bpjs_kesehatan_employee} onChange={v => set('bpjs_kesehatan_employee', v)} min={0} max={10} step={0.5} suffix="%" />
                </Field>
                <Field label="Ditanggung Perusahaan" hint="Beban perusahaan">
                  <NumInput value={s.bpjs_kesehatan_employer} onChange={v => set('bpjs_kesehatan_employer', v)} min={0} max={10} step={0.5} suffix="%" />
                </Field>
              </div>
              <Field label="Batas Maksimum Gaji" hint="Perhitungan BPJS Kesehatan maks dari gaji ini">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Rp</span>
                  <input type="number" className="input w-44" value={s.bpjs_max_salary_kes} onChange={e => set('bpjs_max_salary_kes', parseInt(e.target.value))} step={1000000} />
                  <span className="text-sm text-slate-500">({(s.bpjs_max_salary_kes/1000000).toFixed(0)} juta)</span>
                </div>
              </Field>
            </SectionCard>

            <SectionCard title="BPJS Ketenagakerjaan – JHT" icon="💼">
              <div className="grid grid-cols-2 gap-4">
                <Field label="JHT Karyawan">
                  <NumInput value={s.bpjs_jht_employee} onChange={v => set('bpjs_jht_employee', v)} min={0} max={10} step={0.5} suffix="%" />
                </Field>
                <Field label="JHT Perusahaan">
                  <NumInput value={s.bpjs_jht_employer} onChange={v => set('bpjs_jht_employer', v)} min={0} max={10} step={0.5} suffix="%" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="BPJS Ketenagakerjaan – JP" icon="👴">
              <div className="grid grid-cols-2 gap-4">
                <Field label="JP Karyawan">
                  <NumInput value={s.bpjs_jp_employee} onChange={v => set('bpjs_jp_employee', v)} min={0} max={10} step={0.5} suffix="%" />
                </Field>
                <Field label="JP Perusahaan">
                  <NumInput value={s.bpjs_jp_employer} onChange={v => set('bpjs_jp_employer', v)} min={0} max={10} step={0.5} suffix="%" />
                </Field>
              </div>
              <Field label="Batas Maksimum Gaji JP">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Rp</span>
                  <input type="number" className="input w-44" value={s.bpjs_max_salary_jp} onChange={e => set('bpjs_max_salary_jp', parseInt(e.target.value))} step={500000} />
                  <span className="text-sm text-slate-500">({(s.bpjs_max_salary_jp/1000000).toFixed(1)} juta)</span>
                </div>
              </Field>
            </SectionCard>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
              <p className="font-semibold">⚠️ Perhatian:</p>
              <p className="mt-1">Persentase default mengikuti ketentuan BPJS terbaru (Kes: 1%+4%, JHT: 2%+3.7%, JP: 1%+2%). Ubah hanya jika ada kebijakan perusahaan khusus atau perubahan regulasi.</p>
            </div>
          </div>
        )}

        {/* ── TAB: Lembur & PPh21 ───────────────────────────────────── */}
        {activeTab === 'lembur' && (
          <div className="space-y-5">
            <SectionCard title="Perhitungan Lembur" icon="⏰">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Multiplier Jam Pertama" hint="Sesuai UU 13/2003 = 1.5×">
                  <NumInput value={s.overtime_rate_hour1} onChange={v => set('overtime_rate_hour1', v)} min={1} max={5} step={0.25} suffix="× upah/jam" />
                </Field>
                <Field label="Multiplier Jam Berikutnya" hint="Sesuai UU 13/2003 = 2×">
                  <NumInput value={s.overtime_rate_hour2plus} onChange={v => set('overtime_rate_hour2plus', v)} min={1} max={5} step={0.25} suffix="× upah/jam" />
                </Field>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                <p>Upah/jam = Gaji Pokok ÷ 173 jam (standar UU Ketenagakerjaan)</p>
                <p className="mt-1">Contoh: Gaji Rp 5jt → upah/jam = Rp {Math.round(5000000/173).toLocaleString('id-ID')}, lembur 3 jam = jam 1: {Math.round(5000000/173*s.overtime_rate_hour1).toLocaleString('id-ID')} + jam 2-3: {Math.round(5000000/173*s.overtime_rate_hour2plus*2).toLocaleString('id-ID')}</p>
              </div>
            </SectionCard>

            <SectionCard title="PPh 21" icon="📑">
              <Field label="PTKP TK/0 per Tahun" hint="Penghasilan Tidak Kena Pajak untuk status Tidak Kawin tanpa tanggungan">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Rp</span>
                  <input type="number" className="input w-44" value={s.ptkp_tk0} onChange={e => set('ptkp_tk0', parseInt(e.target.value))} step={1000000} />
                  <span className="text-sm text-slate-500">({(s.ptkp_tk0/1000000).toFixed(0)} juta/tahun)</span>
                </div>
              </Field>
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                <p className="font-semibold mb-1">Tarif PPh 21 Progressive (2024):</p>
                <p>0 – Rp 60 juta: 5% | Rp 60–250 juta: 15% | Rp 250–500 juta: 25% | &gt;Rp 500 juta: 30%</p>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── TAB: Slip Gaji ────────────────────────────────────────── */}
        {activeTab === 'slip' && (
          <SectionCard title="Tampilan Slip Gaji" icon="📄">
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.slip_show_bpjs}
                    onChange={e => set('slip_show_bpjs', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Tampilkan detail potongan BPJS</p>
                    <p className="text-xs text-slate-400">BPJS Kesehatan, JHT, JP akan ditampilkan terpisah di slip</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.slip_show_pph21}
                    onChange={e => set('slip_show_pph21', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Tampilkan PPh 21 di slip gaji</p>
                    <p className="text-xs text-slate-400">Nominal pajak penghasilan akan terlihat oleh karyawan</p>
                  </div>
                </label>
              </div>

              <Field label="Catatan Kaki Slip Gaji" hint="Teks yang muncul di bagian bawah setiap slip gaji">
                <textarea
                  className="input min-h-[80px] resize-y"
                  value={s.slip_footer_note || ''}
                  onChange={e => set('slip_footer_note', e.target.value)}
                  placeholder="Contoh: Slip ini digenerate otomatis. Harap simpan sebagai dokumen pribadi."
                />
              </Field>

              {/* Preview mini slip */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preview Header Slip Gaji</div>
                <div className="p-4 bg-white">
                  <div className="flex justify-between items-start border-b-2 border-blue-800 pb-3">
                    <div className="flex items-center gap-3">
                      {s.company_logo_url
                        ? <img src={s.company_logo_url} alt="Logo" className="w-12 h-12 object-contain" />
                        : <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">🏢</div>
                      }
                      <div>
                        <p className="font-bold text-blue-900 text-sm">{s.company_name || 'Nama Perusahaan'}</p>
                        <p className="text-xs text-slate-500">{s.company_address || 'Alamat perusahaan'}</p>
                        <p className="text-xs text-slate-500">{s.company_phone || ''} {s.company_email ? '· ' + s.company_email : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-900 text-sm">SLIP GAJI KARYAWAN</p>
                      <p className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1">April 2025</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 italic">{s.slip_footer_note || 'Catatan kaki slip...'}</p>
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── TAB: Notifikasi ─────────────────────────────────────────── */}
        {activeTab === 'notifikasi' && (
          <div className="space-y-5">
            <SectionCard title="WhatsApp Notifikasi" icon="📱">
              <div className="space-y-4">
                <Field label="Provider WA" hint="Set env WA_PROVIDER=fonnte di server Anda">
                  <div className="flex gap-3">
                    {['fonnte', 'twilio'].map(p => (
                      <label key={p} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="wa_provider"
                          checked={(s.wa_provider || 'fonnte') === p}
                          onChange={() => set('wa_provider', p)} />
                        <span className="text-sm capitalize font-medium text-slate-700">{p}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Fonnte API Token" hint="Dapatkan token di app.fonnte.com (gratis untuk coba)">
                  <input className="input font-mono text-sm" value={s.fonnte_token || ''}
                    onChange={e => set('fonnte_token', e.target.value)} placeholder="Paste token Fonnte di sini" />
                  <p className="text-xs text-slate-400 mt-1">Token ini disimpan sebagai environment variable FONNTE_TOKEN, bukan di database</p>
                </Field>
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-700">📋 Notifikasi yang aktif:</p>
                  {[
                    ['✅ Check-in berhasil', 'Dikirim ke karyawan setelah absen masuk'],
                    ['🏁 Check-out berhasil', 'Dikirim ke karyawan setelah absen pulang'],
                    ['📋 Pengajuan disetujui/ditolak', 'Dikirim saat admin/manager mereview'],
                    ['⏰ Lembur disetujui/ditolak', 'Dikirim setelah admin review lembur'],
                    ['💰 Slip gaji tersedia', 'Dikirim saat admin publish payroll'],
                  ].map(([title, desc]) => (
                    <div key={title} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{title}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Blast Pengingat Absensi" icon="📣">
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Kirim pesan WA ke semua karyawan yang <strong>belum check-in</strong> hari ini.
                </p>
                <Field label="Pesan Kustom (opsional)" hint="Kosongkan untuk gunakan pesan default">
                  <textarea className="input resize-none h-24 text-sm" value={s.blast_message || ''}
                    onChange={e => set('blast_message', e.target.value)}
                    placeholder="Halo {nama}! Anda belum absen hari ini..." />
                </Field>
                <BlastButton customMessage={s.blast_message} />
              </div>
            </SectionCard>
          </div>
        )}

        {/* Save button — sticky at bottom */}
        <div className="sticky bottom-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary shadow-lg shadow-blue-500/30 px-8"
          >
            {saving ? <><div className="spinner" />Menyimpan...</> : '💾 Simpan Semua Settings'}
          </button>
        </div>
    </div>
  )
}

SettingsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>
