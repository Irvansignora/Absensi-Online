import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../../lib/supabase'

// POST /api/setup - seed demo data (disable in production!)
export default async function handler(req, res) {
  if (process.env.NODE_ENV === 'production' && req.query.force !== 'yes') {
    return res.status(403).json({ error: 'Setup endpoint dinonaktifkan di production. Tambahkan ?force=yes untuk override.' })
  }

  const db = supabaseAdmin()

  try {
    // 1. Branches — insert only if name not exists
    let branches = []
    for (const b of [
      { name: 'Kantor Pusat', city: 'Jakarta', address: 'Jl. Sudirman No. 1, Jakarta Pusat', phone: '021-12345678' },
      { name: 'Cabang Bandung', city: 'Bandung', address: 'Jl. Braga No. 10, Bandung', phone: '022-87654321' },
      { name: 'Cabang Surabaya', city: 'Surabaya', address: 'Jl. Pemuda No. 5, Surabaya', phone: '031-11223344' },
    ]) {
      const { data: existing } = await db.from('branches').select('*').eq('name', b.name).single()
      if (existing) { branches.push(existing); continue }
      const { data, error } = await db.from('branches').insert(b).select().single()
      if (error) throw new Error('Branch error: ' + error.message)
      branches.push(data)
    }

    const pusat = branches.find(b => b.name === 'Kantor Pusat')
    const bandung = branches.find(b => b.name === 'Cabang Bandung')
    const surabaya = branches.find(b => b.name === 'Cabang Surabaya')

    // 2. Shifts — insert only if name not exists
    let shifts = []
    for (const s of [
      { name: 'Shift Pagi', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, work_days: ['Senin','Selasa','Rabu','Kamis','Jumat'] },
      { name: 'Shift Siang', start_time: '13:00', end_time: '22:00', late_tolerance_minutes: 15, work_days: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'] },
      { name: 'Shift Malam', start_time: '22:00', end_time: '07:00', late_tolerance_minutes: 15, work_days: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'] },
    ]) {
      const { data: existing } = await db.from('shifts').select('*').eq('name', s.name).single()
      if (existing) { shifts.push(existing); continue }
      const { data, error } = await db.from('shifts').insert(s).select().single()
      if (error) throw new Error('Shift error: ' + error.message)
      shifts.push(data)
    }

    const pagi = shifts.find(s => s.name === 'Shift Pagi')
    const siang = shifts.find(s => s.name === 'Shift Siang')

    // 3. Hash passwords
    const adminHash = await bcrypt.hash('admin123', 10)
    const empHash = await bcrypt.hash('karyawan123', 10)
    const hrHash = await bcrypt.hash('hr123456', 10)

    // 4. Employees — upsert on email (email has unique constraint)
    const { data: employees, error: empErr } = await db.from('employees').upsert([
      {
        name: 'Admin Sistem', email: 'admin@demo.com', password_hash: adminHash,
        employee_code: 'ADM-001', role: 'admin',
        branch_id: pusat?.id, shift_id: pagi?.id,
        department: 'IT', position: 'System Administrator', is_active: true
      },
      {
        name: 'Siti HR Manager', email: 'hr@demo.com', password_hash: hrHash,
        employee_code: 'HR-001', role: 'hr',
        branch_id: pusat?.id, shift_id: pagi?.id,
        department: 'Human Resources', position: 'HR Manager', is_active: true
      },
      {
        name: 'Budi Santoso', email: 'karyawan@demo.com', password_hash: empHash,
        employee_code: 'EMP-001', role: 'employee',
        branch_id: pusat?.id, shift_id: pagi?.id,
        department: 'Marketing', position: 'Staff Senior', phone: '08123456789', is_active: true
      },
      {
        name: 'Ani Wijaya', email: 'ani@demo.com', password_hash: empHash,
        employee_code: 'EMP-002', role: 'employee',
        branch_id: pusat?.id, shift_id: siang?.id,
        department: 'Finance', position: 'Akuntan', phone: '08234567890', is_active: true
      },
      {
        name: 'Reza Pratama', email: 'reza@demo.com', password_hash: empHash,
        employee_code: 'EMP-003', role: 'employee',
        branch_id: bandung?.id, shift_id: pagi?.id,
        department: 'Sales', position: 'Sales Executive', phone: '08345678901', is_active: true
      },
      {
        name: 'Dewi Lestari', email: 'dewi@demo.com', password_hash: empHash,
        employee_code: 'EMP-004', role: 'employee',
        branch_id: surabaya?.id, shift_id: pagi?.id,
        department: 'Operations', position: 'Staff Operasional', phone: '08456789012', is_active: true
      },
      {
        name: 'Dina Finance', email: 'finance@demo.com', password_hash: hrHash,
        employee_code: 'FIN-001', role: 'finance',
        branch_id: pusat?.id, shift_id: pagi?.id,
        department: 'Finance', position: 'Payroll Officer', is_active: true
      },
    ], { onConflict: 'email' }).select()

    if (empErr) throw new Error('Employee error: ' + empErr.message)

    // 5. Seed attendance history (last 7 days)
    const today = new Date()
    const attendanceRows = []

    for (const emp of employees.filter(e => e.role === 'employee')) {
      for (let i = 6; i >= 1; i--) {
        const date = new Date(today)
        date.setDate(today.getDate() - i)
        const dayOfWeek = date.getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) continue // skip weekends

        const dateStr = date.toISOString().split('T')[0]
        const rand = Math.random()
        let status = 'present'
        let checkInHour = 8, checkInMin = Math.floor(Math.random() * 10)

        if (rand < 0.1) {
          status = 'absent'
        } else if (rand < 0.25) {
          status = 'late'
          checkInHour = 8
          checkInMin = 20 + Math.floor(Math.random() * 40)
        }

        if (status !== 'absent') {
          const ci = new Date(date)
          ci.setHours(checkInHour, checkInMin, Math.floor(Math.random() * 60), 0)
          const co = new Date(date)
          co.setHours(17, Math.floor(Math.random() * 30), 0, 0)

          attendanceRows.push({
            employee_id: emp.id,
            branch_id: emp.branch_id,
            shift_id: emp.shift_id,
            date: dateStr,
            check_in: ci.toISOString(),
            check_out: co.toISOString(),
            status,
            check_in_note: status === 'late' ? 'Kena macet' : null,
          })
        }
      }
    }

    if (attendanceRows.length > 0) {
      const { error: attErr } = await db.from('attendances')
        .upsert(attendanceRows, { onConflict: 'employee_id,date' })
      if (attErr) throw new Error('Attendance seed error: ' + attErr.message)
    }

    return res.status(200).json({
      success: true,
      message: 'Setup berhasil! Data demo sudah dibuat.',
      data: {
        branches: branches.length,
        shifts: shifts.length,
        employees: employees.length,
        attendance_records: attendanceRows.length,
      },
      accounts: [
        { role: 'admin', email: 'admin@demo.com', password: 'admin123' },
        { role: 'hr', email: 'hr@demo.com', password: 'hr123456' },
        { role: 'karyawan', email: 'karyawan@demo.com', password: 'karyawan123' },
        { role: 'karyawan', email: 'ani@demo.com', password: 'karyawan123' },
        { role: 'karyawan', email: 'reza@demo.com', password: 'karyawan123' },
        { role: 'karyawan', email: 'dewi@demo.com', password: 'karyawan123' },
      ]
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
