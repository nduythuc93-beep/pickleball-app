import { Link } from 'react-router-dom'
import { Calendar, MapPin, Trophy, Users } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Tournament } from '../../types/database'

const STATUS_STYLE: Record<Tournament['status'], { label: string; cls: string }> = {
  draft: { label: 'Nháp', cls: 'bg-gray-100 text-gray-600' },
  open: { label: 'Đang mở đăng ký', cls: 'bg-green-50 text-green-700' },
  ongoing: { label: 'Đang diễn ra', cls: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Đã kết thúc', cls: 'bg-amber-50 text-amber-700' },
}

const FORMAT_LABEL: Record<Tournament['format'], string> = {
  round_robin: 'Round Robin',
  single_elim: 'Single Elim',
  double_elim: 'Double Elim',
  custom: 'Custom',
}

type Props = {
  tournament: Tournament
  registrationCount?: number
}

export function TournamentCard({ tournament, registrationCount }: Props) {
  const status = STATUS_STYLE[tournament.status]
  const bannerSrc = tournament.banner_url
    ? `${tournament.banner_url}${tournament.banner_updated_at ? `?v=${encodeURIComponent(tournament.banner_updated_at)}` : ''}`
    : null

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className="bg-white rounded-xl overflow-hidden block hover:bg-gray-50 active:bg-gray-100 transition-colors"
    >
      {bannerSrc && (
        <div className="aspect-[16/9] bg-gray-100">
          <img src={bannerSrc} alt={tournament.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <Trophy className="w-3 h-3" />
            <span>{FORMAT_LABEL[tournament.format]}</span>
            {tournament.skill_filter && tournament.skill_filter.length > 0 && (
              <span>· {tournament.skill_filter.join(', ')}</span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 leading-tight">{tournament.name}</h3>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap', status.cls)}>
          {status.label}
        </span>
      </div>

      {tournament.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{tournament.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
        {tournament.event_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(tournament.event_date).toLocaleDateString('vi-VN')}
          </span>
        )}
        {tournament.venue && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {tournament.venue}
          </span>
        )}
        {typeof registrationCount === 'number' && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {registrationCount}
            {tournament.max_teams ? `/${tournament.max_teams}` : ''} team
          </span>
        )}
      </div>
      </div>
    </Link>
  )
}
