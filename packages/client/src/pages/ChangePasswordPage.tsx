import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { authApi } from '@/lib/auth'

export function ChangePasswordPage() {
  const { refetch, user } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next !== confirm) { setError('Passwords do not match'); return }
    if (next.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await authApi.changePassword(current, next)
      await refetch()
      navigate('/projects')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="flex items-center justify-center rounded" style={{ width: 28, height: 28, background: 'var(--accent)' }}>
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
              <path d="M2 4h9M2 7h6M2 10h4" stroke="#0F1117" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-bold text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Mock<span style={{ color: 'var(--accent)' }}>Camp</span>
          </span>
        </div>

        <div className="rounded-md px-3 py-2 mb-5 text-xs" style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)', color: 'var(--warning)' }}>
          You must set a new password before continuing.
        </div>

        <h1 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Set new password
        </h1>
        <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
          Hi {user?.name}. Choose a strong password for your account.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { label: 'Current password', val: current, set: setCurrent, placeholder: '••••••••' },
            { label: 'New password', val: next, set: setNext, placeholder: 'min. 8 characters' },
            { label: 'Confirm new password', val: confirm, set: setConfirm, placeholder: '••••••••' },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
              <input
                type="password"
                value={val}
                onChange={e => set(e.target.value)}
                placeholder={placeholder}
                required
                className="rounded-md px-3 py-2 text-sm outline-none transition-all"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
              />
            </div>
          ))}

          {error && (
            <p className="text-xs rounded-md px-3 py-2" style={{ background: 'rgba(245,101,101,0.1)', color: 'var(--error)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md py-2 text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#0F1117' }}
          >
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
