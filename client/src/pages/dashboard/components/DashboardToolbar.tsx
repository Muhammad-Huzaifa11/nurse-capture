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

      <div className="flex flex-wrap items-end gap-2">
        <Select
          value={datePreset}
          onChange={(v) => setDatePreset(v as DatePreset)}
          options={DATE_PRESET_OPTIONS}
          ariaLabel="Date range preset"
          size="sm"
          className="min-w-[160px]"
        />
        {datePreset === 'custom' && (
          <div className="flex w-full basis-full flex-col gap-3 sm:inline-flex sm:w-auto sm:basis-auto sm:max-w-none sm:flex-row sm:items-end sm:gap-3">
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-initial">
              <label
                htmlFor="dashboard-custom-start"
                className="block shrink-0 text-[12px] font-medium leading-none text-[var(--color-text-secondary)]"
              >
                Start date
              </label>
              <TextField
                id="dashboard-custom-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 w-full min-w-0 sm:min-w-[150px]"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-initial">
              <label
                htmlFor="dashboard-custom-end"
                className="block shrink-0 text-[12px] font-medium leading-none text-[var(--color-text-secondary)]"
              >
                End date
              </label>
              <TextField
                id="dashboard-custom-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 w-full min-w-0 sm:min-w-[150px]"
              />
            </div>
          </div>
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

