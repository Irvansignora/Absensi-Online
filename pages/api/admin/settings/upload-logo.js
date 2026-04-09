// pages/api/admin/settings/upload-logo.js
// POST → upload logo perusahaan ke Cloudinary

import { requireAuth } from '../../../../lib/auth'
import { uploadToCloudinary } from '../../../../lib/cloudinary'

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } }

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { image } = req.body
  if (!image) return res.status(400).json({ error: 'image base64 wajib ada' })

  try {
    const result = await uploadToCloudinary(image, {
      folder: 'company-logo',
      public_id: 'company_logo',
      overwrite: true,
      transformation: [{ width: 400, height: 400, crop: 'limit' }],
    })
    return res.status(200).json({ url: result.secure_url })
  } catch (err) {
    return res.status(500).json({ error: 'Gagal upload logo: ' + err.message })
  }
}

export default requireAuth(handler, { adminOnly: true })
