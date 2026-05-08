import { Card, Eyebrow } from '@/components/system/primitives'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/pages/dashboard/components/DashboardSkeletons'

type KpiAccent = 'neutral' | 'purple' | 'teal'

const kpiAccentBg: Record<KpiAccent, string> = {
  neutral: 'bg-[linear-gradient(135deg,#F2F2F4_0%,#FFFFFF_55%)]',
  purple: 'bg-[linear-gradient(135deg,var(--color-brand-purple-tint)_0%,#FFFFFF_55%)]',
  teal: 'bg-[linear-gradient(135deg,var(--color-brand-teal-tint)_0%,#FFFFFF_55%)]',
}

const kpiAccentBar: Record<KpiAccent, string> = {
  neutral: 'bg-[var(--color-border-soft)]',
  purple: 'bg-[var(--color-brand-purple)]',
  teal: 'bg-[var(--color-brand-teal)]',
}

export function KpiCard({
  accent = 'neutral',
  label,
  value,
  loading,
  footer,
}: {
  accent?: KpiAccent
  label: string
  value: number
  loading: boolean
  footer: React.ReactNode
}) {
  return (
    <Card raised className={cn('relative overflow-hidden p-5', kpiAccentBg[accent])}>
      <span aria-hidden className={cn('absolute left-0 top-0 h-full w-[3px]', kpiAccentBar[accent])} />
      <div className="space-y-3">
        <Eyebrow>{label}</Eyebrow>
        {loading ? (
          <>
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-4 w-24" />
          </>
        ) : (
          <>
            <div className="text-[40px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text-primary)]">
              {value.toLocaleString()}
            </div>
            <div>{footer}</div>
          </>
        )}
      </div>
    </Card>
  )
}

