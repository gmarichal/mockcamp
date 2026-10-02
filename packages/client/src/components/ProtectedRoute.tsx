import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

type Props = {
  children: React.ReactNode
  requirePasswordChanged?: boolean
}

export function ProtectedRoute({ children, requirePasswordChanged = false }: Props) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (requirePasswordChanged && user.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}
