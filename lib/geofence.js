// lib/geofence.js
// Validasi geofence (Haversine formula)

/**
 * Hitung jarak antara dua titik koordinat (meter)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // radius bumi dalam meter
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * Cek apakah koordinat user ada dalam radius cabang
 * @returns { valid: boolean, distance: number, message?: string }
 */
export function checkGeofence(branch, userLat, userLng) {
  // Jika cabang belum punya koordinat → bypass (tidak validasi)
  if (!branch.latitude || !branch.longitude) {
    return { valid: true, distance: null, bypassed: true }
  }

  const radius   = branch.geofence_radius || 100 // default 100m
  const distance = haversineDistance(
    parseFloat(branch.latitude),
    parseFloat(branch.longitude),
    parseFloat(userLat),
    parseFloat(userLng),
  )

  const valid = distance <= radius

  return {
    valid,
    distance: Math.round(distance),
    radius,
    message: valid
      ? `Lokasi valid (${Math.round(distance)}m dari kantor)`
      : `Anda berada ${Math.round(distance)}m dari kantor. Maksimal radius: ${radius}m`,
  }
}
