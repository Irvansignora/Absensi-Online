import '../styles/globals.css'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { usePWA } from '../lib/usePWA'
import PWAInstallBanner, { OfflineBanner } from '../components/PWABanner'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'WorkForce'
  const { isInstallable, isOnline, promptInstall } = usePWA()
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Show install banner after 3s if installable and not dismissed
  useEffect(() => {
    if (isInstallable && !dismissed) {
      const timer = setTimeout(() => setShowBanner(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [isInstallable, dismissed])

  function handleDismiss() {
    setShowBanner(false)
    setDismissed(true)
    // Don't show again for 7 days
    localStorage.setItem('pwa-dismissed', Date.now().toString())
  }

  // Check if was dismissed recently
  useEffect(() => {
    const ts = localStorage.getItem('pwa-dismissed')
    if (ts && Date.now() - parseInt(ts) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true)
    }
  }, [])

  return (
    <>
      <Head>
        <title>{companyName} - Sistem Absensi Online</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="Sistem Absensi Online Multi-Cabang - Hadir, Check-in, Check-out" />
      </Head>

      {/* Offline indicator */}
      {!isOnline && <OfflineBanner />}

      <Component {...pageProps} />

      {/* PWA Install Banner */}
      {showBanner && !dismissed && (
        <PWAInstallBanner
          onInstall={async () => {
            const ok = await promptInstall()
            if (ok) setShowBanner(false)
            return ok
          }}
          onDismiss={handleDismiss}
        />
      )}
    </>
  )
}
