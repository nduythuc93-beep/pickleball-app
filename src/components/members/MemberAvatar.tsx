import { cn } from '../../lib/cn'
import type { Member } from '../../types/database'

type Props = {
  member: Pick<Member, 'id' | 'full_name' | 'avatar_url' | 'avatar_updated_at'>
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-24 h-24 text-xl',
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const last = parts[parts.length - 1]?.[0] ?? ''
  const first = parts[0]?.[0] ?? ''
  return (first + last).toUpperCase()
}

function colorFromName(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h}, 55%, 55%)`
}

export function MemberAvatar({ member, size = 'md', className }: Props) {
  // Cache busting với avatar_updated_at
  const src = member.avatar_url
    ? `${member.avatar_url}${member.avatar_updated_at ? `?v=${encodeURIComponent(member.avatar_updated_at)}` : ''}`
    : null

  if (src) {
    return (
      <img
        src={src}
        alt={member.full_name}
        className={cn('rounded-full object-cover', sizes[size], className)}
        loading="lazy"
      />
    )
  }
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
        sizes[size],
        className
      )}
      style={{ backgroundColor: colorFromName(member.full_name) }}
    >
      {getInitials(member.full_name)}
    </div>
  )
}
