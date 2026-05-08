import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CloudOff,
  KeyRound,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button, TextArea, TextField } from '@/components/system/primitives'
import { cn } from '@/lib/utils'
import { useSeatAuth } from '@/auth/SeatAuthContext'

type SignalType = 'interruption' | 'compensation'

type CardStatus = 'idle' | 'submitting' | 'success'

const PENDING_COUNT_KEY = 'nurse-capture-pending-count'

export function QuickCapture() {
  const { isAuthenticated, isAuthReady, seat } = useSeatAuth()

  if (!isAuthReady) {
    return (
      <div className="min-h-svh bg-[var(--color-bg-base)]">
        <AppHeader />
        <main className="mx-auto w-full max-w-[480px] px-5 pt-20 text-center text-[13px] text-[var(--color-text-muted)]">
          Loading…
        </main>
      </div>
    )
  }

  if (!isAuthenticated || !seat) {
    return <SeatGate />
  }

  return <CaptureScreen seat={seat} />
}

/** ============================================================
 *  Seat gate — code entry screen
 *  ============================================================ */

function SeatGate() {
  const { redeemCode, lastDisconnectReason, isOnline } = useSeatAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    try {
      await redeemCode(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code not recognized.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-svh bg-[var(--color-bg-base)]">
      <AppHeader />
      <main className="mx-auto w-full max-w-[420px] px-5 pt-12 pb-16">
        <div className="surface-card fade-in p-6">
          <span className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-purple-tint)] text-[var(--color-brand-purple)]">
            <KeyRound className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="mt-4 text-xl-tight text-[var(--color-text-primary)]">
            Enter your unit code
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            One-time per device. Once entered, capture stays one-tap. Codes are tied to a
            unit and shift — never to a person.
          </p>

          {!isOnline ? (
            <p className="mt-4 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-warning)] bg-[var(--color-warning-tint)] px-3 py-2 text-[12px] text-[var(--color-warning)]">
              You're offline. Connect to a network to redeem your code.
            </p>
          ) : lastDisconnectReason ? (
            <p className="mt-4 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-warning)] bg-[var(--color-warning-tint)] px-3 py-2 text-[12px] text-[var(--color-warning)]">
              {lastDisconnectReason}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="seat-code"
                className="block text-[12px] font-medium text-[var(--color-text-secondary)]"
              >
                Unit code
              </label>
              <TextField
                id="seat-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. NICU-A-DAY-7K3F"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="h-10 tracking-[0.04em] uppercase"
              />
            </div>

            {error ? (
              <p className="text-[13px] font-medium text-[var(--color-danger)]" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="filled"
              size="md"
              className="w-full"
              disabled={isSubmitting || !code.trim() || !isOnline}
            >
              {isSubmitting ? 'Checking…' : 'Continue'}
            </Button>
          </form>

          <p className="mt-5 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            We don't track who tapped — only which unit and shift the tap came from.
          </p>
        </div>
      </main>
    </div>
  )
}

/** ============================================================
 *  Capture screen (post-redemption)
 *  ============================================================ */

type SeatLite = {
  id: string
  label: string
  unitKey: string
  shift: string
}

function readPendingCount(): number {
  try {
    const raw = window.localStorage.getItem(PENDING_COUNT_KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch (_err) {
    return 0
  }
}

function writePendingCount(n: number) {
  try {
    if (n <= 0) {
      window.localStorage.removeItem(PENDING_COUNT_KEY)
    } else {
      window.localStorage.setItem(PENDING_COUNT_KEY, String(n))
    }
  } catch (_err) {
    /* non-fatal */
  }
}

function CaptureScreen({ seat }: { seat: SeatLite }) {
  const { seatFetch, clearSeat, isOnline, isStale } = useSeatAuth()

  const [note, setNote] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [interruptionStatus, setInterruptionStatus] = useState<CardStatus>('idle')
  const [compensationStatus, setCompensationStatus] = useState<CardStatus>('idle')
  const [pendingCount, setPendingCount] = useState<number>(() => readPendingCount())

  const isAnySubmitting =
    interruptionStatus === 'submitting' || compensationStatus === 'submitting'

  /**
   * When the device comes back online and we have queued events, give the
   * service worker a few seconds to flush its background sync queue, then
   * clear the local indicator. The actual retry is the SW's job; this is
   * just the UX telling the nurse "we're caught up."
   */
  useEffect(() => {
    if (!isOnline || pendingCount === 0) return
    const t = window.setTimeout(() => {
      setPendingCount(0)
      writePendingCount(0)
    }, 5000)
    return () => window.clearTimeout(t)
  }, [isOnline, pendingCount])

  function bumpPending() {
    setPendingCount((prev) => {
      const next = prev + 1
      writePendingCount(next)
      return next
    })
  }

  async function submitSignal(signalType: SignalType) {
    if (isAnySubmitting) return

    const setStatus =
      signalType === 'interruption' ? setInterruptionStatus : setCompensationStatus

    setSubmitError(null)
    setStatus('submitting')

    const payload: { signalType: SignalType; note?: string; occurredAt: string } = {
      signalType,
      occurredAt: new Date().toISOString(),
    }
    if (note.trim()) payload.note = note.trim()

    try {
      const response = await seatFetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.status === 401) {
        /** seatFetch already cleared the token; the gate will render itself. */
        return
      }

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || 'Could not save event. Please try again.')
      }

      setStatus('success')
      setNote('')
      window.setTimeout(() => setStatus('idle'), 1800)
    } catch (error) {
      /**
       * If the device is offline, the Workbox service worker has already
       * queued the POST in IndexedDB and will retry on reconnect. We treat
       * this as an optimistic success so the nurse never feels the network.
       * Real errors (online but rejected) fall through to the error path.
       */
      if (!navigator.onLine) {
        bumpPending()
        setStatus('success')
        setNote('')
        window.setTimeout(() => setStatus('idle'), 1800)
        return
      }
      setSubmitError(
        error instanceof Error ? error.message : 'Could not save event. Please try again.'
      )
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-svh bg-[var(--color-bg-base)]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[480px] px-5 pt-8 pb-16">
        {/* Context chip */}
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-4 py-2.5 shadow-[var(--shadow-token-sm)]">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                isOnline
                  ? 'bg-[var(--color-brand-teal)]'
                  : 'bg-[var(--color-warning)]'
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight text-[var(--color-text-primary)]">
                {seat.label}
              </p>
              <p className="text-[11px] leading-tight text-[var(--color-text-muted)]">
                Captures will be tagged to this unit & shift
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => clearSeat()}
            className="shrink-0 rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-medium text-[var(--color-brand-purple)] outline-none transition-colors hover:bg-[var(--color-brand-purple-tint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-purple)] focus-visible:outline-offset-2"
          >
            Change
          </button>
        </div>

        {/* Connectivity / pending-sync indicator */}
        <ConnectivityRow
          isOnline={isOnline}
          isStale={isStale}
          pendingCount={pendingCount}
        />

        <div className="mb-6 mt-6 space-y-1.5">
          <h1 className="text-2xl-tight text-[var(--color-text-primary)]">Quick capture</h1>
          <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            Tap one. Everything else is optional.
          </p>
        </div>

        <div className="space-y-3">
          <CaptureCard
            tone="purple"
            title="Workflow interruption"
            subtitle="Something pulled you away from your intended task."
            icon={<Zap className="size-5" strokeWidth={2} aria-hidden />}
            status={interruptionStatus}
            disabled={isAnySubmitting && interruptionStatus !== 'submitting'}
            onClick={() => submitSignal('interruption')}
          />
          <CaptureCard
            tone="teal"
            title="Workflow compensation"
            subtitle="Something you did to work around a gap or problem."
            icon={<RefreshCw className="size-5" strokeWidth={2} aria-hidden />}
            status={compensationStatus}
            disabled={isAnySubmitting && compensationStatus !== 'submitting'}
            onClick={() => submitSignal('compensation')}
          />
        </div>

        <div className="mt-3 min-h-5">
          {submitError ? (
            <p
              role="alert"
              className="text-center text-[12px] font-medium text-[var(--color-danger)]"
            >
              {submitError}
            </p>
          ) : null}
        </div>

        <div className="mt-5 rounded-[var(--radius-lg)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-raised)]">
          <button
            type="button"
            onClick={() => setShowContext((v) => !v)}
            aria-expanded={showContext}
            aria-controls="optional-note-panel"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13px] outline-none transition-colors rounded-[var(--radius-lg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-purple)] focus-visible:outline-offset-2"
          >
            <span className="flex flex-col">
              <span className="font-medium text-[var(--color-text-primary)]">Add a note</span>
              <span className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                {note.trim()
                  ? 'Note will be attached to your next tap.'
                  : 'Optional — short context, no patient details.'}
              </span>
            </span>
            {showContext ? (
              <ChevronUp className="size-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
            )}
          </button>

          {showContext && (
            <div
              id="optional-note-panel"
              className="panel-expand space-y-2 border-t-[0.5px] border-[var(--color-border-soft)] px-4 py-4"
            >
              <label
                htmlFor="note"
                className="block text-[12px] font-medium text-[var(--color-text-secondary)]"
              >
                Quick note
              </label>
              <TextArea
                id="note"
                rows={3}
                maxLength={500}
                placeholder="What happened? No patient details."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--color-text-muted)]">
          Under 10 seconds. Anonymous.
        </p>

        <div className="mt-10 flex items-center justify-center gap-2 text-[11px] text-[var(--color-text-muted)]">
          <span>Works on any device</span>
          <span aria-hidden>·</span>
          <span>Anonymous</span>
          <span aria-hidden>·</span>
          <span>Clinical-grade</span>
        </div>
      </main>
    </div>
  )
}

/** ============================================================
 *  Connectivity row (offline / pending-sync indicator)
 *  ============================================================ */

function ConnectivityRow({
  isOnline,
  isStale,
  pendingCount,
}: {
  isOnline: boolean
  isStale: boolean
  pendingCount: number
}) {
  if (isOnline && pendingCount === 0 && !isStale) {
    return null
  }

  let tone: 'warning' | 'info' = 'info'
  let label = ''

  if (!isOnline) {
    tone = 'warning'
    label =
      pendingCount > 0
        ? `Offline — ${pendingCount} ${pendingCount === 1 ? 'capture' : 'captures'} will sync when you reconnect`
        : 'Offline — captures will sync when you reconnect'
  } else if (pendingCount > 0) {
    tone = 'info'
    label = `Syncing ${pendingCount} ${pendingCount === 1 ? 'capture' : 'captures'}…`
  } else if (isStale) {
    tone = 'info'
    label = 'Reconnecting…'
  }

  if (!label) return null

  const isWarn = tone === 'warning'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-sm)] border-[0.5px] px-3 py-2 text-[12px] fade-in',
        isWarn
          ? 'border-[var(--color-warning)] bg-[var(--color-warning-tint)] text-[var(--color-warning)]'
          : 'border-[var(--color-border-soft)] bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)]'
      )}
    >
      <CloudOff
        className={cn('size-3.5 shrink-0', !isWarn && 'opacity-70')}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </div>
  )
}

type CaptureCardProps = {
  tone: 'purple' | 'teal'
  title: string
  subtitle: string
  icon: React.ReactNode
  status: CardStatus
  disabled?: boolean
  onClick: () => void
}

function CaptureCard({ tone, title, subtitle, icon, status, disabled, onClick }: CaptureCardProps) {
  const isPurple = tone === 'purple'

  const baseBg = isPurple
    ? 'bg-[var(--color-brand-purple-tint)]'
    : 'bg-[var(--color-brand-teal-tint)]'
  const successBg = isPurple ? 'bg-[#DEE2FB]' : 'bg-[#D6F2E5]'
  const borderColor = isPurple
    ? 'border-l-[var(--color-brand-purple)]'
    : 'border-l-[var(--color-brand-teal)]'
  const iconBg = isPurple ? 'bg-[var(--color-brand-purple)]' : 'bg-[var(--color-brand-teal)]'
  const successText = isPurple
    ? 'text-[var(--color-brand-purple-strong)]'
    : 'text-[var(--color-brand-teal-strong)]'

  const isSuccess = status === 'success'
  const isSubmitting = status === 'submitting'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSubmitting || isSuccess}
      aria-label={`Log ${title.toLowerCase()}`}
      aria-live={isSuccess ? 'polite' : undefined}
      className={cn(
        'relative w-full overflow-hidden rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] border-l-[3px] text-left transition-all duration-[120ms] ease-out outline-none',
        'shadow-[var(--shadow-token-sm)]',
        'hover:shadow-[var(--shadow-token-md)] hover:scale-[1.005]',
        'active:scale-[0.997] active:shadow-[var(--shadow-token-sm)] active:duration-[80ms]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-purple)] focus-visible:outline-offset-2',
        borderColor,
        isSuccess ? successBg : baseBg,
        (disabled || isSubmitting) && !isSuccess && 'opacity-70',
        'min-h-[88px] sm:min-h-[96px]'
      )}
    >
      {!isSuccess ? (
        <div className="flex items-center gap-4 px-6 py-5">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]',
              iconBg
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-tight text-[var(--color-text-primary)]">
              {title}
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-[var(--color-text-secondary)]">
              {isSubmitting ? 'Saving…' : subtitle}
            </span>
          </span>
          <ArrowRight
            className="size-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 px-6 py-5 fade-in">
          <span className={cn('flex size-10 items-center justify-center rounded-full text-white', iconBg)}>
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline className="draw-check" points="5 12 10 17 19 8" />
            </svg>
          </span>
          <span className={cn('text-[15px] font-medium', successText)}>
            Logged — {title.replace('Workflow ', '')}
          </span>
        </div>
      )}
    </button>
  )
}
