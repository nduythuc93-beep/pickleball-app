import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { CheckinLandingPage } from './pages/CheckinLandingPage'
import { RewardsPage } from './pages/RewardsPage'
import { RedemptionsPage } from './pages/RedemptionsPage'
import { HomePage } from './pages/HomePage'
import { MembersPage } from './pages/MembersPage'
import { MemberDetailPage } from './pages/MemberDetailPage'
import { SurveysPage } from './pages/SurveysPage'
import { SurveyDetailPage } from './pages/SurveyDetailPage'
import { TournamentsPage } from './pages/TournamentsPage'
import { TournamentDetailPage } from './pages/TournamentDetailPage'
import { EventsPage } from './pages/EventsPage'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { AdminPage } from './pages/AdminPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/checkin" element={<CheckinLandingPage />} />
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
