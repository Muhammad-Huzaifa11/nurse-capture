import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
import { authApiFetch } from '@/lib/api'
import {
  enqueueCapture,
  getOutboxCountForSeat,
  removeAllForSeat,
  runCaptureOutboxFlush,
} from '@/lib/captureEventOutbox'

type SignalType = 'interruption' | 'compensation'

type CardStatus = 'idle' | 'submitting' | 'success'

/** Matches server `SEAT_CAPTURE_COOLDOWN_MS` — shared cooldown after any capture. */
const CAPTURE_COOLDOWN_SEC = 8
const CAPTURE_COOLDOWN_MS = CAPTURE_COOLDOWN_SEC * 1000

/**
 * `fetch` rejected before an HTTP response (lie-fi, DNS, connection reset, etc.).
 * Not used for `throw new Error(...)` after a non-OK response — those stay on-screen errors.
 */
function isFetchNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof DOMException) {
    return error.name === 'NetworkError' || error.name === 'TimeoutError'
  }
  return false
}

function captureCooldownStorageKey(seatId: string) {
  return `nurse-capture-capture-cooldown-until-${seatId}`
}

function readCooldownUntil(seatId: string): number | null {
  try {
    const raw = window.localStorage.getItem(captureCooldownStorageKey(seatId))
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= Date.now()) {
      window.localStorage.removeItem(captureCooldownStorageKey(seatId))
      return null
    }
    /** Never keep a client-side wait longer than the current cooldown policy (e.g. after shortening 3m → 15s). */
    const cap = Date.now() + CAPTURE_COOLDOWN_MS
    const effective = Math.min(n, cap)
    if (effective <= Date.now()) {
      window.localStorage.removeItem(captureCooldownStorageKey(seatId))
      return null
    }
    if (effective < n) {
      window.localStorage.setItem(captureCooldownStorageKey(seatId), String(effective))
    }
    return effective
  } catch (_err) {
    return null
  }
}

function writeCooldownUntil(seatId: string, untilMs: number | null) {
  try {
    const key = captureCooldownStorageKey(seatId)
    if (untilMs == null || untilMs <= Date.now()) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, String(untilMs))
    }
  } catch (_err) {
    /* non-fatal */
  }
}

function formatCooldownRemaining(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function AppVersionFootnote() {
  const version = import.meta.env.VITE_APP_VERSION
  const rawCommit = import.meta.env.VITE_APP_COMMIT?.trim()
  const commit =
    rawCommit && rawCommit.length > 0 ? rawCommit.slice(0, 7) : null
  const vLabel =
    version && version.length > 0
      ? version.startsWith('v')
        ? version
        : `v${version}`
      : 'dev'
  const line = commit ? `${vLabel} · ${commit}` : vLabel
  return (
    <p
      className="mt-6 text-center text-[10px] leading-relaxed text-[var(--color-text-muted)] tabular-nums"
      aria-label={`App version ${vLabel}${commit ? `, build ${commit}` : ''}`}
    >
      {line}
    </p>
  )
}

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
      <main className="mx-auto w-full max-w-[520px] px-5 pt-10 pb-16">
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-raised)] p-3 shadow-[var(--shadow-token-sm)]">
          <div className="surface-card fade-in p-6">
          <span className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-purple-tint)] text-[var(--color-brand-purple)]">
            <KeyRound className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="mt-4 text-xl-tight font-semibold text-[var(--color-text-primary)]">
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
        </div>
        <AppVersionFootnote />
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

function CaptureScreen({ seat }: { seat: SeatLite }) {
  const { seatFetch, clearSeat, isOnline, isStale, token } = useSeatAuth()

  const [note, setNote] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [confirmChangeOpen, setConfirmChangeOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [interruptionStatus, setInterruptionStatus] = useState<CardStatus>('idle')
  const [compensationStatus, setCompensationStatus] = useState<CardStatus>('idle')
  const [outboxCount, setOutboxCount] = useState(0)
  const isFlushingRef = useRef(false)
  const mountedRef = useRef(true)
  const tokenRef = useRef(token)
  tokenRef.current = token

  const [cooldownUntil, setCooldownUntil] = useState<number | null>(() =>
    readCooldownUntil(seat.id)
  )
  /** Drives a re-render every second while a cooldown is active. */
  const [, setCooldownTick] = useState(0)

  const isAnySubmitting =
    interruptionStatus === 'submitting' || compensationStatus === 'submitting'

  const cooldownRemainingSec =
    cooldownUntil != null ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0
  const inCooldown = cooldownRemainingSec > 0

  useEffect(() => {
    setCooldownUntil(readCooldownUntil(seat.id))
  }, [seat.id])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const requestFlush = useCallback(() => {
    void runCaptureOutboxFlush(
      {
        seatId: seat.id,
        postEvent: (body) =>
          authApiFetch('/events', tokenRef.current, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          }),
        on401: () => clearSeat('Your session ended. Enter your code to continue.'),
        onQueueChange: (c) => {
          if (mountedRef.current) setOutboxCount(c)
        },
        shouldAbort: () => !mountedRef.current,
      },
      isFlushingRef
    )
  }, [seat.id, clearSeat])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const c = await getOutboxCountForSeat(seat.id)
      if (cancelled) return
      setOutboxCount(c)
      if (c > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
        requestFlush()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [seat.id, requestFlush])

  useEffect(() => {
    const onOnline = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) requestFlush()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [requestFlush])

  useEffect(() => {
    if (cooldownUntil == null || Date.now() >= cooldownUntil) return
    const id = window.setInterval(() => {
      setCooldownTick((x) => x + 1)
      if (Date.now() >= cooldownUntil) {
        setCooldownUntil(null)
        writeCooldownUntil(seat.id, null)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldownUntil, seat.id])

  function armCooldown(untilMs: number) {
    setCooldownUntil(untilMs)
    writeCooldownUntil(seat.id, untilMs)
  }

  async function submitSignal(signalType: SignalType) {
    if (isAnySubmitting) return
    if (inCooldown) return

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
        setStatus('idle')
        return
      }

      const data = await response.json().catch(() => null)

      if (response.status === 429) {
        const retrySec =
          typeof data?.retryAfterSeconds === 'number' && Number.isFinite(data.retryAfterSeconds)
            ? Math.max(1, Math.ceil(data.retryAfterSeconds))
            : CAPTURE_COOLDOWN_SEC
        armCooldown(Date.now() + retrySec * 1000)
        setStatus('idle')
        return
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Could not save event. Please try again.')
      }

      armCooldown(Date.now() + CAPTURE_COOLDOWN_MS)
      setStatus('success')
      setNote('')
      window.setTimeout(() => setStatus('idle'), 1800)
    } catch (error) {
      /**
       * Offline or lie-fi (`fetch` throws while `navigator.onLine` may still be true):
       * persist to IndexedDB; flush runs on `online`, mount, or immediately if online.
       */
      const useOutbox = !navigator.onLine || isFetchNetworkFailure(error)
      if (useOutbox) {
        try {
          await enqueueCapture(seat.id, payload)
          const c = await getOutboxCountForSeat(seat.id)
          setOutboxCount(c)
          requestFlush()
        } catch (_idbErr) {
          setSubmitError('Could not save capture offline. Please try again.')
          setStatus('idle')
          return
        }
        armCooldown(Date.now() + CAPTURE_COOLDOWN_MS)
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

      <main className="mx-auto w-full max-w-[560px] px-5 pt-8 pb-16">
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-raised)] p-3 shadow-[var(--shadow-token-sm)]">
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)] px-4 py-4 shadow-[var(--shadow-token-sm)]">
            {/* Seat context (its own card) */}
            <div className="rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-raised)] px-4 py-3 shadow-[var(--shadow-token-sm)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn(
                      'mt-1 size-2 shrink-0 rounded-full',
                      isOnline ? 'bg-[var(--color-brand-teal)]' : 'bg-[var(--color-warning)]'
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium leading-tight text-[var(--color-text-primary)]">
                      {seat.label}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                      <span className="rounded-full border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-2 py-0.5 font-medium">
                        {seat.unitKey.toUpperCase()}
                      </span>
                      <span className="rounded-full border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-2 py-0.5 font-medium">
                        {seat.shift.toUpperCase()}
                      </span>
                      <span className="ml-1 hidden sm:inline">· Captures tagged to this unit & shift</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmChangeOpen(true)}
                  className="shrink-0 rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-medium text-[var(--color-brand-purple)] outline-none transition-colors hover:bg-[var(--color-brand-purple-tint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-purple)] focus-visible:outline-offset-2"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Gap, then connectivity */}
            <div className="mt-4">
              <ConnectivityRow isOnline={isOnline} isStale={isStale} outboxCount={outboxCount} />
            </div>

            <div className="mb-6 mt-6 space-y-1.5">
              <h1 className="text-2xl-tight font-semibold text-[var(--color-text-primary)]">
                Quick capture
              </h1>
              <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                Tap one. Everything else is optional.
              </p>
            </div>

            {inCooldown ? (
              <div
                role="status"
                aria-live="polite"
                className="mb-3 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-warning)] bg-[var(--color-warning-tint)] px-3 py-2.5 text-center text-[12px] font-medium leading-snug text-[var(--color-warning)]"
              >
                Next capture in {formatCooldownRemaining(cooldownRemainingSec)}
              </div>
            ) : null}

            <div className="space-y-3">
              <CaptureCard
                tone="purple"
                title="Workflow interruption"
                subtitle="Something pulled you away from your intended task."
                icon={<Zap className="size-5" strokeWidth={2} aria-hidden />}
                status={interruptionStatus}
                disabled={
                  inCooldown || (isAnySubmitting && interruptionStatus !== 'submitting')
                }
                onClick={() => submitSignal('interruption')}
              />
              <CaptureCard
                tone="teal"
                title="Workflow compensation"
                subtitle="Something you did to work around a gap or problem."
                icon={<RefreshCw className="size-5" strokeWidth={2} aria-hidden />}
                status={compensationStatus}
                disabled={
                  inCooldown || (isAnySubmitting && compensationStatus !== 'submitting')
                }
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
                className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-left text-[13px] outline-none transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-purple)] focus-visible:outline-offset-2"
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
                  <ChevronUp
                    className="size-4 shrink-0 text-[var(--color-text-muted)]"
                    aria-hidden
                  />
                ) : (
                  <ChevronDown
                    className="size-4 shrink-0 text-[var(--color-text-muted)]"
                    aria-hidden
                  />
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
          </div>
        </div>
        <AppVersionFootnote />
      </main>

      <ConfirmChangeSeatModal
        open={confirmChangeOpen}
        outboxCount={outboxCount}
        onCancel={() => setConfirmChangeOpen(false)}
        onConfirm={async () => {
          setConfirmChangeOpen(false)
          try {
            await removeAllForSeat(seat.id)
          } catch (_err) {
            /* still leave seat */
          }
          clearSeat()
        }}
      />
    </div>
  )
}

function ConfirmChangeSeatModal({
  open,
  outboxCount,
  onCancel,
  onConfirm,
}: {
  open: boolean
  outboxCount: number
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  if (!open) return null

  const hasPending = outboxCount > 0
  const description = hasPending
    ? `You'll need to re-enter a code to keep capturing. You currently have ${outboxCount} pending ${outboxCount === 1 ? 'capture' : 'captures'} that will sync when you're back online.`
    : "You'll need to re-enter a code to keep capturing."

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4 fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-seat-title"
        className="w-full max-w-[420px] rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-token-lg)]"
      >
        <h2 id="change-seat-title" className="text-[16px] font-semibold text-[var(--color-text-primary)]">
          Change unit & shift?
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {description}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="filled" size="sm" onClick={onConfirm}>
            Change
          </Button>
        </div>
      </div>
    </div>
  )
}

/** ============================================================
 *  Connectivity row (offline / pending-sync indicator)
 *  ============================================================ */

function ConnectivityRow({
  isOnline,
  isStale,
  outboxCount,
}: {
  isOnline: boolean
  isStale: boolean
  outboxCount: number
}) {
  if (isOnline && outboxCount === 0 && !isStale) {
    return null
  }

  let tone: 'warning' | 'info' = 'info'
  let label = ''

  if (!isOnline) {
    tone = 'warning'
    label =
      outboxCount > 0
        ? `Offline — ${outboxCount} ${outboxCount === 1 ? 'event' : 'events'} pending sync`
        : 'Offline — captures will sync when you reconnect'
  } else if (outboxCount > 0) {
    tone = 'info'
    label = `${outboxCount} ${outboxCount === 1 ? 'event' : 'events'} pending sync`
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
        'flex items-start gap-2 rounded-[var(--radius-sm)] border-[0.5px] px-3 py-2 text-[12px] fade-in',
        isWarn
          ? 'border-[var(--color-warning)] bg-[var(--color-warning-tint)] text-[var(--color-warning)]'
          : 'border-[var(--color-border-soft)] bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)]'
      )}
    >
      <CloudOff
        className={cn('mt-0.5 size-3.5 shrink-0', !isWarn && 'opacity-70')}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
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
        'group relative w-full overflow-hidden rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] border-l-[3px] text-left transition-all duration-[120ms] ease-out outline-none',
        'shadow-[var(--shadow-token-sm)]',
        'hover:shadow-[var(--shadow-token-md)] hover:scale-[1.01] hover:border-[var(--color-border-strong)]',
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
              'flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-black/5',
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
