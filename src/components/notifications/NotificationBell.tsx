import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, X, CheckCheck, Gift, UserPlus, Hand, Trophy, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/cn'
import type { Notification } from '../../types/database'

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)}p`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày`
  return new Date(iso).toLocaleDateString('vi-VN')
}

/**
 * Visual style per notification type — icon + color tint.
 * Falls back to neutral if type unknown.
 */
const TYPE_STYLE: Record<
  string,
  { icon: typeof Bell; bg: string; iconColor: string; accent: string }
> = {
  walk_in: {
    icon: Hand,
    bg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    accent: 'border-l-amber-400',
  },
  new_member: {
    icon: UserPlus,
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    accent: 'border-l-emerald-400',
  },
  reward_redemption: {
    icon: Gift,
    bg: 'bg-pink-50',
    iconColor: 'text-pink-600',
    accent: 'border-l-pink-400',
  },
  reward_delivered: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    accent: 'border-l-emerald-400',
  },
  reward_cancelled: {
    icon: XCircle,
    bg: 'bg-gray-50',
    iconColor: 'text-gray-500',
    accent: 'border-l-gray-300',
  },
  tournament: {
    icon: Trophy,
    bg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    accent: 'border-l-amber-400',
  },
}

const DEFAULT_STYLE = {
  icon: Bell,
  bg: 'bg-blue-50',
  iconColor: 'text-blue-600',
  accent: 'border-l-blue-400',
}

type FilterTab = 'all' | 'unread'

export function NotificationBell() {
  const { member, isAdmin } = useAuth()
  const isHost = member?.is_host ?? false
  const showBell = isAdmin || isHost

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<FilterTab>('all')

  const load = useCallback(async () => {
    if (!member || !showBell) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setItems((data ?? []) as Notification[])
    setLoading(false)
  }, [member, showBell])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  async function markAllRead() {
    const { error } = await supabase.rpc('mark_all_notifications_read')
    if (error) {
      toast.error('Lỗi: ' + error.message)
      return
    }
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  async function markOneRead(id: string) {
    // Optimistic update
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
  }

  const unreadCount = useMemo(
    () => items.filter((n) => !n.is_read).length,
    [items]
  )

  const filtered = useMemo(
    () => (tab === 'unread' ? items.filter((n) => !n.is_read) : items),
    [items, tab]
  )

  if (!showBell) return null

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Thông báo"
      >
        <Bell
          className={cn(
            'w-5 h-5 transition-transform',
            unreadCount > 0 && 'animate-wiggle'
          )}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-red-500 to-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm animate-fadeIn"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-2 top-14 z-50 w-[360px] max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slideDown">
            {/* Premium header with subtle gradient */}
            <header className="bg-gradient-to-br from-primary-50 to-white px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bell className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm text-gray-900">Thông báo</h3>
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-primary font-semibold flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
                      title="Đánh dấu đã đọc tất cả"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Đọc hết
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex gap-1 -mx-1 px-1">
                <button
                  onClick={() => setTab('all')}
                  className={cn(
                    'px-3 py-1 rounded-full text-[11px] font-semibold transition-all',
                    tab === 'all'
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  )}
                >
                  Tất cả {items.length > 0 && <span className="opacity-70">· {items.length}</span>}
                </button>
                <button
                  onClick={() => setTab('unread')}
                  className={cn(
                    'px-3 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1',
                    tab === 'unread'
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  )}
                >
                  Chưa đọc
                  {unreadCount > 0 && (
                    <span
                      className={cn(
                        'inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold',
                        tab === 'unread'
                          ? 'bg-white/30 text-white'
                          : 'bg-red-500 text-white'
                      )}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </header>

            <div className="max-h-[440px] overflow-y-auto overscroll-contain">
              {loading && items.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500">
                  <div className="w-6 h-6 mx-auto mb-2 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Đang tải...
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="px-6 py-10 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    {tab === 'unread' ? (
                      <CheckCheck className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <Bell className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-0.5">
                    {tab === 'unread' ? 'Đã đọc hết' : 'Chưa có thông báo'}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {tab === 'unread'
                      ? 'Anh/chị đã xử lý xong'
                      : 'Sẽ hiển thị tại đây khi có'}
                  </p>
                </div>
              )}

              {!loading &&
                filtered.map((n) => {
                  const style = TYPE_STYLE[n.type] ?? DEFAULT_STYLE
                  const Icon = style.icon
                  const hasLink = Boolean(n.related_url)

                  const content = (
                    <>
                      <div
                        className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                          style.bg
                        )}
                      >
                        <Icon className={cn('w-4 h-4', style.iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'text-sm leading-tight flex-1',
                              !n.is_read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5 shadow-sm" />
                          )}
                        </div>
                        {n.body && (
                          <p
                            className={cn(
                              'text-xs mt-0.5 line-clamp-2',
                              !n.is_read ? 'text-gray-700' : 'text-gray-500'
                            )}
                          >
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                          <span>{timeAgo(n.created_at)}</span>
                          {hasLink && <span className="text-primary">· Xem →</span>}
                        </p>
                      </div>
                    </>
                  )

                  if (hasLink) {
                    return (
                      <Link
                        key={n.id}
                        to={n.related_url!}
                        onClick={() => {
                          if (!n.is_read) markOneRead(n.id)
                          setOpen(false)
                        }}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 border-l-4 border-b border-gray-50 hover:bg-gray-50/80 transition-colors',
                          !n.is_read ? style.accent : 'border-l-transparent'
                        )}
                      >
                        {content}
                      </Link>
                    )
                  }
                  return (
                    <button
                      key={n.id}
                      onClick={() => !n.is_read && markOneRead(n.id)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 border-l-4 border-b border-gray-50 hover:bg-gray-50/80 transition-colors text-left',
                        !n.is_read ? style.accent : 'border-l-transparent'
                      )}
                    >
                      {content}
                    </button>
                  )
                })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
