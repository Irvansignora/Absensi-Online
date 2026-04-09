// pages/payroll.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'

export default function PayrollPage() {
  const router = useRouter()
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPayrolls()
  }, [])

  async function fetchPayrolls() {
    try {
      const res = await fetch('/api/payroll')
      const d = await res.json()
      setPayrolls(d.payrolls || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  function openSlip(id) {
    window.open(`/api/admin/payroll/slip?id=${id}`, '_blank', 'width=900,height=700')
  }

  return (
    <>
      <Head><title>Slip Gaji — WorkForce</title></Head>
      <div className="min-h-screen bg-slate-50 font-body">
        {/* Header */}
        <div className="px-4 pt-10 pb-16 text-white" style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1e3a8a 100%)' }}>
          <div className="flex justify-between items-center max-w-md mx-auto mb-6">
            <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">← Kembali</Link>
          </div>
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold font-display">Slip Gaji</h1>
            <p className="text-blue-300 text-sm mt-1">Daftar slip gaji Anda yang sudah disetujui</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-8 pb-10">
          <div className="card animate-slide-up">
            {loading ? (
              <div className="flex justify-center py-10"><div className="spinner spinner-blue" /></div>
            ) : payrolls.length === 0 ? (
              <div className="text-center py-10 text-slate-400">Belum ada slip gaji yang tersedia</div>
            ) : (
              <div className="space-y-4">
                {payrolls.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100/50">
                    <div>
                      <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                        PERIODE {p.month} / {p.year}
                      </p>
                      <p className="text-base font-bold text-slate-800">
                        {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][p.month - 1]} {p.year}
                      </p>
                      <p className="text-sm font-mono font-bold text-slate-500 mt-1">
                        {p.net_salary.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <button
                      onClick={() => openSlip(p.id)}
                      className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20"
                    >
                      📄 Lihat Slip
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-6 text-center leading-relaxed">
              Punya pertanyaan mengenai gaji? Hubungi bagian HR/Finance.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
