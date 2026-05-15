import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const DOTS_MIN_PX = 28

type BrandMarkProps = {
  className?: string
}

/** Waveform mark (interruption / compensation dots) — matches `pwa-source.svg`. */
export function BrandMark({ className }: BrandMarkProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [showDots, setShowDots] = useState(false)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      const size = Math.min(width, height)
      setShowDots(size >= DOTS_MIN_PX)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <svg
      ref={svgRef}
      className={cn('block', className)}
      viewBox="0 0 68 68"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <polyline
        points="4,44 16,44 22,20 30,52 38,32 44,40 52,40 64,40"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {showDots ? (
        <>
          <circle cx="30" cy="52" r="3.5" fill="#A78BFA" />
          <circle cx="38" cy="32" r="3.5" fill="#A78BFA" />
        </>
      ) : null}
    </svg>
  )
}
