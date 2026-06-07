import { Shield, Award, Home } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Member } from '../../types/database'

type Props = {
  member: Pick<Member, 'is_admin' | 'is_coach' | 'is_host'>
  size?: 'sm' | 'md'
  showIcon?: boolean
  className?: string
}

const styles = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  coach: 'bg-orange-50 text-orange-700 border-orange-200',
  host: 'bg-purple-50 text-purple-700 border-purple-200',
} as const

export function RoleBadges({ member, size = 'sm', showIcon = false, className }: Props) {
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
  const iconSize = size === 'sm' ? 10 : 12

  if (!member.is_admin && !member.is_coach && !member.is_host) return null

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {member.is_admin && (
        <span className={cn('inline-flex items-center gap-1 rounded font-bold border', styles.admin, sizeClass)}>
          {showIcon && <Shield size={iconSize} />}ADMIN
        </span>
      )}
      {member.is_coach && (
        <span className={cn('inline-flex items-center gap-1 rounded font-bold border', styles.coach, sizeClass)}>
          {showIcon && <Award size={iconSize} />}COACH
        </span>
      )}
      {member.is_host && (
        <span className={cn('inline-flex items-center gap-1 rounded font-bold border', styles.host, sizeClass)}>
          {showIcon && <Home size={iconSize} />}HOST
        </span>
      )}
    </div>
  )
}
