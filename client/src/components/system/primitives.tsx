import * as React from 'react'
import { Calendar, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Design-system primitives matching the "Measuring the Invisible Workload" spec.
 * Built without a UI library so visual rules stay strict.
 */

/** Pill / Badge ------------------------------------------------------------ */

type PillTone = 'success' | 'danger' | 'neutral' | 'brand'

type PillProps = {
  tone?: PillTone
  className?: string
  children: React.ReactNode
}

const pillToneClass: Record<PillTone, string> = {
  success: 'bg-[var(--color-success-tint)] text-[var(--color-success)]',
  danger: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  neutral:
    'bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] border border-[var(--color-border-soft)]',
  brand: 'bg-[var(--color-brand-purple-tint)] text-[var(--color-brand-purple)]',
}

export function Pill({ tone = 'neutral', className, children }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
        pillToneClass[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/** Intensity dot (green / amber / red) ------------------------------------- */

type IntensityLevel = 'low' | 'medium' | 'high'

const intensityColor: Record<IntensityLevel, string> = {
  low: 'bg-[var(--color-success)]',
  medium: 'bg-[var(--color-warning)]',
  high: 'bg-[var(--color-danger)]',
}

export function IntensityDot({
  level,
  className,
  ariaLabel,
}: {
  level: IntensityLevel
  className?: string
  ariaLabel?: string
}) {
  return (
    <span
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      className={cn('inline-block size-2 shrink-0 rounded-full', intensityColor[level], className)}
    />
  )
}

/** Card --------------------------------------------------------------------- */

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  raised?: boolean
}

export function Card({ raised, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-token-sm)] transition-shadow duration-150',
        raised && 'hover:shadow-[var(--shadow-token-md)]',
        className
      )}
      {...rest}
    />
  )
}

export function CardBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...rest} />
}

/** SectionHeader ----------------------------------------------------------- */

export function SectionHeader({
  title,
  subtitle,
  trailing,
  className,
}: {
  title: string
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b-[0.5px] border-[var(--color-border-soft)] px-5 py-4',
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-tight text-[var(--color-text-primary)]">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  )
}

/** Eyebrow ----------------------------------------------------------------- */

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-[11px] font-medium uppercase leading-none tracking-[0.06em] text-[var(--color-text-muted)]',
        className
      )}
    >
      {children}
    </span>
  )
}

/** Button ------------------------------------------------------------------ */

type ButtonVariant = 'filled' | 'outlined' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const buttonSize: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-4 text-[13px]',
}

const buttonVariant: Record<ButtonVariant, string> = {
  filled:
    'bg-[var(--color-brand-purple)] text-white hover:bg-[var(--color-brand-purple-strong)] active:scale-[0.98]',
  outlined:
    'border-[0.5px] border-[var(--color-brand-purple)] text-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)] hover:text-white',
  ghost:
    'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:opacity-90 active:scale-[0.98]',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'filled', size = 'sm', className, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium transition-all duration-150 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-purple)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
          buttonSize[size],
          buttonVariant[variant],
          className
        )}
        {...rest}
      />
    )
  }
)
Button.displayName = 'Button'

/** Custom Select ----------------------------------------------------------- */

export type SelectOption = {
  value: string
  label: string
}

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  triggerClassName?: string
  ariaLabel?: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  triggerClassName,
  ariaLabel,
  disabled,
  size = 'md',
}: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const [activeIdx, setActiveIdx] = React.useState<number>(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value)
    )
  )

  React.useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)
  const label = selected?.label ?? placeholder ?? 'Select'

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((idx) => (idx + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((idx) => (idx - 1 + options.length) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const next = options[activeIdx]
      if (next) {
        onChange(next.value)
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
  }

  const triggerSizing =
    size === 'sm' ? 'min-h-8 py-1.5' : 'min-h-9 py-2'

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-3 text-[13px] leading-snug text-[var(--color-text-primary)] transition-colors outline-none',
          'hover:border-[var(--color-border-strong)]',
          'focus-visible:border-[var(--color-brand-purple)] focus-visible:shadow-[0_0_0_3px_rgba(91,82,214,0.10)]',
          triggerSizing,
          disabled && 'cursor-not-allowed opacity-60',
          triggerClassName
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 overflow-x-hidden text-ellipsis whitespace-nowrap text-left',
            !selected && 'text-[var(--color-text-muted)]'
          )}
        >
          {label}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="fade-in absolute left-0 right-0 z-30 mt-1.5 max-h-60 overflow-auto rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] py-1 shadow-[var(--shadow-token-md)]"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value
            const isActive = idx === activeIdx
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                  buttonRef.current?.focus()
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[13px] leading-snug text-[var(--color-text-primary)]',
                  isActive && 'bg-[var(--color-bg-raised)]',
                  isSelected && 'font-medium'
                )}
              >
                <span className="min-w-0 flex-1 overflow-x-hidden text-ellipsis whitespace-nowrap text-left">
                  {opt.label}
                </span>
                {isSelected ? (
                  <Check
                    className="size-3.5 text-[var(--color-brand-purple)]"
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** TextArea ---------------------------------------------------------------- */

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-3 py-2 text-[13px] leading-snug text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors outline-none resize-none',
          'focus-visible:border-[var(--color-brand-purple)] focus-visible:shadow-[0_0_0_3px_rgba(91,82,214,0.10)]',
          className
        )}
        {...rest}
      />
    )
  }
)
TextArea.displayName = 'TextArea'

/** TextField --------------------------------------------------------------- */

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const TextField = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-3 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors outline-none',
          'focus-visible:border-[var(--color-brand-purple)] focus-visible:shadow-[0_0_0_3px_rgba(91,82,214,0.10)]',
          className
        )}
        {...rest}
      />
    )
  }
)
TextField.displayName = 'TextField'

/** DateField — `type="date"` with a single Lucide calendar affordance on the right. */

type DateFieldProps = Omit<InputProps, 'type'>

export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  ({ className, id, ...rest }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    function openPicker() {
      const el = inputRef.current
      if (!el) return
      if (typeof el.showPicker === 'function') {
        try {
          el.showPicker()
          return
        } catch {
          /* Safari may throw if not user-gesture; fall through */
        }
      }
      el.focus()
      el.click()
    }

    return (
      <div className="relative min-w-0">
        <input
          ref={inputRef}
          id={id}
          type="date"
          className={cn(
            'date-field-input relative',
            'h-9 w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] py-0 pl-3 pr-9 text-[13px] text-[var(--color-text-primary)] transition-colors outline-none',
            'focus-visible:border-[var(--color-brand-purple)] focus-visible:shadow-[0_0_0_3px_rgba(91,82,214,0.10)]',
            className
          )}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Open date picker"
          onClick={openPicker}
          className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] outline-none hover:text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-purple)] focus-visible:outline-offset-1"
        >
          <Calendar className="size-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    )
  }
)
DateField.displayName = 'DateField'
