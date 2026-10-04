import type { EmailPasswordRegistrationInput, EmailPasswordSignInInput, UserDto } from '@chippy/shared'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { ChippyStore } from '../store.js'
import { DomainError } from '../core.store.js'

const KEY_LENGTH = 64
const SCRYPT_N = 16_384
const SCRYPT_R = 8
const SCRYPT_P = 1

const derive = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 32 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
})

async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`
}

async function passwordMatches(password: string, encoded: string | null) {
  if (!encoded) {
    await derive(password, Buffer.alloc(16))
    return false
  }
  const [algorithm, n, r, p, saltText, keyText] = encoded.split('$')
  if (algorithm !== 'scrypt' || Number(n) !== SCRYPT_N || Number(r) !== SCRYPT_R || Number(p) !== SCRYPT_P || !saltText || !keyText) return false
  const expected = Buffer.from(keyText, 'base64')
  if (expected.length !== KEY_LENGTH) return false
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, Buffer.from(saltText, 'base64'), expected.length, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 32 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export class PasswordAuthService {
  constructor(private store: ChippyStore) {}

  async register(input: EmailPasswordRegistrationInput): Promise<UserDto> {
    return this.store.createPasswordUser({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) })
  }

  async signIn(input: EmailPasswordSignInInput): Promise<UserDto> {
    const credential = await this.store.credentialByEmail(input.email)
    if (!credential || !await passwordMatches(input.password, credential.passwordHash)) throw new DomainError('INVALID_CREDENTIALS', 'Email or password is incorrect', 401)
    return credential.user
  }
}
