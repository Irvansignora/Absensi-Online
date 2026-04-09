// pages/api/admin/employees/template.js
// Serve the Excel template file for download
import { requireAuth } from '../../../../lib/auth'
import path from 'path'
import fs from 'fs'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const templatePath = path.join(process.cwd(), 'public', 'templates', 'template-import-karyawan.xlsx')

  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ error: 'Template tidak ditemukan. Hubungi administrator.' })
  }

  const file = fs.readFileSync(templatePath)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="template-import-karyawan.xlsx"')
  res.setHeader('Content-Length', file.length)
  return res.end(file)
}

export default requireAuth(handler, { adminOnly: true })
