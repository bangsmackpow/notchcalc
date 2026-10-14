import type { Env } from './env.ts'

export interface Mail {
  to: string
  subject: string
  text: string
  html?: string
}

/** Sends via Resend. Returns false when no API key is configured or the call fails. */
export async function sendEmail(env: Env, mail: Mail): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false
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
    if (!res.ok) console.error('resend error', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (e) {
    console.error('resend fetch failed', e)
    return false
  }
}
