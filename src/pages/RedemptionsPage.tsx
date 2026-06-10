import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Gift, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/cn'
import type { RewardRedemption } from '../types/database'

const STATUS_STYLE: Record<RewardRedemption['status'], { label: string; bg: string; icon: typeof Gift }> = {
  pending: { label: 'Chờ giao', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  delivered: { label: 'Đã nhận', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'Đã huỷ', bg: 'bg-gray-50 text-gray-500 border-gray-200', icon: XCircle },
}

export function RedemptionsPage() {
  const navigate = useNavigate()
  const { member: me } = useAuth()
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!me) return
      const { data } = await supabase
        .from('reward_redemptions')
        .select('*')
        .eq('member_id', me.id)
        .order('redeemed_at', { ascending: false })
      if (!mounted) return
      setRedemptions((data ?? []) as RewardRedemption[])
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [me])

  return (
    <div>
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Lịch sử đổi quà</h1>
          <p className="text-xs text-gray-500">{redemptions.length} lần đã đổi</p>
        </div>
      </header>

      <div className="p-4 space-y-2">
        {loading && <div className="text-center text-gray-500 text-sm py-8">Đang tải...</div>}

        {!loading && redemptions.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Chưa đổi quà nào</p>
          </div>
        )}

        {!loading &&
          redemptions.map((r) => {
            const style = STATUS_STYLE[r.status]
            const Icon = style.icon
            return (
              <div key={r.id} className="bg-white rounded-xl p-3 flex items-start gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-gray-900 truncate">
                      {r.reward_name}
                    </h3>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap',
                        style.bg
                      )}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {style.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                    <span>-{r.cost_points}đ</span>
                    <span>{new Date(r.redeemed_at).toLocaleString('vi-VN')}</span>
                  </div>
                  {r.status === 'pending' && (
                    <p className="text-[11px] text-amber-700 mt-1 bg-amber-50 rounded-md px-2 py-1 inline-flex items-center gap-1">
                      ⏳ Liên hệ Admin / Host tại sân để nhận
                    </p>
                  )}
                  {r.status === 'delivered' && r.delivered_at && (
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      ✓ Đã nhận lúc {new Date(r.delivered_at).toLocaleString('vi-VN')}
                    </p>
                  )}
                  {r.status === 'cancelled' && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Đã hoàn {r.cost_points}đ về điểm
                    </p>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
