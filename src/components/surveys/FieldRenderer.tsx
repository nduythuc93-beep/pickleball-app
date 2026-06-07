import { Minus, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { FieldSchema } from '../../types/database'

type Props = {
  field: FieldSchema
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  disabled?: boolean
}

export function FieldRenderer({ field, value, onChange, error, disabled }: Props) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-800">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {field.type === 'single_select' && (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => {
            const selected = value === opt
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                onClick={() => onChange(opt)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium border transition-colors',
                  selected
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300',
                  disabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {field.type === 'number' && (
        <NumberStepper
          value={typeof value === 'number' ? value : Number(value) || 0}
          onChange={onChange}
          min={field.min}
          max={field.max}
          disabled={disabled}
        />
      )}

      {field.type === 'text' && (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:bg-gray-50"
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:bg-gray-50"
        />
      )}

      {field.type === 'yes_no' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(true)}
            className={cn(
              'py-3 rounded-lg text-sm font-medium border',
              value === true
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-gray-200',
              disabled && 'opacity-60'
            )}
          >
            ✓ Có
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(false)}
            className={cn(
              'py-3 rounded-lg text-sm font-medium border',
              value === false
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-700 border-gray-200',
              disabled && 'opacity-60'
            )}
          >
            ✕ Không
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

function NumberStepper({
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  disabled?: boolean
}) {
  const dec = () => {
    if (typeof min === 'number' && value - 1 < min) return
    onChange(value - 1)
  }
  const inc = () => {
    if (typeof max === 'number' && value + 1 > max) return
    onChange(value + 1)
  }
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || (typeof min === 'number' && value <= min)}
        className="w-11 h-11 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center disabled:opacity-40"
        aria-label="Giảm"
      >
        <Minus className="w-5 h-5" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-20 text-center px-2 py-2 min-h-[44px] border border-gray-300 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:bg-gray-50"
      />
      <button
        type="button"
        onClick={inc}
        disabled={disabled || (typeof max === 'number' && value >= max)}
        className="w-11 h-11 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center disabled:opacity-40"
        aria-label="Tăng"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  )
}
