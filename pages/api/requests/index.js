// pages/api/requests/index.js
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('requests')
      .select(`
        *,
        employees!requests_employee_id_fkey(name, employee_code),
        swap_employee:employees!requests_swap_with_employee_id_fkey(name),
        swap_shift:shifts!requests_swap_shift_id_fkey(name, start_time, end_time),
        reviewer:employees!requests_reviewed_by_fkey(name)
      `)
      .eq('employee_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ requests: data || [] })
  }

  if (req.method === 'POST') {
    const { type, start_date, end_date, reason, attachment_url, swap_with_employee_id, swap_date, swap_shift_id } = req.body

    if (!type || !start_date) {
      return res.status(400).json({ error: 'Tipe dan tanggal mulai wajib diisi' })
    }

    const validTypes = ['izin', 'cuti', 'sakit', 'tukar_shift', 'tukar_libur']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Tipe pengajuan tidak valid' })
    }

    // Validasi swap fields
    if ((type === 'tukar_shift' || type === 'tukar_libur') && !swap_with_employee_id) {
      return res.status(400).json({ error: 'Pilih karyawan yang akan ditukar' })
    }

    // Cek tidak ada pending request yang sama di tanggal yang sama
    const { data: existing } = await db
      .from('requests')
      .select('id')
      .eq('employee_id', req.user.id)
      .eq('start_date', start_date)
      .eq('type', type)
      .eq('status', 'pending')
      .single()

    if (existing) {
      return res.status(400).json({ error: 'Anda sudah punya pengajuan yang sama untuk tanggal ini' })
    }

    const { data, error } = await db.from('requests').insert({
      employee_id: req.user.id,
      type,
      start_date,
      end_date: end_date || start_date,
      reason,
      attachment_url: attachment_url || null,
      swap_with_employee_id: swap_with_employee_id || null,
      swap_date: swap_date || null,
      swap_shift_id: swap_shift_id || null,
      status: 'pending',
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ request: data, message: 'Pengajuan berhasil dikirim' })
  }

  return res.status(405).end()
}

export default requireAuth(handler)
