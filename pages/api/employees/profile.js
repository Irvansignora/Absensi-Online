// pages/api/employees/profile.js
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import bcrypt from 'bcryptjs'
import { signToken, setAuthCookie } from '../../../lib/auth'

async function handler(req, res) {
  const db = supabaseAdmin()

  // GET: profil lengkap karyawan
  if (req.method === 'GET') {
    const { data, error } = await db
      .from('employees')
      .select('id, name, email, phone, employee_code, department, position, role, branch_id, shift_id, is_active, created_at, branches(name, city), shifts(name, start_time, end_time)')
      .eq('id', req.user.id)
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Hitung sisa cuti (dari leave_requests approved bulan ini)
    const thisYear = new Date().getFullYear()
    const { data: leaves } = await db
      .from('leave_requests')
      .select('start_date, end_date, type')
      .eq('employee_id', req.user.id)
      .eq('status', 'approved')
      .in('type', ['cuti'])
      .gte('start_date', `${thisYear}-01-01`)

    const usedLeave = (leaves || []).reduce((sum, l) => {
      const start = new Date(l.start_date)
      const end   = new Date(l.end_date || l.start_date)
      const days  = Math.ceil((end - start) / 86400000) + 1
      return sum + days
    }, 0)

    const leaveQuota = data.leave_quota || 12
    const leaveLeft  = Math.max(0, leaveQuota - usedLeave)

    // Stats absensi bulan ini
    const now = new Date()
    const startMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const { data: monthAtt } = await db
      .from('attendances')
      .select('status, overtime_minutes, overtime_approved')
      .eq('employee_id', req.user.id)
      .gte('date', startMonth)

    const stats = {
      present:  (monthAtt || []).filter(a => ['present','half_day'].includes(a.status)).length,
      late:     (monthAtt || []).filter(a => a.status === 'late').length,
      absent:   (monthAtt || []).filter(a => a.status === 'absent').length,
      overtime_approved: (monthAtt || []).filter(a => a.overtime_approved).reduce((s,a) => s + (a.overtime_minutes||0), 0),
    }

    return res.status(200).json({
      employee: data,
      leave: { quota: leaveQuota, used: usedLeave, remaining: leaveLeft },
      monthly_stats: stats,
    })
  }

  // PATCH: update profil (phone, name)
  if (req.method === 'PATCH') {
    const { name, phone, current_password, new_password } = req.body
    const updates = {}

    if (name?.trim())  updates.name  = name.trim()
    if (phone?.trim()) updates.phone = phone.trim()

    // Ganti password jika diminta
    if (new_password) {
      if (!current_password) return res.status(400).json({ error: 'Password lama wajib diisi' })
      const { data: emp } = await db.from('employees').select('password_hash').eq('id', req.user.id).single()
      const valid = await bcrypt.compare(current_password, emp.password_hash)
      if (!valid) return res.status(400).json({ error: 'Password lama salah' })
      if (new_password.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' })
      updates.password_hash = await bcrypt.hash(new_password, 10)
    }

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Tidak ada data yang diubah' })

    const { data, error } = await db
      .from('employees')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, email, phone, role, branch_id, shift_id')
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Refresh JWT cookie jika nama berubah
    if (updates.name) {
      const token = signToken({ ...req.user, name: data.name })
      setAuthCookie(res, token)
    }

    return res.status(200).json({ employee: data, message: 'Profil berhasil diupdate' })
  }

  return res.status(405).end()
}

export default requireAuth(handler)
