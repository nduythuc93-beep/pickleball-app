import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/30'
  const variants: Record<Variant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-600 active:bg-primary-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
  }
  const sizes: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-sm min-h-[44px]',
    lg: 'px-5 py-3 text-base min-h-[48px]',
  }
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Đang xử lý...
        </span>
      ) : (
        children
      )}
    </button>
  )
}
