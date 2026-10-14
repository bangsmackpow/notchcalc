import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'
import type { Env } from './env.ts'

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

  return betterAuth({
    appName: 'notchcalc',
    baseURL: env.BETTER_AUTH_URL ?? origin,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders,
    plugins: [twoFactor()],
    trustedOrigins: Array.from(new Set([origin, env.BETTER_AUTH_URL ?? origin])),
  })
}

export type Auth = ReturnType<typeof createAuth>
