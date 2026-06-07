import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 max-w-md mx-auto">
      <main className="flex-1 overflow-y-auto pb-2">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
