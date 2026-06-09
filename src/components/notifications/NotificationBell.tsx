import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, X, CheckCheck } from 'lucide-react'
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

export function NotificationBell() {
  const { member, isAdmin } = useAuth()
  const isHost = member?.is_host ?? false
  const showBell = isAdmin || isHost // chỉ admin + host có notification

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!member || !showBell) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setItems((data ?? []) as Notification[])
    setLoading(false)
  }, [member, showBell])

  useEffect(() => {
    load()
    // Poll mỗi 60s
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  // Reload khi mở dropdown
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

  if (!showBell) return null

  const unreadCount = items.filter((n) => !n.is_read).length

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        aria-label="Thông báo"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-2 top-14 z-50 w-[340px] max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">Thông báo</h3>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-primary font-semibold flex items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-100"
                    title="Đánh dấu đã đọc tất cả"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Đọc hết
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="max-h-[400px] overflow-y-auto">
              {loading && items.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-500">Đang tải...</div>
              )}
              {!loading && items.length === 0 && (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-xs text-gray-500">Chưa có thông báo</p>
                </div>
              )}
              {items.map((n) => {
                const Wrapper: typeof Link = n.related_url ? Link : ('div' as never)
                const wrapperProps = n.related_url
                  ? { to: n.related_url, onClick: () => setOpen(false) }
                  : ({} as object)
                return (
                  <Wrapper
                    key={n.id}
                    {...(wrapperProps as { to: string })}
                    className={cn(
                      'block px-4 py-3 border-b border-gray-50 hover:bg-gray-50',
                      !n.is_read && 'bg-blue-50/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-900 leading-tight flex-1">
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </Wrapper>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
