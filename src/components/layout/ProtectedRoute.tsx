import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'

type Props = {
  adminOnly?: boolean
}

export function ProtectedRoute({ adminOnly = false }: Props) {
  const { session, member, isAdmin, loading, signOut, refreshMember, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Logged in nhưng không có member record
  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow p-6 text-center space-y-4">
          <div>
            <h2 className="font-bold text-lg mb-2">Chưa được thêm vào CLB</h2>
            <p className="text-sm text-gray-600">
              Email <strong>{user?.email}</strong> chưa được link với thành viên nào. Liên hệ admin
              để được add, hoặc thử lại nếu admin vừa update.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={refreshMember} variant="primary" className="w-full">
              Thử lại
            </Button>
            <Button onClick={signOut} variant="secondary" className="w-full">
              Đăng xuất
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}
