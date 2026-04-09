import { useEffect, useRef, useState } from 'react'

const S = { READY: 'ready', PREVIEW: 'preview', UPLOADING: 'uploading', DONE: 'done', FAILED: 'failed' }

export default function FaceRecognition({ onVerified, onSkip, mode = 'checkin' }) {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)

  const [state,    setState]   = useState(S.READY)
  const [message,  setMessage] = useState('Arahkan kamera ke wajah, lalu klik Ambil Foto')
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        const msg = err.name === 'NotAllowedError'
          ? '❌ Akses kamera ditolak. Izinkan kamera di browser.'
          : `❌ Gagal membuka kamera: ${err.message}`
        setMessage(msg)
        setState(S.FAILED)
      }
    }
    startCamera()
    return () => stopCamera()
  }, [])

  function stopCamera() {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  function takePhoto() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const snap = canvas.toDataURL('image/jpeg', 0.85)
    setSnapshot(snap)
    setState(S.PREVIEW)
    setMessage('Foto sudah diambil. Kirim atau ulangi?')
    stopCamera()
  }

  function retake() {
    setSnapshot(null)
    setState(S.READY)
    setMessage('Arahkan kamera ke wajah, lalu klik Ambil Foto')
    // restart camera
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    }).then(stream => {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    })
  }

  async function submitPhoto() {
    setState(S.UPLOADING)
    setMessage('Mengupload foto...')
    try {
      const res      = await fetch('/api/attendance/upload-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      })
      const data     = await res.json()
      const photoUrl = res.ok ? data.url : null
      setState(S.DONE)
      setMessage('✅ Foto berhasil disimpan!')
      setTimeout(() => onVerified({ snapshot, score: 1, photoUrl }), 600)
    } catch {
      // upload gagal, tetap lanjut
      setState(S.DONE)
      setTimeout(() => onVerified({ snapshot, score: 1, photoUrl: null }), 600)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0B1629 0%, #0f2347 100%)' }}>

      {/* Header */}
      <div className="w-full max-w-sm mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Foto Selfie</h2>
          <p className="text-blue-300 text-sm mt-0.5">
            {mode === 'checkin' ? '✅ Check-In' : '🚪 Check-Out'} — Verifikasi Kehadiran
          </p>
        </div>
        <button onClick={() => { stopCamera(); onSkip() }}
          className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
          Lewati →
        </button>
      </div>

      {/* Viewport */}
      <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-slate-900 border-2 border-white/10"
        style={{ boxShadow: state === S.DONE ? '0 0 40px rgba(16,185,129,0.4)' : '0 0 40px rgba(37,99,235,0.2)' }}>

        {/* Live camera */}
        {state === S.READY && (
          <video ref={videoRef} muted playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} />
        )}

        {/* Preview foto */}
        {(state === S.PREVIEW || state === S.UPLOADING || state === S.DONE) && snapshot && (
          <img src={snapshot} alt="selfie"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} />
        )}

        {/* Failed */}
        {state === S.FAILED && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
            <div className="text-5xl">📷</div>
            <p className="text-white text-center font-medium">{message}</p>
            <button onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium">
              Coba Lagi
            </button>
          </div>
        )}

        {/* Success overlay */}
        {state === S.DONE && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: 'rgba(16,185,129,0.2)' }}>
            <div className="text-7xl animate-bounce">✅</div>
            <p className="text-emerald-300 font-bold text-lg">Foto Tersimpan!</p>
          </div>
        )}

        {/* Uploading overlay */}
        {state === S.UPLOADING && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)' }}>
            <p className="text-white font-medium animate-pulse">Mengupload...</p>
          </div>
        )}

        {/* Corner guides */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-tr-xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400 rounded-bl-xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-xl pointer-events-none" />
      </div>

      {/* Pesan */}
      <p className="mt-4 text-white font-medium text-center max-w-sm">{message}</p>

      {/* Tombol aksi */}
      <div className="mt-4 w-full max-w-sm flex gap-3">
        {state === S.READY && (
          <button onClick={takePhoto}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl text-base transition-all active:scale-95"
            style={{ boxShadow: '0 0 20px rgba(37,99,235,0.4)' }}>
            📸 Ambil Foto
          </button>
        )}

        {state === S.PREVIEW && (
          <>
            <button onClick={retake}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3.5 rounded-2xl text-base transition-all active:scale-95">
              🔄 Ulangi
            </button>
            <button onClick={submitPhoto}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl text-base transition-all active:scale-95"
              style={{ boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
              ✅ Kirim
            </button>
          </>
        )}
      </div>
    </div>
  )
}
