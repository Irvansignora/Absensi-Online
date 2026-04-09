// pages/api/admin/settings/index.js
// GET  → ambil settings perusahaan
// PUT  → update settings perusahaan

import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

async function handler(req, res) {
  const db = supabaseAdmin()

  // ── GET: ambil settings ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await db
      .from('company_settings')
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message })
    }

    // Return default jika belum ada
    const defaults = {
      company_name: 'PT. Perusahaan Anda',
      company_address: 'Jl. Contoh No. 1, Jakarta',
      company_phone: '021-12345678',
      company_email: 'info@perusahaan.com',
      company_logo_url: null,
      npwp: '',
      // Aturan kehadiran
      work_days_per_month: 22,
      late_tolerance_minutes: 15,
      // Potongan
      deduction_absent_type: 'daily',       // 'daily' = per hari, 'percent' = % gaji
      deduction_absent_percent: 0,           // jika type = percent
      deduction_late_per_30min: true,        // potong per 30 menit keterlambatan
      deduction_late_custom_amount: 0,       // nominal custom per keterlambatan (0 = pakai rumus)
      // BPJS
      bpjs_kesehatan_employee: 1,            // % ditanggung karyawan
      bpjs_kesehatan_employer: 4,            // % ditanggung perusahaan
      bpjs_jht_employee: 2,
      bpjs_jht_employer: 3.7,
      bpjs_jp_employee: 1,
      bpjs_jp_employer: 2,
      bpjs_max_salary_kes: 12000000,
      bpjs_max_salary_jp: 9500000,
      // PPh21
      ptkp_tk0: 54000000,
      // Lembur
      overtime_rate_hour1: 1.5,
      overtime_rate_hour2plus: 2,
      // Slip gaji
      slip_show_bpjs: true,
      slip_show_pph21: true,
      slip_footer_note: 'Slip gaji ini digenerate otomatis oleh sistem.',
    }

    return res.status(200).json({ settings: data || defaults })
  }

  // ── PUT: update settings ─────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const body = req.body

    // Cek apakah sudah ada record
    const { data: existing } = await db
      .from('company_settings')
      .select('id')
      .limit(1)
      .single()

    let result
    if (existing?.id) {
      const { data, error } = await db
        .from('company_settings')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      result = data
    } else {
      const { data, error } = await db
        .from('company_settings')
        .insert({ ...body })
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      result = data
    }

    return res.status(200).json({ settings: result, message: 'Settings berhasil disimpan' })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
