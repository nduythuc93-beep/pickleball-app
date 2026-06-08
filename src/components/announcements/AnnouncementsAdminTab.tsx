import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Pin, PinOff, Megaphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { cn } from '../../lib/cn'
import type { Announcement } from '../../types/database'

export function AnnouncementsAdminTab() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setItems((data ?? []) as Announcement[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function togglePinned(a: Announcement) {
    const { error } = await supabase
      .from('announcements')
      .update({ is_pinned: !a.is_pinned })
      .eq('id', a.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(a.is_pinned ? 'Đã bỏ ghim' : 'Đã ghim')
    load()
  }

  async function toggleActive(a: Announcement) {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !a.is_active })
      .eq('id', a.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(a.is_active ? 'Đã ẩn' : 'Đã hiện')
    load()
  }

  async function deleteOne(a: Announcement) {
    if (!confirm(`Xoá thông báo "${a.title}"?`)) return
    const { error } = await supabase.from('announcements').delete().eq('id', a.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã xoá')
    load()
  }

  return (
    <div>
      <div className="p-4 bg-white border-b border-gray-100">
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-1" /> Tạo thông báo mới
        </Button>
      </div>

      <div className="p-4 space-y-2">
        {loading && <div className="text-center text-gray-500 text-sm py-4">Đang tải...</div>}
        {!loading && items.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            <Megaphone className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            Chưa có thông báo nào
          </div>
        )}
        {!loading &&
          items.map((a) => (
            <div
              key={a.id}
              className={cn(
                'bg-white rounded-xl p-3 shadow-sm border-l-4',
                a.is_pinned ? 'border-amber-500' : a.is_active ? 'border-blue-500' : 'border-gray-300 opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {a.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                  <h3 className="font-bold text-sm truncate">{a.title}</h3>
                  {!a.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold">
                      ẨN
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2 mb-2 whitespace-pre-wrap">
                {a.body}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400">
                  {new Date(a.created_at).toLocaleString('vi-VN')}
                  {a.posted_by_name && ` · ${a.posted_by_name}`}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => togglePinned(a)}
                    className={cn(
                      'p-1.5 rounded',
                      a.is_pinned ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
                    )}
                    title={a.is_pinned ? 'Bỏ ghim' : 'Ghim'}
                  >
                    {a.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(a)
                      setFormOpen(true)
                    }}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(a)}
                    className="p-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded"
                  >
                    {a.is_active ? 'Ẩn' : 'Hiện'}
                  </button>
                  <button
                    onClick={() => deleteOne(a)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      <AnnouncementFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        announcement={editing}
        onSaved={load}
      />
    </div>
  )
}

function AnnouncementFormModal({
  open,
  onClose,
  announcement,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  announcement: Announcement | null
  onSaved: () => void
}) {
  const { user, member } = useAuth()
  const isEdit = Boolean(announcement)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (announcement) {
      setTitle(announcement.title)
      setBody(announcement.body)
      setIsPinned(announcement.is_pinned)
      setExpiresAt(announcement.expires_at ? announcement.expires_at.slice(0, 16) : '')
    } else {
      setTitle('')
      setBody('')
      setIsPinned(false)
      setExpiresAt('')
    }
  }, [open, announcement])

  async function onSubmit() {
    if (!title.trim() || !body.trim()) {
      toast.error('Nhập tiêu đề + nội dung')
      return
    }
    setSaving(true)
    const payload = {
      title: title.trim(),
      body: body.trim(),
      is_pinned: isPinned,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    }
    let error
    if (isEdit && announcement) {
      ;({ error } = await supabase.from('announcements').update(payload).eq('id', announcement.id))
    } else {
      ;({ error } = await supabase.from('announcements').insert({
        ...payload,
        posted_by: user?.id ?? null,
        posted_by_name: member?.full_name ?? null,
      }))
    }
    setSaving(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(isEdit ? 'Đã cập nhật' : 'Đã đăng thông báo')
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Sửa thông báo' : 'Tạo thông báo mới'}
      footer={
        <div className="flex gap-2">
          <Button onClick={onClose} variant="secondary" className="flex-1">Huỷ</Button>
          <Button onClick={onSubmit} loading={saving} className="flex-1">
            {isEdit ? 'Lưu' : 'Đăng'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input
          label="Tiêu đề *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vd: Đổi giờ T6 tuần sau"
        />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Nội dung *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Nội dung chi tiết..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>
        <Input
          label="Hết hạn (để trống = không hạn)"
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="rounded text-primary"
          />
          <Pin className="w-3.5 h-3.5 text-amber-600" />
          Ghim trên đầu (member không tắt được)
        </label>
      </div>
    </Modal>
  )
}
