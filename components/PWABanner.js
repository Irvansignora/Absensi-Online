import { useState } from 'react'

export default function PWAInstallBanner({ onInstall, onDismiss }) {
  const [installing, setInstalling] = useState(false)

  async function handleInstall() {
    setInstalling(true)
    const accepted = await onInstall()
    if (!accepted) setInstalling(false)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div
        className="rounded-2xl p-4 shadow-2xl border border-blue-500/20"
        style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1e40af 100%)' }}
      >
        <div className="flex items-start gap-3">
          {/* App icon */}
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-xl">
            A
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Install WorkForce</p>
            <p className="text-blue-200 text-xs mt-0.5 leading-relaxed">
              Pasang di HP untuk absen lebih cepat tanpa buka browser!
            </p>

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                disabled={installing}
                className="flex-1 bg-white text-blue-900 text-xs font-bold py-2 px-3 rounded-lg transition-all active:scale-95 disabled:opacity-70"
              >
                {installing ? '⏳ Memasang...' : '📲 Install Sekarang'}
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-2 text-blue-300 hover:text-white text-xs rounded-lg transition-colors"
              >
                Nanti
              </button>
            </div>
          </div>

          <button onClick={onDismiss} className="text-blue-400 hover:text-white text-lg leading-none flex-shrink-0 mt-0.5">
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

// Offline banner
export function OfflineBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-900 text-center py-2 px-4 text-xs font-semibold">
      📶 Tidak ada koneksi internet — beberapa fitur mungkin tidak tersedia
    </div>
  )
}
