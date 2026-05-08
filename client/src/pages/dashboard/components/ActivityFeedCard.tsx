import { Button, Card, Eyebrow } from '@/components/system/primitives'
import { Skeleton } from '@/pages/dashboard/components/DashboardSkeletons'

type FeedItem = {
  id: string
  timestamp: string | null
  signalType: string
  unit: string
  shift: string
  noteSnippet: string
  seatLabel: string | null
}

export function ActivityFeedCard({
  loading,
  feedItems,
  feedTotal,
  feedPage,
  totalFeedPages,
  onPrevPage,
  onNextPage,
}: {
  loading: boolean
  feedItems: FeedItem[]
  feedTotal: number
  feedPage: number
  totalFeedPages: number
  onPrevPage: () => void
  onNextPage: () => void
}) {
  return (
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
                  <th className="pb-2 text-left">
                    <Eyebrow>Timestamp</Eyebrow>
                  </th>
                  <th className="pb-2 text-left">
                    <Eyebrow>Type</Eyebrow>
                  </th>
                  <th className="pb-2 text-left">
                    <Eyebrow>Unit</Eyebrow>
                  </th>
                  <th className="pb-2 text-left">
                    <Eyebrow>Shift</Eyebrow>
                  </th>
                  <th className="pb-2 text-left">
                    <Eyebrow>Seat</Eyebrow>
                  </th>
                  <th className="pb-2 text-left">
                    <Eyebrow>Note</Eyebrow>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr
                      key={`feed-skel-${i}`}
                      className="border-t-[0.5px] border-[var(--color-border-soft)]"
                    >
                      <td className="py-2">
                        <Skeleton className="h-4 w-36" />
                      </td>
                      <td className="py-2">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-2">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="py-2">
                        <Skeleton className="h-4 w-14" />
                      </td>
                      <td className="py-2">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="py-2">
                        <Skeleton className="h-4 w-40" />
                      </td>
                    </tr>
                  ))}

                {feedItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t-[0.5px] border-[var(--color-border-soft)]"
                  >
                    <td className="py-2 text-[12px] text-[var(--color-text-secondary)]">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 text-[12px] text-[var(--color-text-primary)]">
                      {item.signalType}
                    </td>
                    <td className="py-2 text-[12px] text-[var(--color-text-primary)]">{item.unit}</td>
                    <td className="py-2 text-[12px] text-[var(--color-text-primary)]">
                      {item.shift}
                    </td>
                    <td className="py-2 text-[12px] text-[var(--color-text-secondary)]">
                      {item.seatLabel || '—'}
                    </td>
                    <td className="py-2 text-[12px] text-[var(--color-text-secondary)]">
                      {item.noteSnippet || '—'}
                    </td>
                  </tr>
                ))}

                {!loading && feedItems.length === 0 && (
                  <tr className="border-t-[0.5px] border-[var(--color-border-soft)]">
                    <td
                      colSpan={6}
                      className="py-6 text-center text-[12px] text-[var(--color-text-muted)]"
                    >
                      No activity in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={feedPage <= 1} onClick={onPrevPage}>
              Previous
            </Button>
            <span className="text-[12px] text-[var(--color-text-muted)]">
              Page {feedPage} / {totalFeedPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={feedPage >= totalFeedPages}
              onClick={onNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </section>
  )
}

