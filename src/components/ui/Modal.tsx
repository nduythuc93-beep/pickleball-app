import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, footer }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="overflow-y-auto p-4 flex-1">{children}</div>
        {footer && <footer className="px-4 py-3 border-t border-gray-100 flex-shrink-0">{footer}</footer>}
      </div>
    </div>
  )
}
