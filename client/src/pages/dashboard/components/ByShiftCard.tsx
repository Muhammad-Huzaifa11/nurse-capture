import { Card, Eyebrow, IntensityDot } from '@/components/system/primitives'
import { Skeleton } from '@/pages/dashboard/components/DashboardSkeletons'
import { ShiftBar } from '@/pages/dashboard/components/ShiftBar'

type ShiftRow = {
  label: string
  interruptions: number
  compensations: number
  interruptionIntensity: number
  compensationIntensity: number
}

function shiftIntensity(total: number): 'low' | 'medium' | 'high' {
  if (total >= 30) return 'high'
  if (total >= 10) return 'medium'
  return 'low'
}

export function ByShiftCard({ loading, shiftRows }: { loading: boolean; shiftRows: ShiftRow[] }) {
  return (
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
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr
                    key={`shift-skel-${i}`}
                    className="border-t-[0.5px] border-[var(--color-border-soft)]"
                  >
                    <td className="py-3 pr-2 align-middle">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 pr-2 align-middle">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="py-3 align-middle">
                      <Skeleton className="h-4 w-32" />
                    </td>
                  </tr>
                ))}

              {shiftRows.map((row) => {
                const total = row.interruptions + row.compensations
                const level = shiftIntensity(total)
                return (
                  <tr
                    key={row.label}
                    className="border-t-[0.5px] border-[var(--color-border-soft)]"
                  >
                    <td className="py-3 pr-2 align-middle">
                      <span className="inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-text-primary)]">
                        <IntensityDot level={level} ariaLabel={`Intensity ${level}`} />
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

              {!loading && shiftRows.length === 0 && (
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
  )
}

