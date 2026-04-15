// lib/auth.js
import jwt from 'jsonwebtoken'
import { serialize, parse } from 'cookie'

const JWT_SECRET  = process.env.JWT_SECRET || 'fallback_dev_secret_change_in_prod'
const COOKIE_NAME = 'attendance_token'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

export function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24,
    path:     '/',
  }))
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   -1,
    path:     '/',
  }))
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

// Role hierarchy:
//   admin   → full access
//   hr      → employee + requests + reports, no payroll
//   finance → payroll only
//   manager → team attendance + approve team requests
//   employee → own data only

export const ADMIN_ROLES   = ['admin', 'hr', 'finance', 'manager']
export const FULL_ADMIN    = ['admin', 'hr']
export const PAYROLL_ROLES = ['admin', 'finance']
export const MANAGER_ROLES = ['admin', 'hr', 'manager']

export function requireAuth(handler, { adminOnly = false, roles = null } = {}) {
  return async (req, res) => {
    const user = getUserFromRequest(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized - silakan login terlebih dahulu' })
    }
    if (adminOnly && !ADMIN_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden - akses terbatas untuk role Anda' })
    }
    if (roles && !roles.includes(user.role)) {
      return res.status(403).json({ error: `Forbidden - hanya untuk role: ${roles.join(', ')}` })
    }
    req.user = user
    return handler(req, res)
  }
}
