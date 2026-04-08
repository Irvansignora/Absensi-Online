// pages/api/attendance/upload-face.js
// Endpoint: POST /api/attendance/upload-face
// Body: { snapshot: "data:image/jpeg;base64,..." }
// Returns: { url: "https://res.cloudinary.com/..." }

import { requireAuth } from '../../../lib/auth'
import { uploadToCloudinary } from '../../../lib/cloudinary'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb', // foto webcam max ~1MB, kasih ruang lebih
    },
  },
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { snapshot } = req.body
  if (!snapshot || !snapshot.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Snapshot tidak valid' })
  }

  try {
    // Folder per-employee biar rapi: absensi/EMP-001/
    const folder = `absensi/${req.user.employee_code || req.user.id}`
    const result = await uploadToCloudinary(snapshot, folder)

    return res.status(200).json({ url: result.url, public_id: result.public_id })
  } catch (err) {
    console.error('[upload-face]', err)
    return res.status(500).json({ error: err.message })
  }
}

export default requireAuth(handler)
