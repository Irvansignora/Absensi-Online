// lib/notify.js
// Sistem notifikasi: WhatsApp via Fonnte & Telegram Bot
// Setup env: WA_PROVIDER=fonnte|twilio, FONNTE_TOKEN, TELEGRAM_BOT_TOKEN

const WA_PROVIDER  = process.env.WA_PROVIDER  || 'fonnte'   // 'fonnte' | 'twilio'
const FONNTE_TOKEN = process.env.FONNTE_TOKEN  || ''
const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

// ─── Low-level senders ────────────────────────────────────────────────────────

async function sendWhatsAppFonnte(phone, message) {
  if (!FONNTE_TOKEN) return { ok: false, reason: 'FONNTE_TOKEN not set' }
  const normalized = normalizePhone(phone)
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': FONNTE_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: normalized, message, countryCode: '62' }),
    })
    const data = await res.json()
    return { ok: data.status === true, raw: data }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

async function sendTelegram(chatId, message) {
  if (!TG_BOT_TOKEN || !chatId) return { ok: false, reason: 'Telegram not configured' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    })
    const data = await res.json()
    return { ok: data.ok, raw: data }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  if (!phone) return ''
  let p = phone.replace(/\D/g, '')
  if (p.startsWith('0')) p = '62' + p.slice(1)
  if (!p.startsWith('62')) p = '62' + p
  return p
}

function fmtTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Kirim WA — graceful (tidak lempar error, cukup log)
async function sendWA(phone, message) {
  if (!phone) return
  try {
    const result = await sendWhatsAppFonnte(phone, message)
    if (!result.ok) console.warn('[notify] WA failed:', result.reason || result.raw)
  } catch (e) {
    console.warn('[notify] WA exception:', e.message)
  }
}

// ─── Public notification functions ───────────────────────────────────────────

/**
 * Notif saat karyawan berhasil check-in
 */
export async function notifyCheckIn({ employee, attendance }) {
  if (!employee?.phone) return
  const status = attendance.status === 'late' ? '⚠️ Terlambat' : '✅ Tepat Waktu'
  const msg = [
    `🕒 *Check-In Berhasil*`,
    ``,
    `Halo ${employee.name}!`,
    `Absensi masuk Anda telah tercatat:`,
    ``,
    `📅 Tanggal : ${fmtDate(attendance.date)}`,
    `⏰ Jam Masuk: ${fmtTime(attendance.check_in)}`,
    `📍 Status  : ${status}`,
    attendance.check_in_note ? `📝 Catatan  : ${attendance.check_in_note}` : '',
    ``,
    `Semangat bekerja! 💪`,
    `— *WorkForce Attendance System*`,
  ].filter(Boolean).join('\n')

  await sendWA(employee.phone, msg)
}

/**
 * Notif saat karyawan berhasil check-out
 */
export async function notifyCheckOut({ employee, attendance, overtime_minutes = 0 }) {
  if (!employee?.phone) return
  const workMs   = new Date(attendance.check_out) - new Date(attendance.check_in)
  const workHrs  = Math.floor(workMs / 3600000)
  const workMins = Math.floor((workMs % 3600000) / 60000)

  const lines = [
    `🏁 *Check-Out Berhasil*`,
    ``,
    `Halo ${employee.name}!`,
    `Absensi pulang Anda telah tercatat:`,
    ``,
    `📅 Tanggal   : ${fmtDate(attendance.date)}`,
    `⏰ Jam Keluar: ${fmtTime(attendance.check_out)}`,
    `⏱️ Total Kerja: ${workHrs}j ${workMins}m`,
  ]

  if (overtime_minutes > 0) {
    const otH = Math.floor(overtime_minutes / 60)
    const otM = overtime_minutes % 60
    lines.push(`🔥 Lembur    : ${otH}j ${otM}m (menunggu persetujuan)`)
  }

  lines.push(``, `Sampai jumpa besok! 👋`, `— *WorkForce Attendance System*`)

  await sendWA(employee.phone, lines.join('\n'))
}

/**
 * Notif saat pengajuan izin/cuti disetujui atau ditolak
 */
export async function notifyRequestReview({ employee, request, status, reviewNote }) {
  if (!employee?.phone) return
  const approved = status === 'approved'
  const TYPE_LABEL = {
    izin: 'Izin', cuti: 'Cuti', sakit: 'Sakit',
    tukar_shift: 'Tukar Shift', tukar_libur: 'Tukar Libur',
  }
  const msg = [
    approved ? `✅ *Pengajuan Disetujui*` : `❌ *Pengajuan Ditolak*`,
    ``,
    `Halo ${employee.name},`,
    `Pengajuan ${TYPE_LABEL[request.type] || request.type} Anda telah ${approved ? 'disetujui' : 'ditolak'}.`,
    ``,
    `📋 Jenis  : ${TYPE_LABEL[request.type] || request.type}`,
    `📅 Tanggal: ${fmtDate(request.start_date)}${request.end_date && request.end_date !== request.start_date ? ` s/d ${fmtDate(request.end_date)}` : ''}`,
    reviewNote ? `💬 Catatan : ${reviewNote}` : '',
    ``,
    approved
      ? `Selamat! Silakan rencanakan kegiatan Anda. 🎉`
      : `Jika ada pertanyaan, silakan hubungi HRD.`,
    `— *WorkForce Attendance System*`,
  ].filter(Boolean).join('\n')

  await sendWA(employee.phone, msg)
}

/**
 * Notif saat slip gaji tersedia
 */
export async function notifyPayslipReady({ employee, payroll }) {
  if (!employee?.phone) return
  const period = new Date(payroll.year, payroll.month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const fmt    = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

  const msg = [
    `💰 *Slip Gaji Tersedia*`,
    ``,
    `Halo ${employee.name}!`,
    `Slip gaji Anda untuk periode *${period}* sudah tersedia.`,
    ``,
    `💵 Gaji Bersih: *${fmt(payroll.net_salary)}*`,
    ``,
    `Silakan login ke aplikasi WorkForce untuk melihat detail slip gaji Anda.`,
    `— *WorkForce Attendance System*`,
  ].join('\n')

  await sendWA(employee.phone, msg)
}

/**
 * Notif lembur disetujui/ditolak
 */
export async function notifyOvertimeReview({ employee, overtime, status }) {
  if (!employee?.phone) return
  const approved = status === 'approved'
  const otH = Math.floor(overtime.minutes / 60)
  const otM = overtime.minutes % 60

  const msg = [
    approved ? `✅ *Lembur Disetujui*` : `❌ *Lembur Ditolak*`,
    ``,
    `Halo ${employee.name},`,
    `Lembur Anda tanggal ${fmtDate(overtime.date)} (${otH}j ${otM}m) telah ${approved ? 'disetujui' : 'ditolak'}.`,
    approved ? `Akan dihitung dalam penggajian berikutnya. 💪` : `Jika ada pertanyaan, hubungi HRD.`,
    `— *WorkForce Attendance System*`,
  ].join('\n')

  await sendWA(employee.phone, msg)
}

/**
 * Blast notif ke banyak nomor (misal: reminder belum absen)
 * targets: [{ phone, name }]
 */
export async function notifyBlast(targets, messageFactory) {
  const results = []
  for (const t of targets) {
    const msg = messageFactory(t)
    await sendWA(t.phone, msg)
    results.push({ phone: t.phone, name: t.name })
    // Throttle biar ga kena rate limit
    await new Promise(r => setTimeout(r, 300))
  }
  return results
}
