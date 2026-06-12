import { useCallback, useEffect, useState } from 'react'
import { Link2, Save, ExternalLink, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { cn } from '../../lib/cn'
import type { CommunityLink } from '../../types/database'

/**
 * Admin tab to configure community social links.
 * Each platform is a pre-seeded row — admin fills URL and toggles active.
 * Only active rows with a URL appear on public surfaces.
 */
export function CommunityLinksAdminTab() {
  const [links, setLinks] = useState<CommunityLink[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('community_links')
      .select('*')
      .order('display_order')
    if (error) {
      toast.error(friendlyError(error))
      setLinks([])
    } else {
      const list = (data ?? []) as CommunityLink[]
      setLinks(list)
      // initialize drafts with current URLs
      const draftMap: Record<string, string> = {}
      for (const link of list) draftMap[link.platform] = link.url ?? ''
      setDrafts(draftMap)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save(link: CommunityLink) {
    const url = drafts[link.platform]?.trim() || null
    setSaving(link.platform)
    const { error } = await supabase
      .from('community_links')
      .update({ url, is_active: link.is_active })
      .eq('platform', link.platform)
    setSaving(null)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(`Đã lưu ${link.label}`)
    load()
  }

  async function toggleActive(link: CommunityLink) {
    const current = drafts[link.platform]?.trim()
    if (!link.is_active && !current) {
      toast.error('Nhập URL trước khi bật')
      return
    }
    setSaving(link.platform)
    const { error } = await supabase
      .from('community_links')
      .update({ is_active: !link.is_active, url: current || null })
      .eq('platform', link.platform)
    setSaving(null)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(link.is_active ? `Đã ẩn ${link.label}` : `Đã hiện ${link.label}`)
    load()
  }

  const activeCount = links.filter((l) => l.is_active && l.url).length

  return (
    <div>
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">Kênh cộng đồng</h2>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
              Cấu hình link mạng xã hội. Chỉ kênh <strong>BẬT</strong> + có
              URL mới hiển thị trên trang chính &amp; trang vãng lai.
            </p>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
              {activeCount} kênh đang hiển thị
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {loading && (
          <div className="text-center text-gray-500 text-sm py-4">Đang tải...</div>
        )}

        {!loading &&
          links.map((link) => {
            const draft = drafts[link.platform] ?? ''
            const hasChange = draft.trim() !== (link.url ?? '')
            const isSaving = saving === link.platform

            return (
              <div
                key={link.platform}
                className={cn(
                  'bg-white rounded-xl p-3 shadow-sm transition-opacity',
                  !link.is_active && 'opacity-75'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                    style={{ backgroundColor: link.brand_color }}
                  >
                    {link.label[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">
                      {link.label}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {link.url ? link.url : 'Chưa có link'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActive(link)}
                    disabled={isSaving}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors',
                      link.is_active
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}
                    aria-label={link.is_active ? 'Ẩn' : 'Hiện'}
                  >
                    {link.is_active ? (
                      <>
                        <Eye className="w-3 h-3" /> Đang hiện
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" /> Đang ẩn
                      </>
                    )}
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={draft}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [link.platform]: e.target.value })
                    }
                    placeholder={`https://${link.platform}.com/8fmpickleball`}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  {link.url && (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                      aria-label="Mở link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => save(link)}
                    disabled={!hasChange || isSaving}
                    className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isSaving ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Lưu
                  </button>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
