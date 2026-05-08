import { Download } from 'lucide-react'
import { Button, Select, TextField } from '@/components/system/primitives'
import {
  DATE_PRESET_OPTIONS,
  GRANULARITY_OPTIONS,
  type DatePreset,
  type TimeGranularity,
  UNIT_OPTIONS,
} from '@/pages/dashboard/useDashboardData'

export function DashboardToolbar({
  datePreset,
  setDatePreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  unitFilter,
  setUnitFilter,
  granularity,
  setGranularity,
  onExportCsv,
}: {
  datePreset: DatePreset
  setDatePreset: (v: DatePreset) => void
  customStart: string
  setCustomStart: (v: string) => void
  customEnd: string
  setCustomEnd: (v: string) => void
  unitFilter: string
  setUnitFilter: (v: string) => void
  granularity: TimeGranularity
  setGranularity: (v: TimeGranularity) => void
  onExportCsv: () => void
}) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl-tight text-[var(--color-text-primary)]">Workflow overview</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          Where work breaks down, when teams compensate, and how intensity shifts across units and
          shifts.
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
        <Button variant="outlined" size="sm" onClick={onExportCsv}>
          <Download className="mr-1.5 size-3.5" strokeWidth={1.75} aria-hidden />
          Export CSV
        </Button>
      </div>
    </section>
  )
}

