import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Gift, CheckCircle2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { RewardFormModal } from './RewardFormModal'
import { cn } from '../../lib/cn'
import type { Member, Reward, RewardRedemption } from '../../types/database'

type SubTab = 'catalog' | 'redemptions'

export function RewardsAdminTab() {
  const [subTab, setSubTab] = useState<SubTab>('catalog')
  const [pendingCount, setPendingCount] = useState(0)

  // Pull pending count to badge the "Đổi quà" tab — host/admin see at a glance
  // how many redemptions are waiting for them
  useEffect(() => {
    let mounted = true
    async function loadPendingCount() {
      const { count } = await supabase
        .from('reward_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (!mounted) return
      setPendingCount(count ?? 0)
    }
    loadPendingCount()
    return () => {
      mounted = false
    }
  }, [subTab])

  return (
    <div>
      <div className="px-4 pt-3 pb-3 bg-white border-b border-gray-100">
        <div className="bg-gray-100 p-0.5 rounded-lg grid grid-cols-2 gap-0.5">
          <button
            onClick={() => setSubTab('catalog')}
            className={cn(
              'py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1',
              subTab === 'catalog' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            )}
          >
            <Gift className="w-3 h-3" />
            Catalog
          </button>
          <button
            onClick={() => setSubTab('redemptions')}
            className={cn(
              'py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1 relative',
              subTab === 'redemptions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            )}
          >
            <CheckCircle2 className="w-3 h-3" />
            Đổi quà
            {pendingCount > 0 && (
              <span
                className={cn(
                  'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ml-0.5',
                  'bg-amber-500 text-white animate-pulse'
                )}
              >
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {subTab === 'catalog' && <CatalogSubTab />}
      {subTab === 'redemptions' && <RedemptionsSubTab />}
    </div>
  )
}

function CatalogSubTab() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Reward | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .order('display_order')
      .order('cost_points')
    setRewards((data ?? []) as Reward[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function deleteReward(r: Reward) {
    if (!confirm(`Xoá quà "${r.name}"? Lưu ý: redemptions cũ vẫn giữ.`)) return
    const { error } = await supabase.from('rewards').delete().eq('id', r.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã xoá')
    load()
  }

  async function toggleActive(r: Reward) {
    const { error } = await supabase
      .from('rewards')
      .update({ is_active: !r.is_active })
      .eq('id', r.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(r.is_active ? 'Đã ẩn' : 'Đã hiện')
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
          <Plus className="w-4 h-4 mr-1" /> Thêm quà mới
        </Button>
      </div>

      <div className="p-4 space-y-2">
        {loading && <div className="text-center text-gray-500 text-sm py-4">Đang tải...</div>}
        {!loading && rewards.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">Chưa có quà nào</div>
        )}
        {!loading &&
          rewards.map((r) => (
            <div
              key={r.id}
              className={cn(
                'bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm',
                !r.is_active && 'opacity-60'
              )}
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                ) : (
                  <Gift className="w-6 h-6 text-primary/60" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{r.name}</p>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="font-bold text-primary">{r.cost_points}đ</span>
                  {r.stock !== null && <span>· Còn {r.stock}</span>}
                  {r.stock === null && <span>· ∞</span>}
                  {!r.is_active && <span className="text-amber-600">· ẨN</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setEditing(r)
                    setFormOpen(true)
                  }}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                  aria-label="Sửa"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => toggleActive(r)}
                  className={cn(
                    'p-1.5 rounded',
                    r.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                  )}
                  aria-label={r.is_active ? 'Ẩn' : 'Hiện'}
                >
                  {r.is_active ? <X className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => deleteReward(r)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  aria-label="Xoá"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
      </div>

      <RewardFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        reward={editing}
        onSaved={load}
      />
    </div>
  )
}

type RedemptionWithMember = RewardRedemption & {
  members: Pick<Member, 'id' | 'full_name' | 'avatar_url' | 'avatar_updated_at'> | null
}

function RedemptionsSubTab() {
  const { isAdmin } = useAuth()
  const [redemptions, setRedemptions] = useState<RedemptionWithMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('pending')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reward_redemptions')
      .select('*, members(id, full_name, avatar_url, avatar_updated_at)')
      .order('redeemed_at', { ascending: false })
    setRedemptions((data ?? []) as RedemptionWithMember[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function markDelivered(id: string) {
    const { error } = await supabase.rpc('mark_redemption_delivered', { p_redemption_id: id })
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã đánh dấu giao')
    load()
  }

  async function cancelRedemption(id: string, cost: number) {
    if (!confirm(`Huỷ + hoàn ${cost}đ về member?`)) return
    const { error } = await supabase.rpc('cancel_redemption', { p_redemption_id: id })
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(`Đã huỷ + hoàn ${cost}đ`)
    load()
  }

  const filtered = redemptions.filter((r) => filter === 'all' || r.status === filter)
  const counts = {
    pending: redemptions.filter((r) => r.status === 'pending').length,
    delivered: redemptions.filter((r) => r.status === 'delivered').length,
    cancelled: redemptions.filter((r) => r.status === 'cancelled').length,
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {(['pending', 'delivered', 'cancelled', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1',
                filter === s
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {s === 'pending' && `Chờ giao (${counts.pending})`}
              {s === 'delivered' && `Đã giao (${counts.delivered})`}
              {s === 'cancelled' && `Đã huỷ (${counts.cancelled})`}
              {s === 'all' && `Tất cả (${redemptions.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2">
        {loading && <div className="text-center text-gray-500 text-sm py-4">Đang tải...</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">Không có redemption</div>
        )}
        {!loading &&
          filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl p-3 space-y-2 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{r.reward_name}</p>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap',
                        r.status === 'pending' && 'bg-amber-50 text-amber-700',
                        r.status === 'delivered' && 'bg-emerald-50 text-emerald-700',
                        r.status === 'cancelled' && 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {r.status === 'pending' && 'CHỜ GIAO'}
                      {r.status === 'delivered' && 'ĐÃ GIAO'}
                      {r.status === 'cancelled' && 'ĐÃ HUỶ'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Bởi <strong>{r.members?.full_name ?? '?'}</strong> · {r.cost_points}đ
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(r.redeemed_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>

              {r.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => markDelivered(r.id)}
                    className="flex-1 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Đánh dấu đã giao
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => cancelRedemption(r.id, r.cost_points)}
                      className="py-1.5 px-3 text-xs font-medium bg-red-50 text-red-600 rounded-lg flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Huỷ + hoàn
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
