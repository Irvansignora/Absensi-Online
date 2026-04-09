import { useEffect, useRef, useState } from 'react'

// ─── MediaPipe CDN loader ────────────────────────────────────────────────────
// Menggunakan @mediapipe/tasks-vision — tidak perlu folder /weights lokal
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3'

async function loadMediaPipe() {
  if (window._mpFaceDetector) return window._mpFaceDetector

  // 1. Load vision bundle dari CDN
  await new Promise((resolve, reject) => {
    if (document.querySelector('[data-mp-vision]')) { resolve(); return }
    const script = document.createElement('script')
    script.src = `${MEDIAPIPE_CDN}/vision_bundle.js`
    script.setAttribute('data-mp-vision', '1')
    script.crossOrigin = 'anonymous'
    script.onload = resolve
    script.onerror = () => reject(new Error('Gagal memuat MediaPipe dari CDN'))
    document.head.appendChild(script)
  })

  // 2. Resolve WASM & buat FaceDetector
  const { FilesetResolver, FaceDetector } = window

  const vision = await FilesetResolver.forVisionTasks(
    `${MEDIAPIPE_CDN}/wasm`
  )

  const detector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      // Model blaze_face_short_range — ringan & cepat untuk jarak dekat (selfie)
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.6,
  })

  window._mpFaceDetector = detector
  return detector
}

// ─── State konstanta ─────────────────────────────────────────────────────────
const S = {
  LOADING:   'loading',
  DETECTING: 'detecting',
  VERIFIED:  'verified',
  FAILED:    'failed',
}

// ─── Komponen utama ──────────────────────────────────────────────────────────
export default function FaceRecognition({ onVerified, onSkip, mode = 'checkin' }) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)
  const rafRef      = useRef(null)
  const detectorRef = useRef(null)

  const [state,     setState]     = useState(S.LOADING)
  const [message,   setMessage]   = useState('Memuat MediaPipe...')
  const [progress,  setProgress]  = useState(0)
  const [faceScore, setFaceScore] = useState(0)
  const [countdown, setCountdown] = useState(null)

  // ── Init: muat MediaPipe + kamera ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        setMessage('Menghubungkan ke Google MediaPipe...')
        setProgress(20)

        const detector = await loadMediaPipe()
        if (cancelled) return
        detectorRef.current = detector

        setProgress(60)
        setMessage('Mengakses kamera...')

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        const video = videoRef.current
        video.srcObject = stream
        await video.play()

        setProgress(100)
        setState(S.DETECTING)
        setMessage('Arahkan wajah ke kamera')
        startLoop(detector)
      } catch (err) {
        if (cancelled) return
        console.error('[FaceRec]', err)
        const msg = err.name === 'NotAllowedError'
          ? '❌ Akses kamera ditolak. Izinkan kamera di browser.'
          : `❌ Gagal memuat: ${err.message}`
        setMessage(msg)
        setState(S.FAILED)
      }
    }

    init()
    return () => {
      cancelled = true
      stopAll()
    }
  }, [])

  // ── Loop deteksi pakai requestAnimationFrame ───────────────────────────────
  function startLoop(detector) {
    let stableFrames = 0
    const NEEDED = 8

    async function detect() {
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect)
        return
      }

      // Deteksi wajah pada frame video saat ini
      let detections
      try {
        detections = detector.detectForVideo(video, performance.now()).detections
      } catch {
        rafRef.current = requestAnimationFrame(detect)
        return
      }

      // Gambar overlay ke canvas
      const ctx = canvas.getContext('2d')
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawGuide(ctx, canvas.width, canvas.height, false)

      if (!detections || detections.length === 0) {
        stableFrames = 0
        setFaceScore(0)
        setCountdown(null)
        setMessage('Tidak ada wajah terdeteksi — arahkan ke kamera')
        rafRef.current = requestAnimationFrame(detect)
        return
      }

      // Ambil deteksi dengan skor tertinggi
      const best = detections.reduce((a, b) =>
        (a.categories[0]?.score ?? 0) > (b.categories[0]?.score ?? 0) ? a : b
      )
      const score = best.categories[0]?.score ?? 0
      setFaceScore(Math.round(score * 100))

      // Koordinat bounding box (MediaPipe pakai nilai relatif 0-1)
      const bBox = best.boundingBox
      const x = bBox.originX * canvas.width
      const y = bBox.originY * canvas.height
      const w = bBox.width   * canvas.width
      const h = bBox.height  * canvas.height

      const faceArea   = (w * h) / (canvas.width * canvas.height)
      const isCentered  = x > canvas.width * 0.1 && (x + w) < canvas.width * 0.9
      const isBigEnough = faceArea > 0.04
      const isGood      = isCentered && isBigEnough && score > 0.7

      // Gambar kotak deteksi
      ctx.strokeStyle = isGood ? '#10B981' : '#F59E0B'
      ctx.lineWidth   = 3
      ctx.strokeRect(x, y, w, h)
      drawGuide(ctx, canvas.width, canvas.height, isGood)

      // Tandai keypoints (mata, hidung, mulut, telinga)
      if (best.keypoints) {
        best.keypoints.forEach(kp => {
          ctx.fillStyle = isGood ? '#10B981' : '#F59E0B'
          ctx.beginPath()
          ctx.arc(kp.x * canvas.width, kp.y * canvas.height, 3, 0, Math.PI * 2)
          ctx.fill()
        })
      }

      if (isGood) {
        stableFrames++
        const pct = Math.round((stableFrames / NEEDED) * 100)
        setMessage(`Memverifikasi wajah... ${pct}%`)

        if (stableFrames >= NEEDED - 3) setCountdown(Math.max(1, NEEDED - stableFrames))

        if (stableFrames >= NEEDED) {
          cancelAnimationFrame(rafRef.current)
          setCountdown(null)
          setState(S.VERIFIED)
          setMessage('✅ Wajah berhasil diverifikasi! Mengupload foto...')

          const snap = captureSnapshot(video)
          stopAll()

          try {
            const res  = await fetch('/api/attendance/upload-face', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ snapshot: snap }),
            })
            const data     = await res.json()
            const photoUrl = res.ok ? data.url : null
            if (photoUrl) setMessage('✅ Wajah terverifikasi & foto tersimpan!')
            setTimeout(() => onVerified({ snapshot: snap, score, photoUrl }), 600)
          } catch {
            setTimeout(() => onVerified({ snapshot: snap, score, photoUrl: null }), 600)
          }
          return
        }
      } else {
        stableFrames = Math.max(0, stableFrames - 1)
        setCountdown(null)
        if (!isCentered)   setMessage('Pusatkan wajah di tengah kamera')
        else if (!isBigEnough) setMessage('Dekatkan wajah ke kamera')
        else               setMessage('Kualitas gambar kurang — cari cahaya lebih terang')
      }

      rafRef.current = requestAnimationFrame(detect)
    }

    rafRef.current = requestAnimationFrame(detect)
  }

  function stopAll() {
    if (rafRef.current)    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  function captureSnapshot(video) {
    const c = document.createElement('canvas')
    c.width  = video.videoWidth
    c.height = video.videoHeight
    c.getContext('2d').drawImage(video, 0, 0)
    return c.toDataURL('image/jpeg', 0.85)
  }

  function drawGuide(ctx, w, h, good) {
    ctx.strokeStyle = good ? 'rgba(16,185,129,0.7)' : 'rgba(255,255,255,0.25)'
    ctx.lineWidth   = 2
    ctx.setLineDash([8, 4])
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, w * 0.22, h * 0.32, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isVerified = state === S.VERIFIED
  const isFailed   = state === S.FAILED
  const isLoading  = state === S.LOADING

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0B1629 0%, #0f2347 100%)' }}
    >
      {/* Header */}
      <div className="w-full max-w-sm mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Verifikasi Wajah</h2>
          <p className="text-blue-300 text-sm mt-0.5">
            {mode === 'checkin' ? '✅ Check-In' : '🚪 Check-Out'} — MediaPipe AI
          </p>
        </div>
        <button
          onClick={() => { stopAll(); onSkip() }}
          className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
        >
          Lewati →
        </button>
      </div>

      {/* Viewport kamera */}
      <div
        className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-slate-900 border-2 border-white/10"
        style={{
          boxShadow: isVerified
            ? '0 0 40px rgba(16,185,129,0.4)'
            : '0 0 40px rgba(37,99,235,0.2)',
        }}
      >
        {/* Video stream */}
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: 'scaleX(-1)',
            display: isLoading || isFailed ? 'none' : 'block',
          }}
        />

        {/* Canvas overlay deteksi */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: 'scaleX(-1)',
            display: isLoading || isFailed ? 'none' : 'block',
          }}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
            <div className="text-5xl animate-pulse">🤖</div>
            <div className="w-full">
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>Memuat MediaPipe...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="text-slate-400 text-sm text-center">{message}</p>
          </div>
        )}

        {/* Failed overlay */}
        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
            <div className="text-5xl">📷</div>
            <p className="text-white text-center font-medium">{message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Verified overlay */}
        {isVerified && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: 'rgba(16,185,129,0.15)' }}
          >
            <div className="text-7xl animate-bounce">✅</div>
            <p className="text-emerald-300 font-bold text-lg">Wajah Terverifikasi!</p>
          </div>
        )}

        {/* Countdown badge */}
        {countdown !== null && state === S.DETECTING && (
          <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">{countdown}</span>
          </div>
        )}

        {/* Skor badge */}
        {faceScore > 0 && state === S.DETECTING && (
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <p className="text-xs text-white font-mono">Skor: {faceScore}%</p>
          </div>
        )}

        {/* Corner guides */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-tr-xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400 rounded-bl-xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-xl pointer-events-none" />
      </div>

      {/* Pesan status */}
      <div className="mt-4 text-center max-w-sm">
        <p className="text-white font-medium">{message}</p>
        {state === S.DETECTING && (
          <p className="text-slate-400 text-xs mt-2">
            Pastikan wajah terlihat jelas, cahaya cukup, dan tidak pakai masker
          </p>
        )}
      </div>

      {/* Tips */}
      {state === S.DETECTING && (
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
