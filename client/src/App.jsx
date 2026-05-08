import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { QuickCapture } from '@/pages/QuickCapture'
import { ProtectedRoute } from '@/components/ProtectedRoute'

const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const SeatsAdmin = lazy(() => import('@/pages/SeatsAdmin').then((m) => ({ default: m.SeatsAdmin })))

function RouteFallback() {
  return (
    <div className="min-h-svh bg-[var(--color-bg-base)]">
      <main className="mx-auto w-full max-w-[1100px] px-6 py-10 text-[13px] text-[var(--color-text-muted)]">
        Loading…
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/capture" element={<QuickCapture />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/seats"
          element={
            <ProtectedRoute>
              <SeatsAdmin />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
