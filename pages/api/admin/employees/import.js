// pages/api/admin/employees/import.js
import bcrypt from 'bcryptjs'
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'
import { IncomingForm } from 'formidable'
import * as XLSX from 'xlsx'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const db = supabaseAdmin()

  // Parse multipart form
  const form = new IncomingForm({ maxFileSize: 5 * 1024 * 1024 })
  let file
  try {
    const [, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve([fields, files])
      })
    })
    file = files.file?.[0] || files.file
    if (!file) return res.status(400).json({ error: 'File tidak ditemukan' })
  } catch (e) {
    return res.status(400).json({ error: 'Gagal membaca file: ' + e.message })
  }

  // Parse Excel
  let rows
  try {
    const buf = fs.readFileSync(file.filepath || file.path)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheetName = wb.SheetNames.find(n => n.includes('Karyawan')) || wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]

    // Header ada di row 4, data mulai row 5 (index 4)
    // XLSX.utils.sheet_to_json: header row = row index
    rows = XLSX.utils.sheet_to_json(ws, {
      range: 3,          // row index 3 = row 4 di Excel (0-indexed)
      defval: '',
      raw: false,
    })
  } catch (e) {
    return res.status(400).json({ error: 'Gagal membaca Excel: ' + e.message })
  }

  if (!rows || rows.length === 0) {
    return res.status(400).json({ error: 'File kosong atau format tidak sesuai template' })
  }

  // Filter out example rows (italic green rows have nilai yg sama persis contoh)
  const exampleEmails = ['budi@perusahaan.com', 'siti@perusahaan.com', 'ahmad@perusahaan.com']
  rows = rows.filter(r => {
    const email = (r['EMAIL *'] || r['email'] || '').toString().toLowerCase().trim()
    return email && !exampleEmails.includes(email) && email !== 'email *'
  })

  if (rows.length === 0) {
    return res.status(400).json({ error: 'Tidak ada data karyawan yang valid. Pastikan sudah menghapus baris contoh.' })
  }

  if (rows.length > 500) {
    return res.status(400).json({ error: 'Maksimal 500 baris per import' })
  }

  // Load branches & shifts for lookup
  const [{ data: branches }, { data: shifts }] = await Promise.all([
    db.from('branches').select('id, name'),
    db.from('shifts').select('id, name'),
  ])

  const branchMap = {}
  ;(branches || []).forEach(b => { branchMap[b.name.toLowerCase().trim()] = b.id })
  const shiftMap = {}
  ;(shifts || []).forEach(s => { shiftMap[s.name.toLowerCase().trim()] = s.id })

  // Process rows
  const results = []
  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1

    // Normalize column names (support both template format & plain)
    const get = (...keys) => {
      for (const k of keys) {
        const val = row[k]
        if (val !== undefined && val !== '') return val.toString().trim()
      }
      return ''
    }

    const name          = get('NAMA *', 'nama', 'Nama')
    const email         = get('EMAIL *', 'email', 'Email').toLowerCase()
    const password      = get('PASSWORD *', 'password', 'Password')
    const employee_code = get('EMPLOYEE_CODE', 'employee_code', 'Kode Karyawan')
    const role          = get('ROLE', 'role', 'Role') || 'employee'
    const phone         = get('PHONE', 'phone', 'Telepon')
    const department    = get('DEPARTMENT', 'department', 'Departemen')
    const position      = get('POSITION', 'position', 'Jabatan')
    const branch_name   = get('BRANCH_NAME', 'branch_name', 'Cabang')
    const shift_name    = get('SHIFT_NAME', 'shift_name', 'Shift')
    const is_active_raw = get('IS_ACTIVE', 'is_active', 'Aktif')

    // Validasi wajib
    if (!name || !email || !password) {
      results.push({ row: rowNum, email: email || '-', status: 'error', message: 'Kolom nama, email, dan password wajib diisi' })
      errorCount++
      continue
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ row: rowNum, email, status: 'error', message: 'Format email tidak valid' })
      errorCount++
      continue
    }
    if (password.length < 6) {
      results.push({ row: rowNum, email, status: 'error', message: 'Password minimal 6 karakter' })
      errorCount++
      continue
    }
    const validRoles = ['employee', 'hr', 'admin']
    const normalizedRole = validRoles.includes(role.toLowerCase()) ? role.toLowerCase() : 'employee'

    const branch_id = branch_name ? (branchMap[branch_name.toLowerCase().trim()] || null) : null
    const shift_id  = shift_name  ? (shiftMap[shift_name.toLowerCase().trim()]   || null) : null
    const is_active = is_active_raw.toLowerCase() !== 'false'

    const password_hash = await bcrypt.hash(password, 10)

    const payload = {
      name,
      email,
      password_hash,
      employee_code: employee_code || null,
      role: normalizedRole,
      phone: phone || null,
      department: department || null,
      position: position || null,
      branch_id,
      shift_id,
      is_active,
    }

    const { error } = await db.from('employees').insert(payload)

    if (error) {
      if (error.code === '23505') {
        results.push({ row: rowNum, email, status: 'skip', message: 'Email sudah terdaftar, dilewati' })
        skipCount++
      } else {
        results.push({ row: rowNum, email, status: 'error', message: error.message })
        errorCount++
      }
    } else {
      results.push({ row: rowNum, email, name, status: 'success', message: 'Berhasil ditambahkan' })
      successCount++
    }
  }

  return res.status(200).json({
    message: `Import selesai: ${successCount} berhasil, ${skipCount} dilewati, ${errorCount} gagal`,
    summary: { total: rows.length, success: successCount, skip: skipCount, error: errorCount },
    results,
  })
}

export default requireAuth(handler, { adminOnly: true })
