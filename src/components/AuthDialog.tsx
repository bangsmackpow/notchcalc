import { useState } from 'react'
import { authClient } from '../lib/auth-client.ts'
import { Btn, Modal, TextInput } from './ui.tsx'

type Stage = 'signin' | 'signup' | 'totp'

export function AuthDialog({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setError('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const submit = () =>
    run(async () => {
      if (stage === 'signin') {
        const res = await authClient.signIn.email({ email, password })
        if (res.error) throw new Error(res.error.message)
        if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
          setStage('totp')
          return
        }
        onClose()
      } else if (stage === 'signup') {
        const res = await authClient.signUp.email({ email, password, name: name || email })
        if (res.error) throw new Error(res.error.message)
        onClose()
      } else {
        const res = await authClient.twoFactor.verifyTotp({ code })
        if (res.error) throw new Error(res.error.message)
        onClose()
      }
    })

  const google = () =>
    run(async () => {
      const res = await authClient.signIn.social({ provider: 'google', callbackURL: window.location.href })
      if (res?.error) throw new Error(res.error.message ?? 'Google sign-in failed')
    })

  const title = stage === 'signup' ? 'Create account' : stage === 'totp' ? 'Two-factor code' : 'Sign in'

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        {stage === 'totp' ? (
          <>
            <p className="text-sm text-slate-500">Enter the 6-digit code from your authenticator app.</p>
            <TextInput label="Code" value={code} onChange={setCode} placeholder="123456" />
          </>
        ) : (
          <>
            {stage === 'signup' && <TextInput label="Name" value={name} onChange={setName} placeholder="Your name" />}
            <TextInput label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
            <TextInput label="Password" value={password} onChange={setPassword} type="password" placeholder="min 8 characters" />
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <button
            className="text-sm text-slate-500 hover:text-slate-800"
            onClick={() => {
              setError('')
              setStage(stage === 'signup' ? 'signin' : 'signup')
            }}
            disabled={stage === 'totp'}
          >
            {stage === 'signup' ? 'Have an account? Sign in' : 'No account? Sign up'}
          </button>
          <Btn onClick={submit} disabled={busy}>
            {busy ? '…' : stage === 'signup' ? 'Create' : stage === 'totp' ? 'Verify' : 'Sign in'}
          </Btn>
        </div>

        {stage !== 'totp' && (
          <>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
            </div>
            <Btn onClick={google} disabled={busy}>
              Continue with Google
            </Btn>
          </>
        )}
      </div>
    </Modal>
  )
}
