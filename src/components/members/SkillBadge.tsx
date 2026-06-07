import { cn } from '../../lib/cn'
import type { SkillLevel } from '../../types/database'

type Props = {
  level: SkillLevel
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const styles: Record<SkillLevel, string> = {
  A: 'bg-primary-50 text-primary-700 border-primary-200',
  'B+': 'bg-blue-50 text-blue-700 border-blue-200',
  'B-': 'bg-amber-50 text-amber-700 border-amber-200',
  C: 'bg-gray-100 text-gray-700 border-gray-200',
}

const sizes = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
}

export function SkillBadge({ level, size = 'md', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border',
        styles[level],
        sizes[size],
        className
      )}
    >
      {level}
    </span>
  )
}
