import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Button } from '@/components/system/primitives'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative inline-flex h-[52px] items-center text-[13px] font-medium transition-colors',
      isActive
        ? 'text-[var(--color-brand-purple)]'
        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
      isActive &&
        'after:absolute after:left-0 after:right-0 after:bottom-2 after:h-[2px] after:bg-[var(--color-brand-purple)] after:content-[""]'
    )

  return (
    <header className="sticky top-0 z-20 h-[52px] border-b-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)]">
      <div className="mx-auto flex h-full w-full max-w-[1100px] items-center justify-between gap-4 px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-brand-purple)]"
        >
          <span className="inline-flex size-5 items-center justify-center rounded-[5px] bg-[var(--color-brand-purple)] text-white">
            <span className="block size-1.5 rounded-full bg-white" aria-hidden />
          </span>
          Invisible workload
        </Link>

        <nav className="flex h-full items-center gap-6">
          <NavLink to="/capture" className={navLinkClass}>
            Capture
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="outlined"
            size="sm"
            disabled
            title="Coming soon"
            aria-label="Install app (coming soon)"
          >
            Install
          </Button>

          {isAuthenticated ? (
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <Button
              variant="filled"
              size="sm"
              onClick={() => navigate('/login')}
            >
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
