import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Inbox } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import {
  Card,
  IntensityDot,
  Pill,
  Select,
  Eyebrow,
} from '@/components/system/primitives'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/utils'

type TimeGranularity = 'day' | 'week' | 'month'

type SummaryPayload = {
  ok: boolean
  deltaLabel: string
  deltaPct: number
  current: {
    total: number
    interruptions: number
    compensations: number
    interruptionPct: number
    compensationPct: number
  }
}

type TimeseriesPoint = {
  label: string
  interruptions: number
  compensations: number
}

type ShiftRowApi = {
  label: string
  interruptions: number
  compensations: number
  interruptionIntensity: number
  compensationIntensity: number
}

const RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]
const UNIT_OPTIONS = [
  { value: 'all', label: 'All units' },
  { value: 'nicu', label: 'NICU' },
  { value: 'icu', label: 'ICU' },
  { value: 'ed', label: 'ED' },
]
const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

const CATEGORIES: { label: string; pct: number; tone: 'purple' | 'teal' }[] = [
  { label: 'Admissions / transitions', pct: 28, tone: 'purple' },
  { label: 'Documentation / EHR', pct: 22, tone: 'purple' },
  { label: 'Communications', pct: 18, tone: 'purple' },
  { label: 'Discharge planning', pct: 12, tone: 'teal' },
  { label: 'Other', pct: 20, tone: 'teal' },
]

const UNITS: { name: string; count: number }[] = [
  { name: 'ICU', count: 1234 },
  { name: 'Med surg', count: 987 },
  { name: 'ED', count: 678 },
  { name: 'Stepdown', count: 456 },
  { name: 'Other', count: 487 },
]

function shiftIntensity(total: number): 'low' | 'medium' | 'high' {
  if (total >= 30) return 'high'
  if (total >= 10) return 'medium'
  return 'low'
}

function formatNumber(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString()
}

export function Dashboard() {
  const { authFetch, isAuthReady, token, isAuthenticated } = useAuth()
  const [range, setRange] = useState('7d')
  const [unitFilter, setUnitFilter] = useState('all')
  const [granularity, setGranularity] = useState<TimeGranularity>('day')

  const [summary, setSummary] = useState<
    (SummaryPayload['current'] & { deltaLabel: string; deltaPct: number }) | null
  >(null)
  const [trendPoints, setTrendPoints] = useState<TimeseriesPoint[]>([])
  const [shiftRows, setShiftRows] = useState<ShiftRowApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!isAuthReady || !isAuthenticated || !token) return

    setLoading(true)
    setError(null)
    try {
      const q = (path: string) =>
        authFetch(
          `${path}?range=${encodeURIComponent(range)}&unit=${encodeURIComponent(unitFilter)}`
        )
      const qTs = () =>
        authFetch(
          `/analytics/timeseries?range=${encodeURIComponent(range)}&unit=${encodeURIComponent(unitFilter)}&granularity=${encodeURIComponent(granularity)}`
        )

      const [sRes, tRes, shRes] = await Promise.all([
        q('/analytics/summary'),
        qTs(),
        q('/analytics/by-shift'),
      ])

      if (!sRes.ok) throw new Error((await sRes.json().catch(() => ({}))).error || 'Could not load summary.')
      if (!tRes.ok) throw new Error((await tRes.json().catch(() => ({}))).error || 'Could not load time series.')
      if (!shRes.ok) throw new Error((await shRes.json().catch(() => ({}))).error || 'Could not load shifts.')

      const sData = (await sRes.json()) as SummaryPayload
      const tData = (await tRes.json()) as { points: TimeseriesPoint[] }
      const shData = (await shRes.json()) as { shifts: ShiftRowApi[] }

      setSummary({
        ...sData.current,
        deltaLabel: sData.deltaLabel,
        deltaPct: sData.deltaPct,
      })
      setTrendPoints(tData.points ?? [])
      setShiftRows(shData.shifts ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setSummary(null)
      setTrendPoints([])
      setShiftRows([])
    } finally {
      setLoading(false)
    }
  }, [authFetch, isAuthReady, isAuthenticated, token, range, unitFilter, granularity])

  useEffect(() => {
    loadData()
  }, [loadData])

  const populatedTrendCount = useMemo(
    () => trendPoints.filter((p) => p.interruptions > 0 || p.compensations > 0).length,
    [trendPoints]
  )

  const trendIsSparse = populatedTrendCount < 3

  /**
   * Use a unique numeric x-key per data point so Recharts can disambiguate
   * duplicate weekday labels (e.g. two Thursdays in a 7-day window).
   */
  const chartData = useMemo(
    () => trendPoints.map((p, idx) => ({ ...p, __idx: idx })),
    [trendPoints]
  )

  return (
    <div className="min-h-svh bg-[var(--color-bg-base)]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1100px] space-y-8 px-6 py-10 fade-in">
        {/* Page header + filter toolbar */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl-tight text-[var(--color-text-primary)]">Workflow overview</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              Where work breaks down, when teams compensate, and how intensity shifts across units
              and shifts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={range}
              onChange={setRange}
              options={RANGE_OPTIONS}
              ariaLabel="Date range"
              size="sm"
              className="min-w-[140px]"
            />
            <Select
              value={unitFilter}
              onChange={setUnitFilter}
              options={UNIT_OPTIONS}
              ariaLabel="Unit filter"
              size="sm"
              className="min-w-[120px]"
            />
            <Select
              value={granularity}
              onChange={(v) => setGranularity(v as TimeGranularity)}
              options={GRANULARITY_OPTIONS}
              ariaLabel="Trend granularity"
              size="sm"
              className="min-w-[110px]"
            />
          </div>
        </section>

        {error && (
          <p
            className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-danger)] bg-[var(--color-danger-tint)] px-3 py-2 text-[13px] text-[var(--color-danger)]"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* KPI row */}
        <section className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            accent="neutral"
            label="Total signals"
            value={summary?.total ?? 0}
            loading={loading}
            footer={
              summary ? (
                <Pill tone={summary.deltaPct >= 0 ? 'success' : 'danger'}>
                  {summary.deltaLabel} vs prior
                </Pill>
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

        {/* Trend section — bars + smoothed area */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card raised>
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
              <div>
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  Signal trend
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                  Daily counts
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
              {trendIsSparse && !loading ? (
                <EmptyChart message="Signals will appear here as your team captures events" />
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
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
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                        content={<TrendTooltip />}
                      />
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
              {trendIsSparse && !loading ? (
                <EmptyChart message="Activity will populate as captures accumulate" />
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="grad-interruptions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-brand-purple)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-brand-purple)" stopOpacity={0} />
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top categories */}
          <Card raised>
            <div className="px-5 pt-4">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                Top categories
              </p>
            </div>
            <div className="space-y-3.5 px-5 py-4">
              {CATEGORIES.map((c) => (
                <div
                  key={c.label}
                  className="group cursor-pointer rounded-[var(--radius-sm)] -mx-2 px-2 py-1 transition-colors hover:bg-[var(--color-bg-raised)]"
                >
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="truncate font-medium text-[var(--color-text-primary)]">
                      {c.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">
                      {c.pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border-soft)]">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        c.tone === 'purple'
                          ? 'bg-[var(--color-brand-purple)]'
                          : 'bg-[var(--color-brand-teal)]'
                      )}
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* By shift */}
          <Card raised>
            <div className="px-5 pt-4">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">By shift</p>
            </div>
            <div className="px-5 py-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px]">
                  <thead>
                    <tr>
                      <th className="pb-2 pr-2 text-left">
                        <Eyebrow>Shift</Eyebrow>
                      </th>
                      <th className="pb-2 pr-2 text-left">
                        <Eyebrow>Interruptions</Eyebrow>
                      </th>
                      <th className="pb-2 text-left">
                        <Eyebrow>Compensations</Eyebrow>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftRows.map((row) => {
                      const total = row.interruptions + row.compensations
                      return (
                        <tr
                          key={row.label}
                          className="border-t-[0.5px] border-[var(--color-border-soft)]"
                        >
                          <td className="py-3 pr-2 align-middle">
                            <span className="inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-text-primary)]">
                              <IntensityDot
                                level={shiftIntensity(total)}
                                ariaLabel={`Intensity ${shiftIntensity(total)}`}
                              />
                              {row.label}
                            </span>
                          </td>
                          <td className="py-3 pr-2 align-middle">
                            <ShiftBar
                              count={row.interruptions}
                              intensity={row.interruptionIntensity}
                              tone="purple"
                            />
                          </td>
                          <td className="py-3 align-middle">
                            <ShiftBar
                              count={row.compensations}
                              intensity={row.compensationIntensity}
                              tone="teal"
                            />
                          </td>
                        </tr>
                      )
                    })}
                    {shiftRows.length === 0 && (
                      <tr className="border-t-[0.5px] border-[var(--color-border-soft)]">
                        <td
                          colSpan={3}
                          className="py-6 text-center text-[12px] text-[var(--color-text-muted)]"
                        >
                          No shift-tagged signals yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* By unit */}
          <Card raised className="lg:col-span-2">
            <div className="px-5 pt-4">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                By unit (top 5)
              </p>
            </div>
            <div className="space-y-3.5 px-5 py-4">
              {UNITS.map((u) => {
                const max = Math.max(...UNITS.map((x) => x.count))
                return (
                  <div key={u.name}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="font-medium text-[var(--color-text-primary)]">{u.name}</span>
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
                )
              })}
            </div>
          </Card>
        </div>

        <div className="pt-2 text-center text-[12px] text-[var(--color-text-muted)]">
          From insight to impact: where work breaks down, what staff compensate for, and where to
          invest next.
        </div>
      </main>
    </div>
  )
}

type KpiAccent = 'neutral' | 'purple' | 'teal'

const kpiAccentBg: Record<KpiAccent, string> = {
  neutral:
    'bg-[linear-gradient(135deg,#F2F2F4_0%,#FFFFFF_55%)]',
  purple:
    'bg-[linear-gradient(135deg,var(--color-brand-purple-tint)_0%,#FFFFFF_55%)]',
  teal:
    'bg-[linear-gradient(135deg,var(--color-brand-teal-tint)_0%,#FFFFFF_55%)]',
}

const kpiAccentBar: Record<KpiAccent, string> = {
  neutral: 'bg-[var(--color-border-soft)]',
  purple: 'bg-[var(--color-brand-purple)]',
  teal: 'bg-[var(--color-brand-teal)]',
}

function KpiCard({
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
    <Card
      raised
      className={cn('relative overflow-hidden p-5', kpiAccentBg[accent])}
    >
      <span
        aria-hidden
        className={cn('absolute left-0 top-0 h-full w-[3px]', kpiAccentBar[accent])}
      />
      <div className="space-y-3">
        <Eyebrow>{label}</Eyebrow>
        <div
          className={cn(
            'text-[40px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text-primary)]',
            loading && 'opacity-60'
          )}
        >
          {value.toLocaleString()}
        </div>
        <div>{footer}</div>
      </div>
    </Card>
  )
}

function ShiftBar({
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
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: count > 0 ? `${widthPct}%` : '0%',
            background: fillColor,
          }}
        />
      </div>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
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

type TooltipProps = {
  active?: boolean
  payload?: Array<{
    value: number
    name?: string
    dataKey?: string
    payload?: TimeseriesPoint & { __idx?: number }
  }>
}

function TrendTooltip({ active, payload }: TooltipProps) {
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
