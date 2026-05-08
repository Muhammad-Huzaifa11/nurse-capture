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
    <div className="rounded-[var(--radius-md)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-3 py-2 text-[13px] shadow-[var(--shadow-token-lg)]">
      <p className="mb-1.5 text-[12px] font-medium text-[var(--color-text-secondary)]">
        {row.label}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--color-brand-purple)]" />
          <span className="tabular-nums text-[var(--color-text-primary)]">
            {row.interruptions}
          </span>
          <span className="text-[var(--color-text-muted)]">interruptions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--color-brand-teal)]" />
          <span className="tabular-nums text-[var(--color-text-primary)]">
            {row.compensations}
          </span>
          <span className="text-[var(--color-text-muted)]">compensations</span>
        </div>
      </div>
    </div>
  )
}

