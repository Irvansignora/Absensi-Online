// pages/api/admin/notify/blast.js
// Kirim WA blast ke karyawan yang belum absen hari ini
import { requireAuth }  from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'
import { notifyBlast }  from '../../../../lib/notify'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const db    = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]
  const { type, message, branch_id } = req.body

  if (type === 'not_checkin') {
    // Ambil semua karyawan aktif
    let empQ = db.from('employees').select('id, name, phone').eq('is_active', true).not('phone', 'is', null)
    if (branch_id) empQ = empQ.eq('branch_id', branch_id)
    const { data: allEmp } = await empQ

    // Ambil yang sudah check-in hari ini
    const { data: checkedIn } = await db
      .from('attendances').select('employee_id').eq('date', today).not('check_in', 'is', null)

    const checkedIds = new Set((checkedIn || []).map(a => a.employee_id))
    const targets = (allEmp || []).filter(e => e.phone && !checkedIds.has(e.id))

    if (!targets.length) {
      return res.status(200).json({ message: 'Semua karyawan sudah check-in', sent: 0 })
    }

    const results = await notifyBlast(targets, (t) =>
      message ||
      `⏰ *Pengingat Absensi*\n\nHalo ${t.name}!\n\nAnda belum melakukan check-in hari ini. Segera buka aplikasi WorkForce dan lakukan absensi.\n\nTerima kasih 🙏`
    )

    return res.status(200).json({ message: `Blast terkirim ke ${results.length} karyawan`, sent: results.length, targets: results })
  }

  return res.status(400).json({ error: 'Tipe blast tidak dikenali' })
}

export default requireAuth(handler, { adminOnly: true })
