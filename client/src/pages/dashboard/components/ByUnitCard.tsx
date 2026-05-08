import { Card } from '@/components/system/primitives'
import { Skeleton } from '@/pages/dashboard/components/DashboardSkeletons'

type UnitRow = {
  key: string
  label: string
  count: number
}

export function ByUnitCard({ loading, unitRows }: { loading: boolean; unitRows: UnitRow[] }) {
  const max = Math.max(...unitRows.map((x) => x.count), 1)

  return (
    <Card raised>
      <div className="px-5 pt-4">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">By unit (top 5)</p>
      </div>
      <div className="space-y-3.5 px-5 py-4">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`unit-skel-${i}`}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="mt-1.5 h-[3px] w-full" />
            </div>
          ))}

        {unitRows.map((u) => (
          <div key={u.key}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-[var(--color-text-primary)]">{u.label}</span>
              <span className="tabular-nums text-[var(--color-text-muted)]">
                {u.count.toLocaleString()}
              </span>
            </div>
            <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border-soft)]">
              <div
                className="h-full rounded-full bg-[var(--color-brand-teal)]"
                style={{ width: `${(u.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {!loading && unitRows.length === 0 && (
          <p className="text-[12px] text-[var(--color-text-muted)]">No unit-tagged signals yet.</p>
        )}
      </div>
    </Card>
  )
}

