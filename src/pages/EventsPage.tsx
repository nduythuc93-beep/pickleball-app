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

      {/* Segmented pill control */}
      <div className="bg-white px-4 pt-3 pb-3 border-b border-gray-100">
        <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 gap-1">
          <button
            onClick={() => setTab('sessions')}
            className={cn(
              'py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5',
              tab === 'sessions'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <span>🏓</span> Đánh tập
          </button>
          <button
            onClick={() => setTab('tournaments')}
            className={cn(
              'py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5',
              tab === 'tournaments'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <span>🏆</span> Giải đấu
          </button>
        </div>
      </div>

      {tab === 'sessions' && <SessionsPage />}
      {tab === 'tournaments' && <TournamentsPage />}
    </div>
  )
}
