import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, Pill } from '@/components/system/primitives'
import { LineChartSkeleton } from '@/pages/dashboard/components/DashboardSkeletons'
import { EmptyChart } from '@/pages/dashboard/components/EmptyChart'
import { unitLabelForFilter } from '@/pages/dashboard/useDashboardData'

type RatioPoint = {
  label: string
  interruptions: number
  compensations: number
  ratio: number
}

export function RatioTrendCard({
  loading,
  ratioPoints,
  unitFilter,
}: {
  loading: boolean
  ratioPoints: RatioPoint[]
  unitFilter: string
}) {
  const isAllUnits = unitFilter === 'all'

  return (
    <section>
      <Card raised>
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              Compensation ratio trend
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
              Compensations divided by interruptions by period
            </p>
          </div>
          <Pill tone="brand">Early burnout signal</Pill>
        </div>
        <div className="px-3 pb-4 pt-2 sm:px-5">
          {loading ? (
            <LineChartSkeleton />
          ) : ratioPoints.length === 0 ? (
            <EmptyChart
              message={
                isAllUnits
                  ? 'Ratio trend will appear as signals accumulate'
                  : `No ratio data for ${unitLabelForFilter(unitFilter)} yet`
              }
            />
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratioPoints} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid
                    stroke="var(--color-border-soft)"
                    strokeOpacity={0.4}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="ratio"
                    name="Compensation ratio"
                    stroke="var(--color-brand-purple)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive
                    animationDuration={450}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </section>
  )
}

