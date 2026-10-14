import { describe, expect, it } from 'vitest'
import { isEmailVerificationOn, isInviteOnly, normalizeBase } from './env.ts'

describe('normalizeBase', () => {
  it('strips trailing slashes', () => {
    expect(normalizeBase('https://notchcalc.pages.dev/')).toBe('https://notchcalc.pages.dev')
    expect(normalizeBase('http://localhost:8788///')).toBe('http://localhost:8788')
  })
  it('keeps clean URLs unchanged', () => {
    expect(normalizeBase('https://example.com')).toBe('https://example.com')
  })
})

describe('env flags', () => {
  const base = { DB: {} as D1Database }
  it('invite only requires the literal string true', () => {
    expect(isInviteOnly({ ...base, INVITE_ONLY: 'true' })).toBe(true)
    expect(isInviteOnly({ ...base, INVITE_ONLY: '1' })).toBe(false)
    expect(isInviteOnly(base)).toBe(false)
  })
  it('email verification follows the Resend key', () => {
    expect(isEmailVerificationOn({ ...base, RESEND_API_KEY: 're_x' })).toBe(true)
    expect(isEmailVerificationOn(base)).toBe(false)
  })
})
