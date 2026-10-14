import { useEffect, useState } from 'react'
import { authClient, useSession } from '../lib/auth-client.ts'
import { AuthDialog } from './AuthDialog.tsx'
import { Btn, Modal, TextInput } from './ui.tsx'

export function AccountMenu() {
  const { data: session, isPending } = useSession()
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [secOpen, setSecOpen] = useState(false)
  const [inviteOnly, setInviteOnly] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [verifyMsg, setVerifyMsg] = useState('')

  useEffect(() => {
    if (!session) return
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => setInviteOnly(!!h?.inviteOnly))
      .catch(() => {})
  }, [session])

  if (isPending) return <span className="text-xs text-slate-400">…</span>

  if (!session) {
    return (
      <>
        <Btn onClick={() => setAuthOpen(true)}>Sign in</Btn>
        {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}
      </>
    )
  }

  const email = session.user.email

  const resendVerify = async () => {
    setVerifyMsg('')
    try {
      const res = await authClient.sendVerificationEmail({ email, callbackURL: window.location.origin })
      if (res.error) throw new Error(res.error.message)
      setVerifyMsg('Verification email sent — check your inbox (and spam).')
    } catch (e) {
      setVerifyMsg(e instanceof Error ? e.message : 'Could not send')
    }
  }

  const newInvite = async () => {
    setInviteMsg('')
    try {
      const res = await fetch('/api/invites', { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error('could not create invite')
      const { code } = (await res.json()) as { code: string }
      await navigator.clipboard.writeText(`${location.origin}/?invite=${code}`)
      setInviteMsg('Invite link copied — share it; one account per code.')
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : 'failed')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-100"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {email.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-[140px] truncate text-slate-600">{email}</span>
      </button>
      {menuOpen && (
        <div className="absolute right-0 z-40 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {session.user.emailVerified === false && (
            <div className="mx-1 mb-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <p>Confirm your email to secure your account.</p>
              <button className="mt-1 font-medium underline" onClick={resendVerify}>
                Resend verification email
              </button>
              {verifyMsg && <p className="mt-1 text-amber-800">{verifyMsg}</p>}
            </div>
          )}
          {inviteOnly && (
            <>
              <button
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                onClick={newInvite}
              >
                Copy invite link
              </button>
              {inviteMsg && <div className="px-3 pb-1 text-[11px] text-slate-500">{inviteMsg}</div>}
            </>
          )}
          <button
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
            onClick={() => {
              setMenuOpen(false)
              setSecOpen(true)
            }}
          >
            Two-factor security
          </button>
          <button
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
            onClick={async () => {
              await authClient.signOut()
              setMenuOpen(false)
            }}
          >
            Sign out
          </button>
        </div>
      )}
      {secOpen && <TwoFactorDialog onClose={() => setSecOpen(false)} enabled={!!session.user.twoFactorEnabled} />}
    </div>
  )
}

/** Body cast helper: the client type marks `password` required, but with
 *  allowPasswordless the server accepts its omission for social accounts. */
type TwoFactorBody = { password?: string }

function TwoFactorDialog({ onClose, enabled }: { onClose: () => void; enabled: boolean }) {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [totpURI, setTotpURI] = useState('')
  const [qr, setQr] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [needsPassword, setNeedsPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!totpURI) return
    import('qrcode')
      .then((m) => m.default.toDataURL(totpURI, { margin: 1, width: 180 }))
      .then(setQr)
      .catch(() => setQr(''))
  }, [totpURI])

  const call = async (fn: () => Promise<void>) => {
    setError('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setBusy(false)
    }
  }

  const enable = () =>
    call(async () => {
      const body: TwoFactorBody = needsPassword ? { password } : {}
      const res = await authClient.twoFactor.enable(body as never)
      if (res.error) {
        const msg = res.error.message ?? 'Could not enable two-factor'
        if (!needsPassword && /password/i.test(msg)) {
          setNeedsPassword(true)
          throw new Error('This account has a password — enter it to confirm, then click Set up again.')
        }
        throw new Error(msg)
      }
      const data = res.data as { totpURI?: string; backupCodes?: string[] } | null
      setTotpURI(data?.totpURI ?? '')
      setBackupCodes(data?.backupCodes ?? [])
    })

  const verify = () =>
    call(async () => {
      const res = await authClient.twoFactor.verifyTotp({ code })
      if (res.error) throw new Error(res.error.message)
      onClose()
    })

  const disable = () =>
    call(async () => {
      const body: TwoFactorBody = needsPassword ? { password } : {}
      const res = await authClient.twoFactor.disable(body as never)
      if (res.error) {
        const msg = res.error.message ?? 'Could not disable two-factor'
        if (!needsPassword && /password/i.test(msg)) {
          setNeedsPassword(true)
          throw new Error('This account has a password — enter it to confirm, then click Disable again.')
        }
        throw new Error(msg)
      }
      onClose()
    })

  const secret = /secret=([^&]+)/.exec(totpURI)?.[1] ?? ''

  if (enabled && !totpURI) {
    return (
      <Modal title="Two-factor authentication" onClose={onClose}>
        <div className="space-y-3 text-sm">
          <p className="text-green-700">Two-factor is currently <b>on</b> for your account.</p>
          <p className="text-slate-500">
            Note: email/password sign-ins are challenged for the code. Google sign-ins are not challenged
            (BetterAuth limitation).
          </p>
          {needsPassword && <TextInput label="Password" value={password} onChange={setPassword} type="password" />}
          {error && <p className="text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Btn onClick={onClose} variant="ghost">
              Close
            </Btn>
            <Btn onClick={disable} disabled={busy} variant="danger">
              {busy ? '…' : 'Disable'}
            </Btn>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Two-factor authentication" onClose={onClose}>
      <div className="space-y-3 text-sm">
        {totpURI ? (
          <>
            <p className="text-slate-500">Scan this QR with your authenticator app, then enter a code to confirm.</p>
            {qr && (
              <img src={qr} alt="TOTP QR" className="mx-auto rounded-lg border border-slate-200" width={180} height={180} />
            )}
            <div className="rounded-md bg-slate-50 p-2">
              <div className="text-xs text-slate-400">Secret (manual entry)</div>
              <code className="break-all text-xs">{secret || totpURI}</code>
            </div>
            {backupCodes.length > 0 && (
              <div className="rounded-md bg-slate-50 p-2">
                <div className="text-xs text-slate-400">Backup codes — store these safely</div>
                <code className="break-all text-xs">{backupCodes.join('  ')}</code>
              </div>
            )}
            <TextInput label="Authenticator code" value={code} onChange={setCode} placeholder="123456" />
          </>
        ) : (
          <>
            <p className="text-slate-500">
              Set up an authenticator app. No password needed unless this account also has one.
            </p>
            {needsPassword && <TextInput label="Password" value={password} onChange={setPassword} type="password" />}
          </>
        )}

        {error && <p className="text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onClose} variant="ghost">
            Close
          </Btn>
          <Btn onClick={totpURI ? verify : enable} disabled={busy}>
            {busy ? '…' : totpURI ? 'Confirm' : 'Set up'}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
