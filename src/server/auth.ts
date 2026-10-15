import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'
import { sendEmail } from './email.ts'
import { normalizeBase, type Env } from './env.ts'

export function createAuth(env: Env, origin: string) {
  const socialProviders =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined

  const base = normalizeBase(env.BETTER_AUTH_URL ?? origin)

  return betterAuth({
    appName: 'notchcalc',
    baseURL: base,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      resetPasswordTokenExpiresIn: 3600,
      // Invalidate other sessions after a successful reset.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          kind: 'reset',
          subject: 'Reset your notchcalc password',
          text: `Reset your notchcalc password (link expires in 1 hour): ${url}`,
          html: `<p>We received a request to reset your <b>notchcalc</b> password.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in 1 hour. If you didn't request it, you can ignore this email.</p>`,
        })
      },
    },
    socialProviders,
    // allowPasswordless: Google-only accounts have no local password, so the
    // password step is dropped for them (still required for email accounts).
    plugins: [twoFactor({ allowPasswordless: true })],
    trustedOrigins: Array.from(new Set([origin, base])),
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 8 },
        '/sign-up/email': { window: 3600, max: 12 },
        '/request-password-reset': { window: 3600, max: 5 },
      },
    },
    emailVerification: {
      // Required: without sendOnSignUp BetterAuth creates the user but never
      // dispatches a verification email.
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        // Await the send: BetterAuth awaits this handler, and a floating
        // promise would be cancelled once the Worker response returns.
        const sent = await sendEmail(env, {
          to: user.email,
          kind: 'verify',
          subject: 'Verify your notchcalc email',
          text: `Confirm your email to finish setting up your account: ${url}`,
          html: `<p>Confirm your email to finish setting up your <b>notchcalc</b> account:</p><p><a href="${url}">Verify email</a></p>`,
        })
        if (!sent && !env.RESEND_API_KEY) {
          // No email transport configured (dev/demo): auto-verify so sign-up
          // is not a dead end. With RESEND_API_KEY set but failing, leave the
          // account unverified and surface the error in logs.
          try {
            await env.DB.prepare(`UPDATE "user" SET "emailVerified" = 1 WHERE "id" = ?`).bind(user.id).run()
            await env.DB.prepare(
              'INSERT INTO mail_log (id, email, kind, ok, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
              .bind(crypto.randomUUID(), user.email, 'auto-verify', 1, 0, 'no transport configured', Date.now())
              .run()
          } catch (e) {
            console.error('auto-verify fallback failed', e)
          }
        }
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
