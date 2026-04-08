import { useEffect, useRef, useState, useCallback } from 'react'

// Load face-api.js from CDN dynamically
async function loadFaceApi() {
  if (window.faceapi) return window.faceapi
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return window.faceapi
}

const MODEL_URL = '/weights'

const STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  DETECTING: 'detecting',
  VERIFIED: 'verified',
  FAILED: 'failed',
}

export default function FaceRecognition({ onVerified, onSkip, mode = 'checkin' }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)

  const [state, setState] = useState(STATES.LOADING)
  const [message, setMessage] = useState('Memuat model AI...')
  const [progress, setProgress] = useState(0)
  const [faceScore, setFaceScore] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [countdown, setCountdown] = useState(null)

  // Load models & start camera
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        setMessage('Memuat model pengenalan wajah...')
        setProgress(10)
        const faceapi = await loadFaceApi()

        setProgress(30)
        setMessage('Mengunduh model AI (±2MB)...')

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ])

        if (cancelled) return
        setProgress(70)
        setMessage('Mengakses kamera...')

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setProgress(100)
        setMessage('Arahkan wajah ke kamera')
        setState(STATES.READY)
        startDetection(faceapi)
      } catch (err) {
        if (cancelled) return
        console.error('[FaceRec]', err)
        if (err.name === 'NotAllowedError') {
          setMessage('❌ Akses kamera ditolak. Izinkan kamera di browser.')
        } else {
          setMessage('❌ Gagal memuat: ' + err.message)
        }
        setState(STATES.FAILED)
      }
    }
    init()
    return () => {
      cancelled = true
      stopEverything()
    }
  }, [])

  function stopEverything() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  function startDetection(faceapi) {
    setState(STATES.DETECTING)
    let stableFrames = 0
    const NEEDED_FRAMES = 8  // need 8 consecutive good frames

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return
      const video = videoRef.current
      if (video.readyState < 2) return

      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
      const result = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks(true)
        .withFaceExpressions()

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (!result) {
        stableFrames = 0
        setFaceScore(0)
        setMessage('Tidak ada wajah terdeteksi — arahkan ke kamera')
        drawGuide(ctx, canvas.width, canvas.height, false)
        return
      }

      const { box } = result.detection
      const score = result.detection.score
      setFaceScore(Math.round(score * 100))

      // Check face is centered & large enough
      const faceArea = (box.width * box.height) / (canvas.width * canvas.height)
      const isCentered = box.x > canvas.width * 0.15 && (box.x + box.width) < canvas.width * 0.85
      const isLargeEnough = faceArea > 0.05

      // Draw detection box
      ctx.strokeStyle = (isCentered && isLargeEnough) ? '#10B981' : '#F59E0B'
      ctx.lineWidth = 3
      ctx.strokeRect(box.x, box.y, box.width, box.height)
      drawGuide(ctx, canvas.width, canvas.height, isCentered && isLargeEnough)

      if (isCentered && isLargeEnough && score > 0.7) {
        stableFrames++
        const pct = Math.round((stableFrames / NEEDED_FRAMES) * 100)
        setMessage(`Memverifikasi wajah... ${pct}%`)

        // Countdown display
        if (stableFrames >= NEEDED_FRAMES - 3) {
          setCountdown(Math.max(1, NEEDED_FRAMES - stableFrames))
        }

        if (stableFrames >= NEEDED_FRAMES) {
          clearInterval(intervalRef.current)
          setCountdown(null)

          // Capture snapshot
          const snap = captureSnapshot(video)
          setState(STATES.VERIFIED)
          setMessage('✅ Wajah berhasil diverifikasi! Mengupload foto...')
          stopEverything()

          // Upload snapshot ke Cloudinary via API
          try {
            const uploadRes = await fetch('/api/attendance/upload-face', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ snapshot: snap }),
            })
            const uploadData = await uploadRes.json()
            const photoUrl = uploadRes.ok ? uploadData.url : null
            if (photoUrl) setMessage('✅ Wajah terverifikasi & foto tersimpan!')
            setTimeout(() => onVerified({ snapshot: snap, score, photoUrl }), 600)
          } catch {
            // Kalau upload gagal, tetap lanjut tanpa foto
            setTimeout(() => onVerified({ snapshot: snap, score, photoUrl: null }), 600)
          }
        }
      } else {
        stableFrames = Math.max(0, stableFrames - 1)
        setCountdown(null)
        if (!isCentered) setMessage('Pusatkan wajah di tengah kamera')
        else if (!isLargeEnough) setMessage('Dekatkan wajah ke kamera')
        else setMessage('Kualitas gambar kurang — cari cahaya lebih terang')
      }
    }, 200)
  }

  function captureSnapshot(video) {
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    c.getContext('2d').drawImage(video, 0, 0)
    return c.toDataURL('image/jpeg', 0.8)
  }

  function drawGuide(ctx, w, h, good) {
    // Oval guide
    ctx.strokeStyle = good ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, w * 0.22, h * 0.32, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  const stateConfig = {
    [STATES.LOADING]:    { bg: 'from-slate-800 to-slate-900', icon: '⏳' },
    [STATES.READY]:      { bg: 'from-blue-900 to-slate-900',  icon: '📷' },
    [STATES.DETECTING]:  { bg: 'from-blue-900 to-slate-900',  icon: '🔍' },
    [STATES.VERIFIED]:   { bg: 'from-emerald-800 to-slate-900', icon: '✅' },
    [STATES.FAILED]:     { bg: 'from-red-900 to-slate-900',   icon: '❌' },
  }
  const cfg = stateConfig[state] || stateConfig[STATES.IDLE]

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0B1629 0%, #0f2347 100%)' }}>

      {/* Header */}
      <div className="w-full max-w-sm mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl font-display">Verifikasi Wajah</h2>
          <p className="text-blue-300 text-sm mt-0.5">
            {mode === 'checkin' ? '✅ Check-In' : '🚪 Check-Out'} — Identifikasi Karyawan
          </p>
        </div>
        <button onClick={() => { stopEverything(); onSkip() }}
          className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
          Lewati →
        </button>
      </div>

      {/* Camera viewport */}
      <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-slate-900 border-2 border-white/10"
        style={{ boxShadow: state === STATES.VERIFIED ? '0 0 40px rgba(16,185,129,0.4)' : '0 0 40px rgba(37,99,235,0.2)' }}>

        {/* Video */}
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', display: state === STATES.LOADING || state === STATES.FAILED ? 'none' : 'block' }}
        />

        {/* Detection canvas overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', display: state === STATES.LOADING || state === STATES.FAILED ? 'none' : 'block' }}
        />

        {/* Loading overlay */}
        {state === STATES.LOADING && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
            <div className="text-5xl animate-pulse">🤖</div>
            <div className="w-full">
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>Memuat AI...</span><span>{progress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }} />
              </div>
            </div>
            <p className="text-slate-400 text-sm text-center">{message}</p>
          </div>
        )}

        {/* Failed overlay */}
        {state === STATES.FAILED && (
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
        {state === STATES.VERIFIED && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: 'rgba(16,185,129,0.15)' }}>
            <div className="text-7xl animate-bounce">✅</div>
            <p className="text-emerald-300 font-bold text-lg">Wajah Terverifikasi!</p>
          </div>
        )}

        {/* Countdown badge */}
        {countdown !== null && state === STATES.DETECTING && (
          <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">{countdown}</span>
          </div>
        )}

        {/* Score badge */}
        {faceScore > 0 && state === STATES.DETECTING && (
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <p className="text-xs text-white font-mono">Skor: {faceScore}%</p>
          </div>
        )}

        {/* Vignette corners */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-tr-xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400 rounded-bl-xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-xl pointer-events-none" />
      </div>

      {/* Status message */}
      <div className="mt-4 text-center max-w-sm">
        <p className="text-white font-medium">{message}</p>
        {state === STATES.DETECTING && (
          <p className="text-slate-400 text-xs mt-2">
            Pastikan wajah terlihat jelas, cahaya cukup, dan tidak pakai masker
          </p>
        )}
      </div>

      {/* Tips */}
      {(state === STATES.READY || state === STATES.DETECTING) && (
        <div className="mt-4 grid grid-cols-3 gap-2 w-full max-w-sm">
          {[
            { icon: '💡', tip: 'Cahaya terang' },
            { icon: '👤', tip: 'Tanpa masker' },
            { icon: '📐', tip: 'Wajah di tengah' },
          ].map(t => (
            <div key={t.tip} className="bg-white/5 rounded-xl p-2.5 text-center">
              <div className="text-lg">{t.icon}</div>
              <p className="text-slate-400 text-xs mt-1">{t.tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
