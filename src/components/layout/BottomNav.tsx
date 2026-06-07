import { NavLink } from 'react-router-dom'
import { Home, Users, ClipboardList, CalendarDays, Settings } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAuth } from '../../hooks/useAuth'

const baseTabs = [
  { to: '/home', label: 'Trang chính', icon: Home },
  { to: '/members', label: 'Thành viên', icon: Users },
  { to: '/surveys', label: 'Khảo sát', icon: ClipboardList },
  { to: '/events', label: 'Sự kiện', icon: CalendarDays },
]

export function BottomNav() {
  const { isAdmin } = useAuth()
  const tabs = isAdmin
    ? [...baseTabs, { to: '/admin', label: 'Admin', icon: Settings }]
    : baseTabs

  return (
    <nav
      className={cn(
        'sticky bottom-0 z-10 bg-white border-t border-gray-200 grid',
        isAdmin ? 'grid-cols-5' : 'grid-cols-4'
      )}
    >
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[11px]',
              isActive ? 'text-primary' : 'text-gray-500'
            )
          }
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
