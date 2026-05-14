import { Calendar, Download } from 'lucide-react'
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
    <section className="flex min-w-0 max-w-full flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl-tight text-[var(--color-text-primary)]">Workflow overview</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          Where work breaks down, when teams compensate, and how intensity shifts across units and
          shifts.
        </p>
      </div>

      <div className="flex w-full min-w-0 max-w-full flex-col gap-2 md:w-auto md:max-w-none md:flex-row md:flex-wrap md:items-end md:justify-end">
        <Select
          value={datePreset}
          onChange={(v) => setDatePreset(v as DatePreset)}
          options={DATE_PRESET_OPTIONS}
          ariaLabel="Date range preset"
          size="sm"
          className="w-full min-w-0 md:w-auto md:min-w-[160px]"
        />
        {datePreset === 'custom' && (
          <div className="flex w-full min-w-0 max-w-full flex-col gap-3 md:inline-flex md:w-auto md:max-w-none md:flex-row md:items-end md:gap-3">
            <div className="flex min-w-0 max-w-full flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
              <label
                htmlFor="dashboard-custom-start"
                className="block shrink-0 text-[12px] font-medium leading-none text-[var(--color-text-secondary)]"
              >
                Start date
              </label>
              <div className="flex min-w-0 max-w-full items-center gap-2 md:contents">
                <Calendar
                  className="size-3.5 shrink-0 text-[var(--color-text-muted)] md:hidden"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <TextField
                  id="dashboard-custom-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 min-w-0 flex-1 md:w-auto md:min-w-[150px] md:flex-initial"
                />
              </div>
            </div>
            <div className="flex min-w-0 max-w-full flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
              <label
                htmlFor="dashboard-custom-end"
                className="block shrink-0 text-[12px] font-medium leading-none text-[var(--color-text-secondary)]"
              >
                End date
              </label>
              <div className="flex min-w-0 max-w-full items-center gap-2 md:contents">
                <Calendar
                  className="size-3.5 shrink-0 text-[var(--color-text-muted)] md:hidden"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <TextField
                  id="dashboard-custom-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 min-w-0 flex-1 md:w-auto md:min-w-[150px] md:flex-initial"
                />
              </div>
            </div>
          </div>
        )}
        <div className="flex w-full min-w-0 max-w-full flex-wrap items-end gap-2 md:w-auto md:flex-nowrap md:shrink-0">
          <Select
            value={unitFilter}
            onChange={setUnitFilter}
            options={UNIT_OPTIONS}
            ariaLabel="Unit filter"
            size="sm"
            className="min-w-0 flex-1 basis-[9.5rem] sm:min-w-[120px] sm:flex-initial"
          />
          <Select
            value={granularity}
            onChange={(v) => setGranularity(v as TimeGranularity)}
            options={GRANULARITY_OPTIONS}
            ariaLabel="Time view"
            size="sm"
            className="min-w-0 flex-1 basis-[7.5rem] sm:min-w-[110px] sm:flex-initial"
          />
          <Button variant="outlined" size="sm" className="min-w-0 shrink-0" onClick={onExportCsv}>
            <Download className="mr-1.5 size-3.5" strokeWidth={1.75} aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>
    </section>
  )
}

