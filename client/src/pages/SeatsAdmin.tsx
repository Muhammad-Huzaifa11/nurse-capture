import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button, Card, Eyebrow, Pill, Select, TextArea } from '@/components/system/primitives'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/utils'

const UNIT_OPTIONS = [
  { value: 'icu', label: 'ICU' },
  { value: 'med-surg', label: 'Med surg' },
  { value: 'ed', label: 'ED' },
  { value: 'stepdown', label: 'Stepdown' },
  { value: 'other', label: 'Other' },
]

const SHIFT_OPTIONS = [
  { value: 'night', label: 'Night' },
  { value: 'day', label: 'Day' },
  { value: 'evening', label: 'Evening' },
]

type SeatRow = {
  id: string
  code: string
  label: string
  unitKey: string
  shift: string
  isActive: boolean
  notes: string | null
  lastUsedAt: string | null
  createdAt: string | null
}

type ConfirmAction = 'rotate' | 'toggle' | 'delete'

type ConfirmState = {
  action: ConfirmAction
  seat: SeatRow
}

export function SeatsAdmin() {
  const { authFetch } = useAuth()
  const [seats, setSeats] = useState<SeatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  /** Create form state */
  const [formUnit, setFormUnit] = useState('icu')
  const [formShift, setFormShift] = useState('day')
  const [formNotes, setFormNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const loadSeats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/admin/seats')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Could not load seats.')
      }
      setSeats(data.seats || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load seats.')
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    loadSeats()
  }, [loadSeats])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    setFormError(null)
    try {
      const res = await authFetch('/admin/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitKey: formUnit,
          shift: formShift,
          notes: formNotes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Could not create seat.')
      }
      setSeats((prev) => [data.seat, ...prev])
      setHighlightId(data.seat.id)
      setFormNotes('')
      window.setTimeout(() => setHighlightId(null), 2400)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create seat.')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleActive(seat: SeatRow) {
    try {
      const res = await authFetch(`/admin/seats/${seat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !seat.isActive }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Could not update seat.')
      }
      setSeats((prev) => prev.map((s) => (s.id === seat.id ? data.seat : s)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update seat.')
    }
  }

  async function handleRotate(seat: SeatRow) {
    try {
      const res = await authFetch(`/admin/seats/${seat.id}/rotate-code`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Could not rotate code.')
      }
      setSeats((prev) => prev.map((s) => (s.id === seat.id ? data.seat : s)))
      setHighlightId(seat.id)
      window.setTimeout(() => setHighlightId(null), 2400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rotate code.')
    }
  }

  async function handleDelete(seat: SeatRow) {
    try {
      const res = await authFetch(`/admin/seats/${seat.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Could not delete seat.')
      }
      setSeats((prev) => prev.filter((s) => s.id !== seat.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete seat.')
    }
  }

  async function handleCopy(seat: SeatRow) {
    try {
      await navigator.clipboard.writeText(seat.code)
      setCopiedId(seat.id)
      window.setTimeout(() => setCopiedId(null), 1400)
    } catch (_err) {
      /** Clipboard API can fail on some browsers — silently ignore. */
    }
  }

  const sortedSeats = useMemo(() => {
    return [...seats].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      return (b.createdAt || '').localeCompare(a.createdAt || '')
    })
  }, [seats])

  async function handleConfirmAction() {
    if (!confirmState || confirmBusy) return
    setConfirmBusy(true)
    try {
      if (confirmState.action === 'rotate') {
        await handleRotate(confirmState.seat)
      } else if (confirmState.action === 'toggle') {
        await handleToggleActive(confirmState.seat)
      } else {
        await handleDelete(confirmState.seat)
      }
      setConfirmState(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="min-h-svh bg-[var(--color-bg-base)]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1100px] space-y-8 px-6 py-10 fade-in">
        <section>
          <h1 className="text-2xl-tight text-[var(--color-text-primary)]">Seats</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            Anonymous workflow credentials. Each seat represents a unit + shift, not a person.
            Multiple nurses on the same unit/shift share the same code.
          </p>
        </section>

        {/* Create form */}
        <Card raised className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-purple-tint)] text-[var(--color-brand-purple)]">
              <Plus className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              Create a seat
            </p>
          </div>

          <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Eyebrow>Unit</Eyebrow>
              <Select
                value={formUnit}
                onChange={setFormUnit}
                options={UNIT_OPTIONS}
                ariaLabel="Unit"
              />
            </div>
            <div className="space-y-1.5">
              <Eyebrow>Shift</Eyebrow>
              <Select
                value={formShift}
                onChange={setFormShift}
                options={SHIFT_OPTIONS}
                ariaLabel="Shift"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                variant="filled"
                size="md"
                disabled={creating}
                className="w-full sm:w-auto"
              >
                {creating ? 'Creating…' : 'Create seat'}
              </Button>
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Eyebrow>Notes (optional)</Eyebrow>
              <TextArea
                rows={2}
                maxLength={200}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Internal note for this seat (e.g. break-room tablet)"
              />
            </div>
          </form>

          {formError ? (
            <p className="mt-3 text-[13px] font-medium text-[var(--color-danger)]" role="alert">
              {formError}
            </p>
          ) : null}
        </Card>

        {/* Seats list */}
        <Card raised>
          <div className="flex items-center justify-between border-b-[0.5px] border-[var(--color-border-soft)] px-5 py-3">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              All seats {seats.length > 0 && (
                <span className="text-[var(--color-text-muted)] font-normal">· {seats.length}</span>
              )}
            </p>
          </div>

          {loading ? (
            <p className="px-5 py-8 text-center text-[13px] text-[var(--color-text-muted)]">
              Loading seats…
            </p>
          ) : error ? (
            <p
              className="m-5 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-danger)] bg-[var(--color-danger-tint)] px-3 py-2 text-[13px] text-[var(--color-danger)]"
              role="alert"
            >
              {error}
            </p>
          ) : sortedSeats.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-bg-raised)] text-[var(--color-text-muted)]">
                <KeyRound className="size-4" strokeWidth={1.5} aria-hidden />
              </span>
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                No seats yet
              </p>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                Create one for each unit + shift combination you want to capture.
              </p>
            </div>
          ) : (
            <div className="divide-y-[0.5px] divide-[var(--color-border-soft)]">
              {sortedSeats.map((seat) => (
                <SeatRowItem
                  key={seat.id}
                  seat={seat}
                  copied={copiedId === seat.id}
                  highlight={highlightId === seat.id}
                  onCopy={() => handleCopy(seat)}
                  onRotate={() => setConfirmState({ action: 'rotate', seat })}
                  onToggleActive={() => setConfirmState({ action: 'toggle', seat })}
                  onDelete={() => setConfirmState({ action: 'delete', seat })}
                />
              ))}
            </div>
          )}
        </Card>

        <p className="text-center text-[12px] text-[var(--color-text-muted)]">
          Seats are anonymous. The dashboard shows unit + shift only, never who tapped.
        </p>
      </main>

      <ConfirmActionModal
        state={confirmState}
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setConfirmState(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  )
}

function SeatRowItem({
  seat,
  copied,
  highlight,
  onCopy,
  onRotate,
  onToggleActive,
  onDelete,
}: {
  seat: SeatRow
  copied: boolean
  highlight: boolean
  onCopy: () => void
  onRotate: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 px-5 py-4 transition-colors',
        highlight && 'bg-[var(--color-brand-teal-tint)]'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{seat.label}</p>
          {seat.isActive ? (
            <Pill tone="success">Active</Pill>
          ) : (
            <Pill tone="neutral">Inactive</Pill>
          )}
        </div>
        {seat.notes ? (
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{seat.notes}</p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
          {seat.lastUsedAt
            ? `Last used ${formatRelative(seat.lastUsedAt)}`
            : 'Never used'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <code
          className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-raised)] px-2.5 py-1.5 text-[12px] font-medium tracking-[0.04em] text-[var(--color-text-primary)]"
        >
          {seat.code}
        </code>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy code for ${seat.label}`}
          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-purple)] focus-visible:outline-offset-2"
          title={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? (
            <Check className="size-4 text-[var(--color-success)]" strokeWidth={2} aria-hidden />
          ) : (
            <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onRotate}>
          <RefreshCw className="mr-1.5 size-3.5" strokeWidth={1.75} aria-hidden />
          Rotate code
        </Button>
        {seat.isActive ? (
          <Button variant="ghost" size="sm" onClick={onToggleActive}>
            <ShieldOff className="mr-1.5 size-3.5" strokeWidth={1.75} aria-hidden />
            Deactivate
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onToggleActive}>
            <ShieldCheck className="mr-1.5 size-3.5" strokeWidth={1.75} aria-hidden />
            Activate
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="mr-1.5 size-3.5" strokeWidth={1.75} aria-hidden />
          Delete
        </Button>
      </div>
    </div>
  )
}

function ConfirmActionModal({
  state,
  busy,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!state) return null

  const { seat, action } = state
  const isRotate = action === 'rotate'
  const isDelete = action === 'delete'
  const isToggle = action === 'toggle'
  const willDeactivate = isToggle && seat.isActive

  const title = isRotate
    ? 'Rotate seat code?'
    : isDelete
      ? 'Delete this seat?'
      : willDeactivate
        ? 'Deactivate this seat?'
        : 'Activate this seat?'

  const description = isRotate
    ? `Rotate the code for "${seat.label}"? Existing devices stay signed in, but new devices must use the new code.`
    : isDelete
      ? `Delete "${seat.label}" permanently? Any active sessions for this seat will be ended immediately.`
      : willDeactivate
        ? `Deactivate "${seat.label}"? Active sessions will be ended immediately.`
        : `Activate "${seat.label}" so nurses can redeem this code again.`

  const confirmLabel = isRotate
    ? 'Rotate code'
    : isDelete
      ? 'Delete seat'
      : willDeactivate
        ? 'Deactivate seat'
        : 'Activate seat'

  const confirmVariant = isDelete || willDeactivate ? 'danger' : 'filled'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4 fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seat-confirm-title"
        className="w-full max-w-[420px] rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-token-lg)]"
      >
        <h2 id="seat-confirm-title" className="text-[16px] font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {description}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}
