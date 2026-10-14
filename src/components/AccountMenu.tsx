import { useState } from 'react'
import { authClient, useSession } from '../lib/auth-client.ts'
import { AuthDialog } from './AuthDialog.tsx'
import { Btn, Modal, TextInput } from './ui.tsx'

export function AccountMenu() {
  const { data: session, isPending } = useSession()
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [secOpen, setSecOpen] = useState(false)

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
        <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
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
      {secOpen && <TwoFactorDialog onClose={() => setSecOpen(false)} />}
    </div>
  )
}

function TwoFactorDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [totpURI, setTotpURI] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const enable = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await authClient.twoFactor.enable({ password })
      if (res.error) throw new Error(res.error.message)
      const data = res.data as { totpURI?: string; backupCodes?: string[] } | null
      setTotpURI(data?.totpURI ?? '')
      setBackupCodes(data?.backupCodes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await authClient.twoFactor.verifyTotp({ code })
      if (res.error) throw new Error(res.error.message)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setBusy(false)
    }
  }

  const secret = /secret=([^&]+)/.exec(totpURI)?.[1] ?? ''

  return (
    <Modal title="Two-factor authentication" onClose={onClose}>
      <div className="space-y-3 text-sm">
        {done ? (
          <p className="text-green-700">Two-factor is enabled for your account.</p>
        ) : totpURI ? (
          <>
            <p className="text-slate-500">Add this account to your authenticator app, then enter a code to confirm.</p>
            <div className="rounded-md bg-slate-50 p-2">
              <div className="text-xs text-slate-400">Secret</div>
              <code className="break-all text-xs">{secret || totpURI}</code>
              <button
                className="mt-1 text-xs text-slate-500 underline"
                onClick={() => navigator.clipboard.writeText(secret || totpURI)}
              >
                copy
              </button>
            </div>
            {backupCodes.length > 0 && (
              <div className="rounded-md bg-slate-50 p-2">
                <div className="text-xs text-slate-400">Backup codes</div>
                <code className="text-xs">{backupCodes.join('  ')}</code>
              </div>
            )}
            <TextInput label="Authenticator code" value={code} onChange={setCode} placeholder="123456" />
          </>
        ) : (
          <>
            <p className="text-slate-500">Confirm your password to set up an authenticator app.</p>
            <TextInput label="Password" value={password} onChange={setPassword} type="password" />
          </>
        )}

        {error && <p className="text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onClose} variant="ghost">
            Close
          </Btn>
          {!done && (
            <Btn onClick={totpURI ? verify : enable} disabled={busy}>
              {busy ? '…' : totpURI ? 'Confirm' : 'Set up'}
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  )
}
