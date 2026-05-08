import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, Inbox } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import {
  Button,
  Card,
  IntensityDot,
  Pill,
  Select,
  Eyebrow,
  TextField,
} from '@/components/system/primitives'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/utils'

type TimeGranularity = 'day' | 'week' | 'month'
type DatePreset = '7d' | '30d' | 'this-month' | 'custom'

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

type UnitRowApi = {
  key: string
  label: string
  count: number
}

type RatioPoint = {
  label: string
  interruptions: number
  compensations: number
  ratio: number
}

type FeedItem = {
  id: string
  timestamp: string | null
  signalType: string
  unit: string
  shift: string
  noteSnippet: string
  seatLabel: string | null
}

const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]
const DATE_PRESET_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
]

const UNIT_OPTIONS = [
  { value: 'all', label: 'All units' },
  { value: 'icu', label: 'ICU' },
  { value: 'med-surg', label: 'Med surg' },
  { value: 'ed', label: 'ED' },
  { value: 'stepdown', label: 'Stepdown' },
  { value: 'other', label: 'Other' },
]

function unitLabelForFilter(value: string): string {
  return UNIT_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Selected unit'
}

function shiftIntensity(total: number): 'low' | 'medium' | 'high' {
  if (total >= 30) return 'high'
  if (total >= 10) return 'medium'
  return 'low'
}

function formatNumber(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString()
}

function granularitySubtitle(granularity: TimeGranularity) {
  if (granularity === 'week') return 'Weekly counts'
  if (granularity === 'month') return 'Monthly counts'
  return 'Daily counts'
}

export function Dashboard() {
  const { authFetch, isAuthReady, token, isAuthenticated } = useAuth()
  const [unitFilter, setUnitFilter] = useState('all')
  const [granularity, setGranularity] = useState<TimeGranularity>('day')
  const [datePreset, setDatePreset] = useState<DatePreset>('7d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [summary, setSummary] = useState<
    (SummaryPayload['current'] & { deltaLabel: string; deltaPct: number }) | null
  >(null)
  const [trendPoints, setTrendPoints] = useState<TimeseriesPoint[]>([])
  const [ratioPoints, setRatioPoints] = useState<RatioPoint[]>([])
  const [shiftRows, setShiftRows] = useState<ShiftRowApi[]>([])
  const [unitRows, setUnitRows] = useState<UnitRowApi[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [feedTotal, setFeedTotal] = useState(0)
  const [feedPage, setFeedPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildTimeParams = useCallback(() => {
    const params = new URLSearchParams()
    if (datePreset === 'custom') {
      if (!customStart || !customEnd) {
        throw new Error('Select both start and end dates for a custom range.')
      }
      params.set('start', new Date(`${customStart}T00:00:00.000Z`).toISOString())
      params.set('end', new Date(`${customEnd}T23:59:59.999Z`).toISOString())
    } else if (datePreset === 'this-month') {
      params.set('preset', 'this-month')
    } else {
      params.set('range', datePreset)
    }
    return params
  }, [datePreset, customStart, customEnd])

  const loadData = useCallback(async () => {
    if (!isAuthReady || !isAuthenticated || !token) return

    setLoading(true)
    setError(null)
    try {
      const baseParams = buildTimeParams()
      baseParams.set('unit', unitFilter)
      const withGranularity = new URLSearchParams(baseParams)
      withGranularity.set('granularity', granularity)
      const feedParams = new URLSearchParams(baseParams)
      feedParams.set('page', String(feedPage))
      feedParams.set('pageSize', '20')

      const [sRes, tRes, shRes, uRes, rRes, fRes] = await Promise.all([
        authFetch(`/analytics/summary?${baseParams.toString()}`),
        authFetch(`/analytics/timeseries?${withGranularity.toString()}`),
        authFetch(`/analytics/by-shift?${baseParams.toString()}`),
        authFetch(`/analytics/by-unit?${baseParams.toString()}`),
        authFetch(`/analytics/ratio-trend?${withGranularity.toString()}`),
        authFetch(`/analytics/activity-feed?${feedParams.toString()}`),
      ])

      if (!sRes.ok) throw new Error((await sRes.json().catch(() => ({}))).error || 'Could not load summary.')
      if (!tRes.ok) throw new Error((await tRes.json().catch(() => ({}))).error || 'Could not load time series.')
      if (!shRes.ok) throw new Error((await shRes.json().catch(() => ({}))).error || 'Could not load shifts.')
      if (!uRes.ok) throw new Error((await uRes.json().catch(() => ({}))).error || 'Could not load units.')
      if (!rRes.ok) throw new Error((await rRes.json().catch(() => ({}))).error || 'Could not load ratio trend.')
      if (!fRes.ok) throw new Error((await fRes.json().catch(() => ({}))).error || 'Could not load activity feed.')

      const sData = (await sRes.json()) as SummaryPayload
      const tData = (await tRes.json()) as { points: TimeseriesPoint[] }
      const shData = (await shRes.json()) as { shifts: ShiftRowApi[] }
      const uData = (await uRes.json()) as { units: UnitRowApi[] }
      const rData = (await rRes.json()) as { points: RatioPoint[] }
      const fData = (await fRes.json()) as { items: FeedItem[]; total: number }

      setSummary({
        ...sData.current,
        deltaLabel: sData.deltaLabel,
        deltaPct: sData.deltaPct,
      })
      setTrendPoints(tData.points ?? [])
      setRatioPoints(rData.points ?? [])
      setShiftRows(shData.shifts ?? [])
      setUnitRows(uData.units ?? [])
      setFeedItems(fData.items ?? [])
      setFeedTotal(fData.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setSummary(null)
      setTrendPoints([])
      setRatioPoints([])
      setShiftRows([])
      setUnitRows([])
      setFeedItems([])
      setFeedTotal(0)
    } finally {
      setLoading(false)
    }
  }, [authFetch, isAuthReady, isAuthenticated, token, unitFilter, granularity, buildTimeParams, feedPage])

  useEffect(() => {
    loadData()
  }, [loadData])

  const populatedTrendCount = useMemo(
    () => trendPoints.filter((p) => p.interruptions > 0 || p.compensations > 0).length,
    [trendPoints]
  )

  const hasTrendData = populatedTrendCount > 0

  /**
   * Use a unique numeric x-key per data point so Recharts can disambiguate
   * duplicate weekday labels (e.g. two Thursdays in a 7-day window).
   */
  const chartData = useMemo(
    () => trendPoints.map((p, idx) => ({ ...p, __idx: idx })),
    [trendPoints]
  )
  const isAllUnits = unitFilter === 'all'
  const emptyTrendMessage = isAllUnits
    ? 'Signals will appear here as your team captures events'
    : `No signals for ${unitLabelForFilter(unitFilter)} yet`
  const emptyActivityMessage = isAllUnits
    ? 'Activity will populate as captures accumulate'
    : `No activity for ${unitLabelForFilter(unitFilter)} yet`
  const totalFeedPages = Math.max(1, Math.ceil(feedTotal / 20))

  useEffect(() => {
    setFeedPage(1)
  }, [unitFilter, granularity, datePreset, customStart, customEnd])

  const handleExportCsv = useCallback(async () => {
    try {
      const params = buildTimeParams()
      params.set('unit', unitFilter)
      const res = await authFetch(`/analytics/export.csv?${params.toString()}`)
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Could not export CSV.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'signals-export.csv'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export CSV.')
    }
  }, [authFetch, buildTimeParams, unitFilter])

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
              value={datePreset}
              onChange={(v) => setDatePreset(v as DatePreset)}
              options={DATE_PRESET_OPTIONS}
              ariaLabel="Date range preset"
              size="sm"
              className="min-w-[160px]"
            />
            {datePreset === 'custom' && (
              <>
                <TextField
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  aria-label="Custom range start date"
                  className="h-8 min-w-[150px]"
                />
                <TextField
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  aria-label="Custom range end date"
                  className="h-8 min-w-[150px]"
                />
              </>
            )}
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
              ariaLabel="Time view"
              size="sm"
              className="min-w-[110px]"
            />
            <Button variant="outlined" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1.5 size-3.5" strokeWidth={1.75} aria-hidden />
              Export CSV
            </Button>
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
              {!hasTrendData && !loading ? (
                <EmptyChart message={emptyTrendMessage} />
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
              {!hasTrendData && !loading ? (
                <EmptyChart message={emptyActivityMessage} />
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
              {ratioPoints.length === 0 && !loading ? (
                <EmptyChart message={isAllUnits ? 'Ratio trend will appear as signals accumulate' : `No ratio data for ${unitLabelForFilter(unitFilter)} yet`} />
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

        <div className="grid gap-6 lg:grid-cols-2">
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
          <Card raised>
            <div className="px-5 pt-4">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                By unit (top 5)
              </p>
            </div>
            <div className="space-y-3.5 px-5 py-4">
              {unitRows.map((u) => {
                const max = Math.max(...unitRows.map((x) => x.count), 1)
                return (
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
                )
              })}
              {unitRows.length === 0 && (
                <p className="text-[12px] text-[var(--color-text-muted)]">No unit-tagged signals yet.</p>
              )}
            </div>
          </Card>
        </div>

        <section>
          <Card raised>
            <div className="flex items-center justify-between border-b-[0.5px] border-[var(--color-border-soft)] px-5 py-3">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                Activity feed
                <span className="ml-1.5 text-[12px] font-normal text-[var(--color-text-muted)]">
                  ({feedTotal.toLocaleString()})
                </span>
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr>
                      <th className="pb-2 text-left"><Eyebrow>Timestamp</Eyebrow></th>
                      <th className="pb-2 text-left"><Eyebrow>Type</Eyebrow></th>
                      <th className="pb-2 text-left"><Eyebrow>Unit</Eyebrow></th>
                      <th className="pb-2 text-left"><Eyebrow>Shift</Eyebrow></th>
                      <th className="pb-2 text-left"><Eyebrow>Seat</Eyebrow></th>
                      <th className="pb-2 text-left"><Eyebrow>Note</Eyebrow></th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedItems.map((item) => (
                      <tr key={item.id} className="border-t-[0.5px] border-[var(--color-border-soft)]">
                        <td className="py-2 text-[12px] text-[var(--color-text-secondary)]">
                          {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}
                        </td>
                        <td className="py-2 text-[12px] text-[var(--color-text-primary)]">{item.signalType}</td>
                        <td className="py-2 text-[12px] text-[var(--color-text-primary)]">{item.unit}</td>
                        <td className="py-2 text-[12px] text-[var(--color-text-primary)]">{item.shift}</td>
                        <td className="py-2 text-[12px] text-[var(--color-text-secondary)]">
                          {item.seatLabel || '—'}
                        </td>
                        <td className="py-2 text-[12px] text-[var(--color-text-secondary)]">
                          {item.noteSnippet || '—'}
                        </td>
                      </tr>
                    ))}
                    {feedItems.length === 0 && (
                      <tr className="border-t-[0.5px] border-[var(--color-border-soft)]">
                        <td colSpan={6} className="py-6 text-center text-[12px] text-[var(--color-text-muted)]">
                          No activity in this range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={feedPage <= 1}
                  onClick={() => setFeedPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  Page {feedPage} / {totalFeedPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={feedPage >= totalFeedPages}
                  onClick={() => setFeedPage((p) => Math.min(totalFeedPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </section>

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
