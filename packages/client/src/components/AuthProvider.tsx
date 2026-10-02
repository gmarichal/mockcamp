import { useState, useEffect, useCallback } from 'react'
import { AuthContext } from '@/hooks/useAuth'
import { authApi, setToken, clearToken, getToken } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    if (!getToken()) { setIsLoading(false); return }
    try {
      const me = await authApi.me()
      setUser(me)
    } catch {
      clearToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchMe() }, [fetchMe])

  const login = async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password)
    setToken(token)
    setUser(user)
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  )
}
