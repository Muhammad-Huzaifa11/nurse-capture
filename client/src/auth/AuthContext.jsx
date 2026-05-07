import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authApiFetch } from '@/lib/api'

const AUTH_STORAGE_KEY = 'nurse-capture-auth-token'

/**
 * @typedef {Object} AuthContextValue
 * @property {string} token
 * @property {any} user
 * @property {boolean} isAuthenticated
 * @property {boolean} isAuthReady
 * @property {(nextToken: string, nextUser?: any) => void} login
 * @property {() => void} logout
 * @property {(path: string, init?: RequestInit) => Promise<Response>} authFetch
 */

/** @type {import('react').Context<AuthContextValue | null>} */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState('')
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function bootstrapAuth() {
      const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
      if (!stored) {
        if (isMounted) setIsAuthReady(true)
        return
      }

      try {
        const response = await authApiFetch('/auth/me', stored)
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.ok) {
          throw new Error('Invalid session')
        }
        if (!isMounted) return
        setToken(stored)
        setUser(data.user ?? null)
        setIsAuthenticated(true)
      } catch (_error) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
        if (!isMounted) return
        setToken('')
        setUser(null)
        setIsAuthenticated(false)
      } finally {
        if (isMounted) setIsAuthReady(true)
      }
    }

    bootstrapAuth()
    return () => {
      isMounted = false
    }
  }, [])

  function login(nextToken, nextUser = null) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setIsAuthenticated(true)
  }

  function logout() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setToken('')
    setUser(null)
    setIsAuthenticated(false)
  }

  async function authFetch(path, init = {}) {
    const response = await authApiFetch(path, token, init)
    if (response.status === 401) {
      logout()
    }
    return response
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated,
      isAuthReady,
      login,
      logout,
      authFetch,
    }),
    [token, user, isAuthenticated, isAuthReady]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
