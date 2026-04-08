// lib/cloudinary.js
// Upload base64 image to Cloudinary, returns secure_url
export async function uploadToCloudinary(base64DataUrl, folder = 'absensi') {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary env vars belum diset (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)')
  }

  // Build signature (timestamp + params)
  const timestamp = Math.round(Date.now() / 1000)
  const params    = `folder=${folder}&timestamp=${timestamp}`

  // Node crypto untuk signature
  const crypto = await import('crypto')
  const signature = crypto
    .createHash('sha1')
    .update(params + apiSecret)
    .digest('hex')

  // POST multipart ke Cloudinary REST API
  const formData = new URLSearchParams()
  formData.append('file',      base64DataUrl)   // Cloudinary terima data URI langsung
  formData.append('api_key',   apiKey)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)
  formData.append('folder',    folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Cloudinary error: ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return {
    url:       data.secure_url,
    public_id: data.public_id,
    width:     data.width,
    height:    data.height,
  }
}
