import { useEffect, useState } from 'react'

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isOnline, setIsOnline] = useState(true)
  const [swRegistered, setSwRegistered] = useState(false)

  useEffect(() => {
    // Online/offline status
    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Check if already installed (standalone)
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
      setIsInstalled(true)
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[PWA] SW registered:', reg.scope)
          setSwRegistered(true)
        })
        .catch((err) => console.warn('[PWA] SW failed:', err))
    }

    // Capture install prompt
    const handlePrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)

    // App installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('beforeinstallprompt', handlePrompt)
    }
  }, [])

  async function promptInstall() {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setIsInstallable(false)
    return outcome === 'accepted'
  }

  // Queue attendance for background sync when offline
  async function queueOfflineAttendance(url, data) {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const db = await openOfflineDB()
        await addToQueue(db, { url, data, timestamp: Date.now() })
        const reg = await navigator.serviceWorker.ready
        await reg.sync.register('sync-attendance')
        return { queued: true }
      } catch (err) {
        console.error('[PWA] Offline queue error:', err)
      }
    }
    return { queued: false }
  }

  return { isInstallable, isInstalled, isOnline, swRegistered, promptInstall, queueOfflineAttendance }
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('absensipro-offline', 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

function addToQueue(db, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite')
    const req = tx.objectStore('queue').add(item)
    req.onsuccess = resolve
    req.onerror = reject
  })
}
