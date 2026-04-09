// pages/api/admin/requests/[id].js
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { status, review_note } = req.body

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status harus approved atau rejected' })
    }

    const { data: reqData } = await db
      .from('requests')
      .select('*, employees!requests_employee_id_fkey(id, shift_id)')
      .eq('id', id)
      .single()

    if (!reqData) return res.status(404).json({ error: 'Pengajuan tidak ditemukan' })
    if (reqData.status !== 'pending') return res.status(400).json({ error: 'Pengajuan sudah diproses sebelumnya' })

    // Update request status
    const { data, error } = await db
      .from('requests')
      .update({
        status,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Jika diapprove & tipe cuti/izin/sakit → update attendance record jika hari ini
    if (status === 'approved') {
      const today = new Date().toISOString().split('T')[0]

      if (['izin', 'cuti', 'sakit'].includes(reqData.type)) {
        // Tandai attendance hari-hari yang dicakup sebagai leave
        const start = new Date(reqData.start_date)
        const end   = new Date(reqData.end_date || reqData.start_date)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]
          await db.from('attendances').upsert({
            employee_id: reqData.employee_id,
            date: dateStr,
            status: 'leave',
            check_in_note: `${reqData.type === 'sakit' ? 'Sakit' : reqData.type === 'cuti' ? 'Cuti' : 'Izin'}: ${reqData.reason || '-'}`,
          }, { onConflict: 'employee_id,date', ignoreDuplicates: false })
        }
      }

      // Tukar shift → update shift_id karyawan (temporary, sederhana)
      if (reqData.type === 'tukar_shift' && reqData.swap_shift_id && reqData.swap_with_employee_id) {
        // Catat di notes saja — implementasi penuh perlu tabel shift_swap_log
        // Ini dihandle via attendance notes
        await db.from('attendances').upsert({
          employee_id: reqData.employee_id,
          date: reqData.swap_date || reqData.start_date,
          check_in_note: `Tukar shift disetujui. Shift: ${reqData.swap_shift_id}`,
          status: 'present',
        }, { onConflict: 'employee_id,date', ignoreDuplicates: true })
      }
    }

    return res.status(200).json({ request: data, message: `Pengajuan berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}` })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
