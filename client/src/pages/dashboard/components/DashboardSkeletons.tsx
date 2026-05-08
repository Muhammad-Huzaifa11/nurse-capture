import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded border border-[var(--color-border-soft)] bg-[#E9EBF1] dark:bg-[#262B38]',
        'before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] before:animate-[shimmer_1.4s_infinite]',
        className
      )}
      aria-hidden
    />
  )
}

export function BarChartSkeleton() {
  return (
    <div className="h-56 w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-3">
      <div className="flex h-full items-end gap-2">
        <Skeleton className="h-[28%] w-full" />
        <Skeleton className="h-[52%] w-full" />
        <Skeleton className="h-[38%] w-full" />
        <Skeleton className="h-[68%] w-full" />
        <Skeleton className="h-[44%] w-full" />
        <Skeleton className="h-[62%] w-full" />
        <Skeleton className="h-[34%] w-full" />
        <Skeleton className="h-[56%] w-full" />
        <Skeleton className="h-[41%] w-full" />
        <Skeleton className="h-[72%] w-full" />
      </div>
    </div>
  )
}

export function LineChartSkeleton() {
  return (
    <div className="h-52 w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-3">
      <div className="flex h-full flex-col justify-end gap-2">
        <Skeleton className="h-[2px] w-full" />
        <Skeleton className="h-[2px] w-full" />
        <Skeleton className="h-[2px] w-full" />
        <div className="mt-2">
          <Skeleton className="h-8 w-full rounded-full" />
        </div>
      </div>
    </div>
  )
}

