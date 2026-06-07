import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, className, id, ...rest },
  ref
) {
  const inputId = id ?? `input-${Math.random().toString(36).slice(2, 8)}`
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-base',
          'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
          error && 'border-red-400 focus:ring-red-200 focus:border-red-500',
          className
        )}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
})
