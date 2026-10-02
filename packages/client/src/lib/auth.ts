import { api } from './api'

export type AuthUser = {
  id: string
  email: string
  name: string
  isAdmin: boolean
  mustChangePassword: boolean
}

export type LoginResponse = {
  token: string
  user: AuthUser
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then(r => r.data),

  me: () =>
    api.get<AuthUser>('/auth/me').then(r => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then(r => r.data),
}

export function getToken(): string | null {
  return localStorage.getItem('mc_token')
}

export function setToken(token: string) {
  localStorage.setItem('mc_token', token)
}

export function clearToken() {
  localStorage.removeItem('mc_token')
}
