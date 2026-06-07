import { useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { SessionsPage } from './SessionsPage'
import { TournamentsPage } from './TournamentsPage'
import { cn } from '../lib/cn'

type Tab = 'sessions' | 'tournaments'

export function EventsPage() {
  const [tab, setTab] = useState<Tab>('sessions')

  return (
    <div>
      <TopBar title="Sự kiện" />
      <nav className="bg-white border-b border-gray-200 grid grid-cols-2">
        <button
          onClick={() => setTab('sessions')}
          className={cn(
            'py-3 text-sm font-medium border-b-2 transition-colors',
            tab === 'sessions' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
          )}
        >
          🏓 Đánh tập
        </button>
        <button
          onClick={() => setTab('tournaments')}
          className={cn(
            'py-3 text-sm font-medium border-b-2 transition-colors',
            tab === 'tournaments' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
          )}
        >
          🏆 Giải đấu
        </button>
      </nav>

      {tab === 'sessions' && <SessionsPage />}
      {tab === 'tournaments' && <TournamentsPage />}
    </div>
  )
}
