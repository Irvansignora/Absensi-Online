// lib/cloudinary.js
// Upload base64 image to Cloudinary, returns secure_url
export async function uploadToCloudinary(base64DataUrl, options = 'absensi') {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary env vars belum diset (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)')
  }

  // Handle options: string (folder) or object
  const paramsObj = {
    timestamp: Math.round(Date.now() / 1000)
  }

  if (typeof options === 'string') {
    paramsObj.folder = options
  } else if (typeof options === 'object' && options !== null) {
    Object.assign(paramsObj, options)
    // Transformation if exists should be handled (Rest API accepts string)
    if (paramsObj.transformation && typeof paramsObj.transformation !== 'string') {
      // Basic conversion for common transformation object
      if (Array.isArray(paramsObj.transformation)) {
        paramsObj.transformation = paramsObj.transformation.map(t => {
          return Object.entries(t).map(([k, v]) => {
            const map = { width: 'w', height: 'h', crop: 'c' }
            return `${map[k] || k}_${v}`
          }).join(',')
        }).join('/')
      }
    }
  }

  // Build signature string: sort keys alphabetically
  const keys = Object.keys(paramsObj).sort()
  const signatureString = keys
    .map(k => `${k}=${paramsObj[k]}`)
    .join('&') + apiSecret

  // Node crypto untuk signature
  const crypto = await import('crypto')
  const signature = crypto
    .createHash('sha1')
    .update(signatureString)
    .digest('hex')

  // POST multipart ke Cloudinary REST API
  const formData = new URLSearchParams()
  formData.append('file',    base64DataUrl)
  formData.append('api_key', apiKey)
  formData.append('signature', signature)
  
  // Add all params to formData
  for (const k in paramsObj) {
    formData.append(k, String(paramsObj[k]))
  }

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
    url:        data.secure_url,
    secure_url: data.secure_url, // Provide both for compatibility
    public_id:  data.public_id,
    width:      data.width,
    height:     data.height,
  }
}
