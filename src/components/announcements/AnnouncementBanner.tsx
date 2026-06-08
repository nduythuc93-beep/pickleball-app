import { useEffect, useState } from 'react'
import { Megaphone, Pin, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import type { Announcement } from '../../types/database'

const DISMISSED_KEY = 'pb_dismissed_announcements'

function getDismissed(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function setDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)))
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissed, setDismissedState] = useState<Set<string>>(getDismissed())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true
    async function load() {
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (!mounted) return
      setAnnouncements((data ?? []) as Announcement[])
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  function onDismiss(id: string) {
    const next = new Set(dismissed)
    next.add(id)
    setDismissedState(next)
    setDismissed(next)
  }

  function toggleExpand(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const visible = announcements.filter(
    (a) => a.is_pinned || !dismissed.has(a.id)
  )

  if (visible.length === 0) return null

  return (
    <div className="px-4 pt-3 space-y-2">
      {visible.map((a) => {
        const isExpanded = expanded.has(a.id)
        const shouldTruncate = a.body.length > 120
        return (
          <div
            key={a.id}
            className={cn(
              'relative rounded-2xl p-3 border-l-4 shadow-sm',
              a.is_pinned
                ? 'bg-amber-50 border-amber-500'
                : 'bg-blue-50 border-blue-500'
            )}
          >
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  a.is_pinned ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                )}
              >
                {a.is_pinned ? <Pin className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-gray-900 leading-tight">{a.title}</h3>
                  {!a.is_pinned && (
                    <button
                      onClick={() => onDismiss(a.id)}
                      className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
                      aria-label="Ẩn"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p
                  className={cn(
                    'text-xs text-gray-700 mt-1 whitespace-pre-wrap',
                    !isExpanded && shouldTruncate && 'line-clamp-3'
                  )}
                >
                  {a.body}
                </p>
                {shouldTruncate && (
                  <button
                    onClick={() => toggleExpand(a.id)}
                    className="text-[11px] text-primary font-semibold mt-1"
                  >
                    {isExpanded ? 'Thu gọn' : 'Xem thêm →'}
                  </button>
                )}
                <p className="text-[10px] text-gray-500 mt-1.5">
                  {a.posted_by_name && <span>{a.posted_by_name} · </span>}
                  {new Date(a.created_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
