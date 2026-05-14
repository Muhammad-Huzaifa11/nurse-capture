type TimeseriesPoint = {
  label: string
  interruptions: number
  compensations: number
}

type TooltipProps = {
  active?: boolean
  payload?: Array<{
    value: number
    name?: string
    dataKey?: string
    payload?: TimeseriesPoint & { __idx?: number }
  }>
}

export function TrendTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="max-w-[min(100vw-1.5rem,20rem)] rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-3 py-2 text-[13px] shadow-[var(--shadow-token-lg)]">
      <p className="mb-1.5 text-[12px] font-medium text-[var(--color-text-secondary)]">
        {row.label}
      </p>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-[var(--color-brand-purple)]" />
          <span className="tabular-nums text-[var(--color-text-primary)]">
            {row.interruptions}
          </span>
          <span className="text-[var(--color-text-muted)]">interruptions</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-[var(--color-brand-teal)]" />
          <span className="tabular-nums text-[var(--color-text-primary)]">
            {row.compensations}
          </span>
          <span className="text-[var(--color-text-muted)]">compensations</span>
        </div>
      </div>
    </div>
  )
}
