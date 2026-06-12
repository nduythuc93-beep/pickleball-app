import { useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { AdminSessionsTab } from '../components/sessions/AdminSessionsTab'
import { RewardsAdminTab } from '../components/rewards/RewardsAdminTab'
import { AnnouncementsAdminTab } from '../components/announcements/AnnouncementsAdminTab'
import { AdminWalkInTab } from '../components/walkin/AdminWalkInTab'
import { MembersAdminTab } from '../components/admin/MembersAdminTab'
import { SurveysAdminTab } from '../components/admin/SurveysAdminTab'
import { TournamentsAdminTab } from '../components/admin/TournamentsAdminTab'
import { CommunityLinksAdminTab } from '../components/admin/CommunityLinksAdminTab'
import { cn } from '../lib/cn'

type Tab =
  | 'members'
  | 'surveys'
  | 'sessions'
  | 'tournaments'
  | 'rewards'
  | 'announcements'
  | 'walkin'
  | 'community'

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'announcements', label: 'Thông báo', icon: '📢' },
  { key: 'walkin', label: 'Vãng lai', icon: '👋' },
  { key: 'members', label: 'Thành viên', icon: '👥' },
  { key: 'sessions', label: 'Đánh tập', icon: '🏓' },
  { key: 'rewards', label: 'Quà', icon: '🎁' },
  { key: 'surveys', label: 'Khảo sát', icon: '📋' },
  { key: 'tournaments', label: 'Giải đấu', icon: '🏆' },
  { key: 'community', label: 'Mạng XH', icon: '🌐' },
]

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('members')

  return (
    <div>
      <TopBar title="Admin" />
      <div className="bg-white px-3 pt-3 pb-3 border-b border-gray-100">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                tab === key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'announcements' && <AnnouncementsAdminTab />}
      {tab === 'walkin' && <AdminWalkInTab />}
      {tab === 'members' && <MembersAdminTab />}
      {tab === 'sessions' && <AdminSessionsTab />}
      {tab === 'rewards' && <RewardsAdminTab />}
      {tab === 'surveys' && <SurveysAdminTab />}
      {tab === 'tournaments' && <TournamentsAdminTab />}
      {tab === 'community' && <CommunityLinksAdminTab />}
    </div>
  )
}
