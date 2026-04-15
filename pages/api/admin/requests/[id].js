// pages/api/admin/requests/[id].js
import { requireAuth }           from '../../../../lib/auth'
import { supabaseAdmin }         from '../../../../lib/supabase'
import { notifyRequestReview }   from '../../../../lib/notify'
import { MANAGER_ROLES }         from '../../../../lib/auth'

async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end()

  const db      = supabaseAdmin()
  const { id }  = req.query
  const { status, review_note } = req.body

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' })
  }

  // Manager hanya bisa approve request dari tim mereka
  if (req.user.role === 'manager') {
    const { data: req_ } = await db
      .from('leave_requests')
      .select('employee_id, employees!leave_requests_employee_id_fkey(manager_id)')
      .eq('id', id)
      .single()

    if (req_?.employees?.manager_id !== req.user.id) {
      return res.status(403).json({ error: 'Anda hanya bisa approve request dari tim Anda' })
    }
  }

  const { data, error } = await db
    .from('leave_requests')
    .update({
      status,
      review_note,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, employees!leave_requests_employee_id_fkey(name, phone)')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Update attendance jika izin disetujui untuk hari ini
  if (status === 'approved' && data.start_date) {
    const today = new Date().toISOString().split('T')[0]
    if (data.start_date <= today && (!data.end_date || data.end_date >= today)) {
      await db
        .from('attendances')
        .upsert({
          employee_id: data.employee_id,
          date:        today,
          status:      'leave',
          check_in_note: `Izin: ${data.reason || 'disetujui'}`,
        }, { onConflict: 'employee_id,date' })
    }
  }

  // WA Notification (fire & forget)
  if (data.employees?.phone) {
    notifyRequestReview({
      employee:   data.employees,
      request:    data,
      status,
      reviewNote: review_note,
    }).catch(() => {})
  }

  return res.status(200).json({ request: data })
}

export default requireAuth(handler, { roles: MANAGER_ROLES })
