// pages/api/admin/branches/index.js
import { requireAuth } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabase'

const TIMEZONE_MAP = { WIB: 7, WITA: 8, WIT: 9 }

async function handler(req, res) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('branches')
      .select('*, employees(count)')
      .order('name')

    if (error) return res.status(500).json({ error: error.message })

    const branches = (data || []).map(b => ({
      ...b,
      employee_count: b.employees?.[0]?.count || 0,
      employees: undefined,
    }))
    return res.status(200).json({ branches })
  }

  if (req.method === 'POST') {
    const { name, address, city, phone, timezone, latitude, longitude, geofence_radius } = req.body
    if (!name) return res.status(400).json({ error: 'Nama cabang wajib diisi' })

    const tz        = timezone || 'WIB'
    const tz_offset = TIMEZONE_MAP[tz] ?? 7

    const { data, error } = await db.from('branches').insert({
      name, address, city, phone,
      timezone: tz,
      timezone_offset: tz_offset,
      latitude:        latitude  ? parseFloat(latitude)  : null,
      longitude:       longitude ? parseFloat(longitude) : null,
      geofence_radius: geofence_radius ? parseInt(geofence_radius) : null,
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ branch: data })
  }

  return res.status(405).end()
}

export default requireAuth(handler, { adminOnly: true })
