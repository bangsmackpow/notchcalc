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
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
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
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        // Never await user-facing flows on email delivery.
        void sendEmail(env, {
          to: user.email,
          subject: 'Verify your notchcalc email',
          text: `Confirm your email to finish setting up your account: ${url}`,
          html: `<p>Confirm your email to finish setting up your <b>notchcalc</b> account:</p><p><a href="${url}">Verify email</a></p>`,
        }).then(async (sent) => {
          if (!sent && !env.RESEND_API_KEY) {
            // No email transport configured (dev/demo): auto-verify so sign-up
            // is not a dead end. With RESEND_API_KEY set but failing, leave
            // the account unverified and surface the error in logs.
            try {
              await env.DB.prepare(`UPDATE "user" SET "emailVerified" = 1 WHERE "id" = ?`).bind(user.id).run()
            } catch (e) {
              console.error('auto-verify fallback failed', e)
            }
          }
        })
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
