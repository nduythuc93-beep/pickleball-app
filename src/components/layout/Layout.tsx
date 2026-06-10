import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { RouteErrorBoundary } from './RouteErrorBoundary'

export function Layout() {
  const location = useLocation()
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 max-w-md mx-auto">
      {/* Content area with extra bottom padding để buổi cuối không bị bottom nav che */}
      <main className="flex-1 overflow-y-auto pb-24">
        {/* Keyed by path so the boundary resets when user navigates after an error */}
        <RouteErrorBoundary key={location.pathname}>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <BottomNav />
    </div>
  )
}

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
