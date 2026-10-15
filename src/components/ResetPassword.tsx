import { useState } from 'react'
import { authClient } from '../lib/auth-client.ts'
import { Btn, Modal, TextInput } from './ui.tsx'

export function ResetPasswordDialog({
  token,
  invalid,
  onClose,
}: {
  token?: string
  invalid?: boolean
  onClose: () => void
}) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setError('')
    if (pw.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (pw !== pw2) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await authClient.resetPassword({ newPassword: pw, token })
      if (res.error) throw new Error(res.error.message)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset password')
    } finally {
      setBusy(false)
    }
  }

  if (invalid || !token) {
    return (
      <Modal title="Reset link invalid" onClose={onClose}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            This password reset link is invalid or has expired. Request a new one from the sign-in dialog
            (&ldquo;Forgot password?&rdquo;).
          </p>
          <div className="flex justify-end">
            <Btn onClick={onClose}>Close</Btn>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Choose a new password" onClose={onClose}>
      <div className="space-y-3 text-sm">
        {done ? (
          <>
            <p className="text-green-700">Password updated. You can now sign in with your new password.</p>
            <div className="flex justify-end">
              <Btn onClick={onClose}>Close</Btn>
            </div>
          </>
        ) : (
          <>
            <TextInput label="New password" value={pw} onChange={setPw} type="password" placeholder="min 8 characters" />
            <TextInput label="Confirm password" value={pw2} onChange={setPw2} type="password" />
            {error && <p className="text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Btn onClick={onClose} variant="ghost">
                Cancel
              </Btn>
              <Btn onClick={submit} disabled={busy}>
                {busy ? '…' : 'Set password'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
