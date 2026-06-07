import { Link } from 'react-router-dom'
import { Calendar, CheckCircle2, Clock, Lock } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Survey } from '../../types/database'

type Props = {
  survey: Survey
  responseCount?: number
  totalMembers?: number
  hasResponded?: boolean
}

const TYPE_LABELS: Record<Survey['type'], { label: string; color: string }> = {
  jersey: { label: 'Đặt áo', color: 'bg-blue-50 text-blue-700' },
  tournament: { label: 'Đăng ký giải', color: 'bg-purple-50 text-purple-700' },
  attendance: { label: 'Điểm danh', color: 'bg-orange-50 text-orange-700' },
  custom: { label: 'Khác', color: 'bg-gray-50 text-gray-700' },
}

export function SurveyCard({ survey, responseCount, totalMembers, hasResponded }: Props) {
  const typeInfo = TYPE_LABELS[survey.type]
  const closesAt = survey.closes_at ? new Date(survey.closes_at) : null
  const isClosed = !survey.is_open || (closesAt && closesAt < new Date())

  const progress =
    typeof responseCount === 'number' && typeof totalMembers === 'number' && totalMembers > 0
      ? Math.round((responseCount / totalMembers) * 100)
      : null

  return (
    <Link
      to={`/surveys/${survey.id}`}
      className="bg-white rounded-xl p-4 block hover:bg-gray-50 active:bg-gray-100 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-900 leading-tight flex-1 min-w-0">
          {survey.title}
        </h3>
        <span className={cn('text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap', typeInfo.color)}>
          {typeInfo.label}
        </span>
      </div>

      {survey.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{survey.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
        {closesAt && (
          <span className="flex items-center gap-1">
            {isClosed ? <Lock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
            {isClosed ? 'Đã đóng' : `Hạn ${closesAt.toLocaleDateString('vi-VN')}`}
          </span>
        )}
        {typeof responseCount === 'number' && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {responseCount}
            {totalMembers ? `/${totalMembers}` : ''} đã điền
          </span>
        )}
        {hasResponded && (
          <span className="flex items-center gap-1 text-primary font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Đã điền
          </span>
        )}
      </div>

      {progress !== null && (
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </Link>
  )
}
