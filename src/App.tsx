import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { RouteErrorBoundary } from './components/layout/RouteErrorBoundary'

// Eager — entry points and primary destination
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'

// Lazy — secondary pages, loaded on demand
const SignupPage = lazy(() =>
  import('./pages/SignupPage').then((m) => ({ default: m.SignupPage }))
)
const CheckinLandingPage = lazy(() =>
  import('./pages/CheckinLandingPage').then((m) => ({ default: m.CheckinLandingPage }))
)
const MembersPage = lazy(() =>
  import('./pages/MembersPage').then((m) => ({ default: m.MembersPage }))
)
const MemberDetailPage = lazy(() =>
  import('./pages/MemberDetailPage').then((m) => ({ default: m.MemberDetailPage }))
)
const SurveysPage = lazy(() =>
  import('./pages/SurveysPage').then((m) => ({ default: m.SurveysPage }))
)
const SurveyDetailPage = lazy(() =>
  import('./pages/SurveyDetailPage').then((m) => ({ default: m.SurveyDetailPage }))
)
const TournamentsPage = lazy(() =>
  import('./pages/TournamentsPage').then((m) => ({ default: m.TournamentsPage }))
)
const TournamentDetailPage = lazy(() =>
  import('./pages/TournamentDetailPage').then((m) => ({ default: m.TournamentDetailPage }))
)
const EventsPage = lazy(() =>
  import('./pages/EventsPage').then((m) => ({ default: m.EventsPage }))
)
const SessionDetailPage = lazy(() =>
  import('./pages/SessionDetailPage').then((m) => ({ default: m.SessionDetailPage }))
)
const RewardsPage = lazy(() =>
  import('./pages/RewardsPage').then((m) => ({ default: m.RewardsPage }))
)
const RedemptionsPage = lazy(() =>
  import('./pages/RedemptionsPage').then((m) => ({ default: m.RedemptionsPage }))
)
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((m) => ({ default: m.AdminPage }))
)
const PrivacyPage = lazy(() =>
  import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage }))
)
const TermsPage = lazy(() =>
  import('./pages/TermsPage').then((m) => ({ default: m.TermsPage }))
)
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
)

/** Fallback shown for non-Layout public routes (login/signup/checkin) */
function PublicFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/signup"
            element={
              <RouteErrorBoundary>
                <Suspense fallback={<PublicFallback />}>
                  <SignupPage />
                </Suspense>
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/checkin"
            element={
              <RouteErrorBoundary>
                <Suspense fallback={<PublicFallback />}>
                  <CheckinLandingPage />
                </Suspense>
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/privacy"
            element={
              <RouteErrorBoundary>
                <Suspense fallback={<PublicFallback />}>
                  <PrivacyPage />
                </Suspense>
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/terms"
            element={
              <RouteErrorBoundary>
                <Suspense fallback={<PublicFallback />}>
                  <TermsPage />
                </Suspense>
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/reset-password"
            element={
              <RouteErrorBoundary>
                <Suspense fallback={<PublicFallback />}>
                  <ResetPasswordPage />
                </Suspense>
              </RouteErrorBoundary>
            }
          />

          {/* Protected — Layout has its own Suspense around <Outlet/> */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/members/:id" element={<MemberDetailPage />} />
              <Route path="/surveys" element={<SurveysPage />} />
              <Route path="/surveys/:id" element={<SurveyDetailPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
              <Route path="/sessions/:id" element={<SessionDetailPage />} />
              <Route path="/rewards" element={<RewardsPage />} />
              <Route path="/redemptions" element={<RedemptionsPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute adminOnly />}>
            <Route element={<Layout />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
