import { Pill } from '@/components/system/primitives'
import { KpiCard } from '@/pages/dashboard/components/KpiCard'

export function KpiRow({
  summary,
  loading,
}: {
  summary: {
    total: number
    interruptions: number
    compensations: number
    interruptionPct: number
    compensationPct: number
    deltaLabel: string
    deltaPct: number
  } | null
  loading: boolean
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <KpiCard
        accent="neutral"
        label="Total signals"
        value={summary?.total ?? 0}
        loading={loading}
        footer={
          summary ? (
            <Pill tone={summary.deltaPct >= 0 ? 'success' : 'danger'}>{summary.deltaLabel} vs prior</Pill>
          ) : (
            <Pill tone="neutral">— vs prior</Pill>
          )
        }
      />
      <KpiCard
        accent="purple"
        label="Interruptions"
        value={summary?.interruptions ?? 0}
        loading={loading}
        footer={
          <span className="text-[12px] text-[var(--color-text-muted)]">
            {summary?.interruptionPct ?? 0}% of total
          </span>
        }
      />
      <KpiCard
        accent="teal"
        label="Compensations"
        value={summary?.compensations ?? 0}
        loading={loading}
        footer={
          <span className="text-[12px] text-[var(--color-text-muted)]">
            {summary?.compensationPct ?? 0}% of total
          </span>
        }
      />
    </section>
  )
}

