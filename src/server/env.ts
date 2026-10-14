export interface Env {
  DB: D1Database
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  /** When set, sign-ups send a verification email via Resend; otherwise auto-verify (dev). */
  RESEND_API_KEY?: string
  /** From address for Resend, e.g. "notchcalc <verify@yourdomain.com>" */
  MAIL_FROM?: string
  /** "true" enables invite-only sign-ups */
  INVITE_ONLY?: string
}

export const isInviteOnly = (env: Env): boolean => env.INVITE_ONLY === 'true'
export const isEmailVerificationOn = (env: Env): boolean => !!env.RESEND_API_KEY

/** Strip trailing slashes — a mis-set BETTER_AUTH_URL would otherwise
 *  produce `//api/auth/...` in Google callback / verification links. */
export const normalizeBase = (url: string): string => url.replace(/\/+$/, '')
