import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, authApiFetch } from '@/lib/api'

const SEAT_STORAGE_KEY = 'nurse-capture-seat-token'
const SEAT_SNAPSHOT_KEY = 'nurse-capture-seat-snapshot'

/**
 * @typedef {Object} Seat
 * @property {string} id
 * @property {string} label
 * @property {string} unitKey
 * @property {string} shift
 *
 * @typedef {Object} SeatAuthContextValue
 * @property {string} token
 * @property {Seat | null} seat
 * @property {boolean} isAuthenticated
 * @property {boolean} isAuthReady
 * @property {boolean} isStale
 * @property {boolean} isOnline
 * @property {string | null} lastDisconnectReason
 * @property {(code: string) => Promise<void>} redeemCode
 * @property {(reason?: string | null) => void} clearSeat
 * @property {(path: string, init?: RequestInit) => Promise<Response>} seatFetch
 */

/** @type {import('react').Context<SeatAuthContextValue | null>} */
const SeatAuthContext = createContext(null)

function readSnapshot() {
  try {
    const raw = window.localStorage.getItem(SEAT_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.label) {
      return parsed
    }
    return null
  } catch (_err) {
    return null
  }
}

function writeSnapshot(seat) {
  try {
    window.localStorage.setItem(SEAT_SNAPSHOT_KEY, JSON.stringify(seat))
  } catch (_err) {
    /* localStorage may be full or unavailable; non-fatal. */
  }
}

function clearSnapshot() {
  try {
    window.localStorage.removeItem(SEAT_SNAPSHOT_KEY)
  } catch (_err) {
    /* non-fatal */
  }
}

export function SeatAuthProvider({ children }) {
  const [token, setToken] = useState('')
  const [seat, setSeat] = useState(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  /** True when the seat was loaded from a local snapshot, not freshly verified. */
  const [isStale, setIsStale] = useState(false)
  const [lastDisconnectReason, setLastDisconnectReason] = useState(null)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  )

  const isAuthenticated = Boolean(token && seat)

  /** Used to dedupe revalidation attempts. */
  const revalidateInFlight = useRef(false)

  /**
   * Verify the stored token. Returns 'ok' | 'unauthorized' | 'offline'.
   * - 'ok'           → server confirmed the seat; refresh local snapshot.
   * - 'unauthorized' → server returned 401; caller should clear token + snapshot.
   * - 'offline'      → fetch threw or server unreachable; caller should keep token + snapshot.
   */
  const verifyToken = useCallback(async (storedToken) => {
    let response
    try {
      response = await authApiFetch('/auth/seat/me', storedToken)
    } catch (_networkError) {
      return { status: 'offline' }
    }
    if (response.status === 401) {
      return { status: 'unauthorized' }
    }
    if (!response.ok) {
      /** Treat 5xx the same as offline — don't kick the nurse out for a server hiccup. */
      return { status: 'offline' }
    }
    const data = await response.json().catch(() => null)
    if (!data?.ok || !data.seat) {
      return { status: 'offline' }
    }
    return { status: 'ok', seat: data.seat }
  }, [])

  /** Boot: try to validate any stored token. Tolerant of network failure. */
  useEffect(() => {
    let isMounted = true
    async function bootstrap() {
      const storedToken = window.localStorage.getItem(SEAT_STORAGE_KEY)
      if (!storedToken) {
        if (isMounted) setIsAuthReady(true)
        return
      }
      const cachedSeat = readSnapshot()

      const result = await verifyToken(storedToken)
      if (!isMounted) return

      if (result.status === 'ok') {
        setToken(storedToken)
        setSeat(result.seat)
        setIsStale(false)
        writeSnapshot(result.seat)
      } else if (result.status === 'unauthorized') {
        window.localStorage.removeItem(SEAT_STORAGE_KEY)
        clearSnapshot()
        setToken('')
        setSeat(null)
        setIsStale(false)
        setLastDisconnectReason('Your previous session ended. Enter your code to continue.')
      } else if (cachedSeat) {
        /**
         * Offline / server unreachable. Keep the user logged in optimistically
         * with the cached seat. The chip stays accurate; we'll revalidate on
         * the next `online` event.
         */
        setToken(storedToken)
        setSeat(cachedSeat)
        setIsStale(true)
      } else {
        /**
         * Offline AND no snapshot. We can't show a chip, so fall back to the
         * gate. (This only happens on a fresh install that has never been
         * online, which shouldn't happen because redemption requires network.)
         */
        setToken('')
        setSeat(null)
        setIsStale(false)
      }
      setIsAuthReady(true)
    }
    bootstrap()
    return () => {
      isMounted = false
    }
  }, [verifyToken])

  /** Track online/offline so the UI can react. */
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
    }
    function handleOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  /** When we come back online with a stale seat, revalidate quietly. */
  useEffect(() => {
    if (!isOnline || !isStale || !token) return
    if (revalidateInFlight.current) return
    revalidateInFlight.current = true
    let cancelled = false
    ;(async () => {
      const result = await verifyToken(token)
      revalidateInFlight.current = false
      if (cancelled) return
      if (result.status === 'ok') {
        setSeat(result.seat)
        setIsStale(false)
        writeSnapshot(result.seat)
      } else if (result.status === 'unauthorized') {
        window.localStorage.removeItem(SEAT_STORAGE_KEY)
        clearSnapshot()
        setToken('')
        setSeat(null)
        setIsStale(false)
        setLastDisconnectReason('Your session ended while offline. Enter your code to continue.')
      }
      /** 'offline' again → leave isStale true, will retry on next online flap. */
    })()
    return () => {
      cancelled = true
    }
  }, [isOnline, isStale, token, verifyToken])

  const redeemCode = useCallback(async (code) => {
    const trimmed = (code || '').trim()
    if (!trimmed) {
      throw new Error('Please enter a code.')
    }
    const response = await apiFetch('/auth/seat/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed.toUpperCase() }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || 'Code not recognized.')
    }
    window.localStorage.setItem(SEAT_STORAGE_KEY, data.token)
    writeSnapshot(data.seat)
    setToken(data.token)
    setSeat(data.seat ?? null)
    setIsStale(false)
    setLastDisconnectReason(null)
  }, [])

  const clearSeat = useCallback((reason = null) => {
    window.localStorage.removeItem(SEAT_STORAGE_KEY)
    clearSnapshot()
    setToken('')
    setSeat(null)
    setIsStale(false)
    setLastDisconnectReason(reason)
  }, [])

  /**
   * `seatFetch` attaches the seat bearer header. On 401 it clears the token so
   * the gate naturally re-renders. On network errors it rethrows so the caller
   * can decide whether to queue / retry / show an offline UX.
   */
  const seatFetch = useCallback(
    async (path, init = {}) => {
      const response = await authApiFetch(path, token, init)
      if (response.status === 401) {
        clearSeat('Your session ended. Enter your code to continue.')
      }
      return response
    },
    [token, clearSeat]
  )

  const value = useMemo(
    () => ({
      token,
      seat,
      isAuthenticated,
      isAuthReady,
      isStale,
      isOnline,
      lastDisconnectReason,
      redeemCode,
      clearSeat,
      seatFetch,
    }),
    [
      token,
      seat,
      isAuthenticated,
      isAuthReady,
      isStale,
      isOnline,
      lastDisconnectReason,
      redeemCode,
      clearSeat,
      seatFetch,
    ]
  )

  return <SeatAuthContext.Provider value={value}>{children}</SeatAuthContext.Provider>
}

export function useSeatAuth() {
  const context = useContext(SeatAuthContext)
  if (!context) {
    throw new Error('useSeatAuth must be used within SeatAuthProvider')
  }
  return context
}
