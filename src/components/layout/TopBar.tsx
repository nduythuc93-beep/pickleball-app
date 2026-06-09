import { LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { NotificationBell } from '../notifications/NotificationBell'

type Props = {
  title: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: Props) {
  const { signOut, member } = useAuth()
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1">
        {member && (
          <span className="text-sm text-gray-600 hidden sm:inline truncate max-w-[100px] mr-2">
            {member.full_name}
          </span>
        )}
        <NotificationBell />
        <button
          onClick={signOut}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          aria-label="Đăng xuất"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
