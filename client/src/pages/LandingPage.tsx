import { Link } from 'react-router-dom'
import { Activity, ArrowRight, ShieldCheck, TrendingUp } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button, Card, Eyebrow } from '@/components/system/primitives'
import { useAuth } from '@/auth/AuthContext'

const features = [
  {
    title: 'Fast capture',
    description: 'Designed for quick, low-friction event logging in real workflows.',
    icon: Activity,
  },
  {
    title: 'Anonymous by default',
    description: 'Capture meaningful operational signals without identifying people.',
    icon: ShieldCheck,
  },
  {
    title: 'Actionable insights',
    description: 'Turn daily signal patterns into decisions that reduce staff burden.',
    icon: TrendingUp,
  },
]

export function LandingPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-svh bg-[var(--color-bg-base)]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1100px] px-6 py-14 fade-in">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-5">
            <Eyebrow>Real-time workflow intelligence</Eyebrow>
            <h1 className="text-display max-w-3xl text-[var(--color-text-primary)]">
              Make invisible workload visible — without adding more work.
            </h1>
            <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
              Capture interruption and compensation signals in the moment, then help leaders act on
              what staff actually experience on the floor.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button variant="filled" size="md">
                <Link to="/capture" className="inline-flex items-center gap-2">
                  Open quick capture
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
              <Button variant="outlined" size="md">
                <Link to={isAuthenticated ? '/dashboard' : '/login'}>
                  {isAuthenticated ? 'Open dashboard' : 'Admin login'}
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-3 rounded-[var(--radius-xl)] bg-[var(--color-brand-purple-tint)] opacity-60 blur-2xl"
            />
            <div className="surface-card relative overflow-hidden rounded-[var(--radius-lg)] p-1">
              <img
                src="/heroimage.png"
                alt="Nurse documenting workflow in a clinical setting"
                className="block h-72 w-full rounded-[calc(var(--radius-lg)-4px)] object-cover sm:h-80 lg:h-[26rem]"
              />
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} raised className="p-5">
              <div className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-purple-tint)] text-[var(--color-brand-purple)]">
                <feature.icon className="size-4" strokeWidth={1.5} aria-hidden />
              </div>
              <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">
                {feature.title}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                {feature.description}
              </p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  )
}
