import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/system/primitives'
import { BarChartSkeleton, LineChartSkeleton } from '@/pages/dashboard/components/DashboardSkeletons'
import { EmptyChart } from '@/pages/dashboard/components/EmptyChart'
import { TrendTooltip } from '@/pages/dashboard/components/TrendTooltip'

type TrendPoint = { label: string; interruptions: number; compensations: number }
type TrendPointWithIdx = TrendPoint & { __idx: number }

function granularitySubtitle(granularity: 'day' | 'week' | 'month') {
  if (granularity === 'week') return 'Weekly counts'
  if (granularity === 'month') return 'Monthly counts'
  return 'Daily counts'
}

export function TrendSection({
  loading,
  granularity,
  trendPoints,
  chartData,
  hasTrendData,
  emptyTrendMessage,
  emptyActivityMessage,
}: {
  loading: boolean
  granularity: 'day' | 'week' | 'month'
  trendPoints: TrendPoint[]
  chartData: TrendPointWithIdx[]
  hasTrendData: boolean
  emptyTrendMessage: string
  emptyActivityMessage: string
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card raised>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Signal trend</p>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
              {granularitySubtitle(granularity)}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--color-brand-purple)]" />
              Interruptions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--color-brand-teal)]" />
              Compensations
            </span>
          </div>
        </div>

        <div className="px-3 pb-4 pt-2 sm:px-5">
          {loading ? (
            <BarChartSkeleton />
          ) : !hasTrendData ? (
            <EmptyChart message={emptyTrendMessage} />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 12, right: 12, left: 12, bottom: 4 }}
                  barCategoryGap={trendPoints.length > 14 ? 2 : 8}
                >
                  <CartesianGrid
                    stroke="var(--color-border-soft)"
                    strokeOpacity={0.4}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="__idx"
                    type="category"
                    stroke="var(--color-text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tickFormatter={(i: number) => trendPoints[i]?.label ?? ''}
                  />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} content={<TrendTooltip />} />
                  <Bar
                    dataKey="interruptions"
                    fill="var(--color-brand-purple)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive
                    animationDuration={400}
                    animationBegin={0}
                  />
                  <Bar
                    dataKey="compensations"
                    fill="var(--color-brand-teal)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive
                    animationDuration={400}
                    animationBegin={120}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      <Card raised>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              Activity intensity
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
              Smoothed view of daily activity
            </p>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--color-brand-purple)]" />
              Interruptions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--color-brand-teal)]" />
              Compensations
            </span>
          </div>
        </div>

        <div className="px-3 pb-4 pt-2 sm:px-5">
          {loading ? (
            <LineChartSkeleton />
          ) : !hasTrendData ? (
            <EmptyChart message={emptyActivityMessage} />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 12, bottom: 4 }}>
                  <defs>
                    <linearGradient id="grad-interruptions" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-brand-purple)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-brand-purple)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient id="grad-compensations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-brand-teal)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-brand-teal)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--color-border-soft)"
                    strokeOpacity={0.4}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="__idx"
                    type="category"
                    stroke="var(--color-text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tickFormatter={(i: number) => trendPoints[i]?.label ?? ''}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ stroke: 'var(--color-border-strong)', strokeDasharray: '3 3' }}
                    content={<TrendTooltip />}
                  />
                  <Area
                    type="monotone"
                    dataKey="interruptions"
                    stroke="var(--color-brand-purple)"
                    strokeWidth={2}
                    fill="url(#grad-interruptions)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive
                    animationDuration={500}
                  />
                  <Area
                    type="monotone"
                    dataKey="compensations"
                    stroke="var(--color-brand-teal)"
                    strokeWidth={2}
                    fill="url(#grad-compensations)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive
                    animationDuration={500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </section>
  )
}

