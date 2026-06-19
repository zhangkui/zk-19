import { create } from 'zustand'
import type { User } from '../types'
import { authApi } from '../services/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  setTokens: (access: string, refresh: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    const { access, refresh, user_id, role, name } = res.data
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    set({
      accessToken: access,
      refreshToken: refresh,
      isAuthenticated: true,
      user: {
        id: user_id,
        username,
        name,
        role,
        role_display: '',
        email: '',
        phone: '',
      } as User,
    })
    try {
      const meRes = await authApi.getMe()
      set({ user: meRes.data })
    } catch (e) {}
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },

  fetchMe: async () => {
    try {
      const res = await authApi.getMe()
      set({ user: res.data })
    } catch (e) {
      // ignore
    }
  },

  setTokens: (access: string, refresh: string) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
  },
}))
