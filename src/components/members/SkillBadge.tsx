import { cn } from '../../lib/cn'
import type { SkillLevel } from '../../types/database'

type Props = {
  level: SkillLevel
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
}

/**
 * Map DUPR level → color.
 * - 2.0  : beginner (gray)
 * - 2.5  : novice (amber)
 * - 2.75 : intermediate (blue)
 * - 3.0+ : advanced (emerald/primary)
 * - custom: parse numeric, fallback to bucket
 */
function styleFor(level: string): string {
  const trimmed = level.trim()

  // Exact preset matches first
  if (trimmed === '2.0') return 'bg-gray-100 text-gray-700 border-gray-200'
  if (trimmed === '2.5') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (trimmed === '2.75') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (trimmed === '3.0+') return 'bg-emerald-50 text-emerald-700 border-emerald-200'

  // Custom numeric → bucket by value
  const numeric = parseFloat(trimmed.replace('+', ''))
  if (!isNaN(numeric)) {
    if (numeric < 2.5) return 'bg-gray-100 text-gray-700 border-gray-200'
    if (numeric < 2.75) return 'bg-amber-50 text-amber-700 border-amber-200'
    if (numeric < 3.0) return 'bg-blue-50 text-blue-700 border-blue-200'
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  // Legacy/unknown
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

export function SkillBadge({ level, size = 'md', className }: Props) {
  if (!level) return null
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border whitespace-nowrap',
        styleFor(level),
        sizes[size],
        className
      )}
    >
      {level}
    </span>
  )
}
