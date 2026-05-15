import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { AppHeader } from '@/components/AppHeader'
import { Button, Card, TextField } from '@/components/system/primitives'
import { apiFetch } from '@/lib/api'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const redirectedFrom =
    typeof location.state === 'object' &&
    location.state &&
    'from' in location.state &&
    typeof location.state.from === 'string'
      ? location.state.from
      : null

  const subtitle =
    redirectedFrom === '/dashboard' || redirectedFrom?.startsWith('/admin')
      ? 'Sign in to view the dashboard.'
      : 'Access the analytics dashboard.'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || 'Login failed.')
      }
      login(data.token, data.user ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
      setIsSubmitting(false)
      return
    }

    const target =
      typeof location.state === 'object' &&
      location.state &&
      'from' in location.state &&
      typeof location.state.from === 'string'
        ? location.state.from
        : '/dashboard'

    navigate(target, { replace: true })
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-svh bg-[var(--color-bg-base)]">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-[1100px] items-start justify-center px-6 py-14">
        <Card raised className="w-full max-w-[400px] p-6 fade-in">
          <h1 className="text-xl-tight text-[var(--color-text-primary)]">Admin sign in</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[12px] font-medium text-[var(--color-text-secondary)]"
              >
                Email
              </label>
              <TextField
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[12px] font-medium text-[var(--color-text-secondary)]"
              >
                Password
              </label>
              <TextField
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <p className="text-[13px] font-medium text-[var(--color-danger)]">{error}</p>
            ) : null}

            <Button
              type="submit"
              variant="filled"
              size="md"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-5 text-center text-[13px] text-[var(--color-text-secondary)]">
            Need to log an event?{' '}
            <Link
              to="/capture"
              className="font-medium text-[var(--color-brand-purple)] hover:underline"
            >
              Open quick capture
            </Link>
          </p>
        </Card>
      </main>
    </div>
  )
}
