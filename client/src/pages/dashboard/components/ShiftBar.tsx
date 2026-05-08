import { cn } from '@/lib/utils'

function formatNumber(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString()
}

export function ShiftBar({
  count,
  intensity,
  tone,
}: {
  count: number
  intensity: number
  tone: 'purple' | 'teal'
}) {
  const fillColor = tone === 'purple' ? 'var(--color-brand-purple)' : 'var(--color-brand-teal)'
  const widthPct = Math.max(8, Math.round(intensity * 100))
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 shrink-0 text-right text-[13px] font-medium tabular-nums text-[var(--color-text-primary)]">
        {formatNumber(count)}
      </span>
      <div className="h-1.5 w-full max-w-[140px] flex-1 overflow-hidden rounded-full bg-[var(--color-border-soft)]">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300')}
          style={{
            width: count > 0 ? `${widthPct}%` : '0%',
            background: fillColor,
          }}
        />
      </div>
    </div>
  )
}

