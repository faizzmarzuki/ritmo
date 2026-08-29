import crypto from 'node:crypto'
import { config } from '../config.js'

const keyFor = (secret) => crypto.createHash('sha256').update(secret).digest()

/** AES-256-GCM. Provider access/refresh tokens never touch disk in plaintext. */
export function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFor(config.tokenEncKey), iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`
}

export function decrypt(payload) {
  if (!payload) return null
  const [version, iv, tag, body] = String(payload).split('.')
  if (version !== 'v1' || !iv || !tag || !body) return null
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyFor(config.tokenEncKey), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export const randomId = (bytes = 16) => crypto.randomBytes(bytes).toString('hex')
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return crypto.timingSafeEqual(expected, actual)
}
