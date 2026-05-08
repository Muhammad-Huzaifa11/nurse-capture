import { Inbox } from 'lucide-react'

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-[0.5px] border-dashed border-[var(--color-border-soft)] bg-[var(--color-bg-raised)] text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] shadow-[var(--shadow-token-sm)]">
        <Inbox className="size-4" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{message}</p>
      <p className="text-[12px] text-[var(--color-text-muted)]">
        Trend will populate once a few days have data.
      </p>
    </div>
  )
}

