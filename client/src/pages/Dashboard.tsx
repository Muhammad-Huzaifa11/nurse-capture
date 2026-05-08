import { useCallback, useMemo } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { useAuth } from '@/auth/AuthContext'
import {
  unitLabelForFilter,
  useDashboardData,
} from '@/pages/dashboard/useDashboardData'
import { DashboardToolbar } from '@/pages/dashboard/components/DashboardToolbar'
import { KpiRow } from '@/pages/dashboard/components/KpiRow'
import { TrendSection } from '@/pages/dashboard/components/TrendSection'
import { RatioTrendCard } from '@/pages/dashboard/components/RatioTrendCard'
import { ByShiftCard } from '@/pages/dashboard/components/ByShiftCard'
import { ByUnitCard } from '@/pages/dashboard/components/ByUnitCard'
import { ActivityFeedCard } from '@/pages/dashboard/components/ActivityFeedCard'

export function Dashboard() {
  const { authFetch, isAuthReady, token, isAuthenticated } = useAuth()
  const enabled = Boolean(isAuthReady && isAuthenticated && token)
  const {
    unitFilter,
    setUnitFilter,
    granularity,
    setGranularity,
    datePreset,
    setDatePreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    feedPage,
    setFeedPage,
    totalFeedPages,
    summary,
    trendPoints,
    ratioPoints,
    shiftRows,
    unitRows,
    feedItems,
    feedTotal,
    loading,
    error,
    setError,
  } = useDashboardData({ authFetch, enabled })

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
  const handleExportCsv = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (datePreset === 'custom') {
        if (!customStart || !customEnd) throw new Error('Select both start and end dates for a custom range.')
        params.set('start', new Date(`${customStart}T00:00:00.000Z`).toISOString())
        params.set('end', new Date(`${customEnd}T23:59:59.999Z`).toISOString())
      } else if (datePreset === 'this-month') {
        params.set('preset', 'this-month')
      } else {
        params.set('range', datePreset)
      }
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
  }, [authFetch, unitFilter, datePreset, customStart, customEnd, setError])

  return (
    <div className="min-h-svh bg-[var(--color-bg-base)]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1100px] space-y-8 px-6 py-10 fade-in">
        <DashboardToolbar
          datePreset={datePreset}
          setDatePreset={setDatePreset}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
          unitFilter={unitFilter}
          setUnitFilter={setUnitFilter}
          granularity={granularity}
          setGranularity={setGranularity}
          onExportCsv={handleExportCsv}
        />

        {error && (
          <p
            className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-danger)] bg-[var(--color-danger-tint)] px-3 py-2 text-[13px] text-[var(--color-danger)]"
            role="alert"
          >
            {error}
          </p>
        )}

        <KpiRow summary={summary} loading={loading} />

        <TrendSection
          loading={loading}
          granularity={granularity}
          trendPoints={trendPoints}
          chartData={chartData}
          hasTrendData={hasTrendData}
          emptyTrendMessage={emptyTrendMessage}
          emptyActivityMessage={emptyActivityMessage}
        />

        <RatioTrendCard loading={loading} ratioPoints={ratioPoints} unitFilter={unitFilter} />

        <div className="grid gap-6 lg:grid-cols-2">
          <ByShiftCard loading={loading} shiftRows={shiftRows} />
          <ByUnitCard loading={loading} unitRows={unitRows} />
        </div>

        <ActivityFeedCard
          loading={loading}
          feedItems={feedItems}
          feedTotal={feedTotal}
          feedPage={feedPage}
          totalFeedPages={totalFeedPages}
          onPrevPage={() => setFeedPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setFeedPage((p) => Math.min(totalFeedPages, p + 1))}
        />

        <div className="pt-2 text-center text-[12px] text-[var(--color-text-muted)]">
          From insight to impact: where work breaks down, what staff compensate for, and where to
          invest next.
        </div>
      </main>
    </div>
  )
}
