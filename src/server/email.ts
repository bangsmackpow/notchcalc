import type { Env } from './env.ts'

export interface Mail {
  to: string
  subject: string
  text: string
  html?: string
  /** short tag for the delivery log, e.g. "verify" */
  kind?: string
}

/**
 * Sends via Resend and records the outcome in `mail_log` so delivery problems
 * (bad key, unverified domain, bounce) are diagnosable without worker logs.
 */
export async function sendEmail(env: Env, mail: Mail): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false

  let ok = false
  let status = 0
  let detail = ''
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM ?? 'notchcalc <onboarding@resend.dev>',
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
      }),
    })
    status = res.status
    ok = res.ok
    if (!res.ok) detail = (await res.text().catch(() => '')).slice(0, 400)
  } catch (e) {
    detail = String(e).slice(0, 400)
  }

  try {
    await env.DB.prepare(
      'INSERT INTO mail_log (id, email, kind, ok, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), mail.to, mail.kind ?? 'generic', ok ? 1 : 0, status, detail, Date.now())
      .run()
  } catch (e) {
    console.error('mail_log write failed', e)
  }

  if (!ok) console.error('resend error', status, detail)
  return ok
}
