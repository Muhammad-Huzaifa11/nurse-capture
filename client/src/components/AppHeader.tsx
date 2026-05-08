import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Download, Share } from 'lucide-react'
import { Button } from '@/components/system/primitives'
import { useAuth } from '@/auth/AuthContext'
import { usePwaInstall } from '@/lib/usePwaInstall'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { canInstall, isInstalled, isIosSafari, promptInstall } = usePwaInstall()
  const [showIosHint, setShowIosHint] = useState(false)
  const isAdminArea =
    location.pathname === '/dashboard' || location.pathname.startsWith('/admin/')

  function handleLogout() {
    logout()
    navigate('/')
  }

  async function handleInstall() {
    if (canInstall) {
      await promptInstall()
      return
    }
    if (isIosSafari) {
      setShowIosHint((v) => !v)
    }
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

  /** Hide install button when already installed or on platforms where we
   * have no install path at all. Show on Chromium when prompt is available;
   * show a tappable "Add to home" hint on iOS Safari. */
  const showInstallButton = !isInstalled && (canInstall || isIosSafari)

  return (
    <header className="sticky top-0 z-20 border-b-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)]">
      <div className="mx-auto flex h-[52px] w-full max-w-[1100px] items-center justify-between gap-4 px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-brand-purple)]"
        >
          <span className="inline-flex size-5 items-center justify-center rounded-[5px] bg-[var(--color-brand-purple)] text-white">
            <span className="block size-1.5 rounded-full bg-white" aria-hidden />
          </span>
          Invisible workload
        </Link>

        <div className="flex items-center gap-4">
          <nav className="flex h-full items-center gap-6">
            <NavLink to="/capture" className={navLinkClass}>
              Capture
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
            {isAuthenticated && isAdminArea && (
              <NavLink to="/admin/seats" className={navLinkClass}>
                Seats
              </NavLink>
            )}
          </nav>

          {showInstallButton ? (
            <Button
              variant="outlined"
              size="sm"
              onClick={handleInstall}
              aria-label={canInstall ? 'Install app' : 'How to install on iOS'}
            >
              <Download className="mr-1.5 size-3.5" strokeWidth={1.75} aria-hidden />
              Install
            </Button>
          ) : null}

          {isAuthenticated && isAdminArea ? (
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          ) : !isAuthenticated ? (
            <Button
              variant="filled"
              size="sm"
              onClick={() => navigate('/login')}
            >
              Login
            </Button>
          ) : null}
        </div>
      </div>

      {showIosHint && isIosSafari ? (
        <div
          role="status"
          className="border-t-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-brand-purple-tint)] px-6 py-2.5 text-[12px] leading-relaxed text-[var(--color-text-primary)] fade-in"
        >
          <span className="inline-flex items-center gap-1.5">
            <Share className="size-3.5 text-[var(--color-brand-purple)]" strokeWidth={1.75} aria-hidden />
            Tap the Share icon in Safari, then choose <strong>Add to Home Screen</strong>.
          </span>
        </div>
      ) : null}
    </header>
  )
}
