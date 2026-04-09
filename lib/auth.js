import jwt from 'jsonwebtoken'
import { serialize, parse } from 'cookie'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_change_in_prod'
const COOKIE_NAME = 'attendance_token'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export function setAuthCookie(res, token) {
  const cookie = serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })
  res.setHeader('Set-Cookie', cookie)
}

export function clearAuthCookie(res) {
  const cookie = serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: -1,
    path: '/',
  })
  res.setHeader('Set-Cookie', cookie)
}

export function getTokenFromRequest(req) {
  const cookies = parse(req.headers.cookie || '')
  return cookies[COOKIE_NAME]
}

export function getUserFromRequest(req) {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyToken(token)
}

export function requireAuth(handler, { adminOnly = false } = {}) {
  return async (req, res) => {
    const user = getUserFromRequest(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized - silakan login terlebih dahulu' })
    }
    if (adminOnly && !['admin', 'hr', 'finance'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden - akses terbatas untuk role Anda' })
    }
    req.user = user
    return handler(req, res)
  }
}
