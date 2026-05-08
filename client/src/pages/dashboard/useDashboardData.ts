import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SelectOption } from '@/components/system/primitives'
import { fetchJsonOrThrow } from '@/lib/fetchJson'

export type TimeGranularity = 'day' | 'week' | 'month'
export type DatePreset = '7d' | '30d' | 'this-month' | 'custom'

export type ShiftRowApi = {
  label: string
  interruptions: number
  compensations: number
  interruptionIntensity: number
  compensationIntensity: number
}

export type UnitRowApi = {
  key: string
  label: string
  count: number
}

export type RatioPoint = {
  label: string
  interruptions: number
  compensations: number
  ratio: number
}

export type FeedItem = {
  id: string
  timestamp: string | null
  signalType: string
  unit: string
  shift: string
  noteSnippet: string
  seatLabel: string | null
}

export type SummaryPayload = {
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

export const GRANULARITY_OPTIONS: SelectOption[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

export const DATE_PRESET_OPTIONS: SelectOption[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
]

export const UNIT_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All units' },
  { value: 'icu', label: 'ICU' },
  { value: 'med-surg', label: 'Med surg' },
  { value: 'ed', label: 'ED' },
  { value: 'stepdown', label: 'Stepdown' },
  { value: 'other', label: 'Other' },
]

export function unitLabelForFilter(value: string): string {
  return UNIT_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Selected unit'
}

function buildTimeParams(datePreset: DatePreset, customStart: string, customEnd: string) {
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
}

export function useDashboardData({
  authFetch,
  enabled,
}: {
  authFetch: (path: string, init?: RequestInit) => Promise<Response>
  enabled: boolean
}) {
  const [unitFilter, setUnitFilter] = useState('all')
  const [granularity, setGranularity] = useState<TimeGranularity>('day')
  const [datePreset, setDatePreset] = useState<DatePreset>('7d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [summary, setSummary] = useState<
    (SummaryPayload['current'] & { deltaLabel: string; deltaPct: number }) | null
  >(null)
  const [trendPoints, setTrendPoints] = useState<Array<{ label: string; interruptions: number; compensations: number }>>(
    []
  )
  const [ratioPoints, setRatioPoints] = useState<RatioPoint[]>([])
  const [shiftRows, setShiftRows] = useState<ShiftRowApi[]>([])
  const [unitRows, setUnitRows] = useState<UnitRowApi[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [feedTotal, setFeedTotal] = useState(0)
  const [feedPage, setFeedPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFeedPage(1)
  }, [unitFilter, granularity, datePreset, customStart, customEnd])

  const loadData = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const baseParams = buildTimeParams(datePreset, customStart, customEnd)
      baseParams.set('unit', unitFilter)

      const withGranularity = new URLSearchParams(baseParams)
      withGranularity.set('granularity', granularity)

      const feedParams = new URLSearchParams(baseParams)
      feedParams.set('page', String(feedPage))
      feedParams.set('pageSize', '20')

      const [sData, tData, shData, uData, rData, fData] = await Promise.all([
        fetchJsonOrThrow<SummaryPayload>(authFetch, `/analytics/summary?${baseParams.toString()}`, undefined, 'Could not load summary.'),
        fetchJsonOrThrow<{ points: Array<{ label: string; interruptions: number; compensations: number }> }>(
          authFetch,
          `/analytics/timeseries?${withGranularity.toString()}`,
          undefined,
          'Could not load time series.'
        ),
        fetchJsonOrThrow<{ shifts: ShiftRowApi[] }>(authFetch, `/analytics/by-shift?${baseParams.toString()}`, undefined, 'Could not load shifts.'),
        fetchJsonOrThrow<{ units: UnitRowApi[] }>(authFetch, `/analytics/by-unit?${baseParams.toString()}`, undefined, 'Could not load units.'),
        fetchJsonOrThrow<{ points: RatioPoint[] }>(authFetch, `/analytics/ratio-trend?${withGranularity.toString()}`, undefined, 'Could not load ratio trend.'),
        fetchJsonOrThrow<{ items: FeedItem[]; total: number }>(
          authFetch,
          `/analytics/activity-feed?${feedParams.toString()}`,
          undefined,
          'Could not load activity feed.'
        ),
      ])

      setSummary({ ...sData.current, deltaLabel: sData.deltaLabel, deltaPct: sData.deltaPct })
      setTrendPoints(tData.points ?? [])
      setShiftRows(shData.shifts ?? [])
      setUnitRows(uData.units ?? [])
      setRatioPoints(rData.points ?? [])
      setFeedItems(fData.items ?? [])
      setFeedTotal(fData.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setSummary(null)
      setTrendPoints([])
      setShiftRows([])
      setUnitRows([])
      setRatioPoints([])
      setFeedItems([])
      setFeedTotal(0)
    } finally {
      setLoading(false)
    }
  }, [enabled, authFetch, unitFilter, granularity, datePreset, customStart, customEnd, feedPage])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalFeedPages = useMemo(() => Math.max(1, Math.ceil(feedTotal / 20)), [feedTotal])

  return {
    // filters
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

    // data
    summary,
    trendPoints,
    ratioPoints,
    shiftRows,
    unitRows,
    feedItems,
    feedTotal,

    // state
    loading,
    error,
    setError,
  }
}

