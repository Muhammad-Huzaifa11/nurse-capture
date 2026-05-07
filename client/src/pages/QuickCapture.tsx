import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, RefreshCw, Zap } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Select, TextArea } from '@/components/system/primitives'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

type SignalType = 'interruption' | 'compensation'

type CardStatus = 'idle' | 'submitting' | 'success'

const SHIFT_OPTIONS = [
  { value: 'night', label: 'Night' },
  { value: 'day', label: 'Day' },
  { value: 'evening', label: 'Evening' },
]

const UNIT_OPTIONS = [
  { value: 'nicu-a', label: 'NICU A' },
  { value: 'nicu-b', label: 'NICU B' },
  { value: 'stepdown', label: 'Stepdown' },
  { value: 'other', label: 'Other' },
]

export function QuickCapture() {
  const [note, setNote] = useState('')
  const [shift, setShift] = useState('')
  const [unitKey, setUnitKey] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [interruptionStatus, setInterruptionStatus] = useState<CardStatus>('idle')
  const [compensationStatus, setCompensationStatus] = useState<CardStatus>('idle')

  const isAnySubmitting =
    interruptionStatus === 'submitting' || compensationStatus === 'submitting'

  const hasContext = Boolean(shift || unitKey || note.trim())

  async function submitSignal(signalType: SignalType) {
    if (isAnySubmitting) return

    const setStatus =
      signalType === 'interruption' ? setInterruptionStatus : setCompensationStatus

    setSubmitError(null)
    setStatus('submitting')

    try {
      const payload: {
        signalType: SignalType
        shift?: string
        unitKey?: string
        note?: string
        occurredAt: string
      } = {
        signalType,
        occurredAt: new Date().toISOString(),
      }

      if (shift) payload.shift = shift
      if (unitKey) payload.unitKey = unitKey
      if (note.trim()) payload.note = note.trim()

      const response = await apiFetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || 'Could not save event. Please try again.')
      }

      setStatus('success')
      setNote('')
      window.setTimeout(() => setStatus('idle'), 1800)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Could not save event. Please try again.'
      )
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-svh bg-[var(--color-bg-base)]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[480px] px-5 pt-10 pb-16">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-2xl-tight text-[var(--color-text-primary)]">
            Quick capture
          </h1>
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
            aria-controls="optional-context-panel"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13px] outline-none transition-colors rounded-[var(--radius-lg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-purple)] focus-visible:outline-offset-2"
          >
            <span className="flex flex-col">
              <span className="font-medium text-[var(--color-text-primary)]">
                Add context
              </span>
              <span className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                {hasContext
                  ? 'Context will be included with your next tap.'
                  : 'Optional — skip freely mid-shift.'}
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
              id="optional-context-panel"
              className="panel-expand space-y-4 border-t-[0.5px] border-[var(--color-border-soft)] px-4 py-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
                    Shift
                  </label>
                  <Select
                    value={shift}
                    onChange={setShift}
                    options={SHIFT_OPTIONS}
                    placeholder="Select shift"
                    ariaLabel="Shift"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
                    Unit
                  </label>
                  <Select
                    value={unitKey}
                    onChange={setUnitKey}
                    options={UNIT_OPTIONS}
                    placeholder="Select unit"
                    ariaLabel="Unit"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
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
