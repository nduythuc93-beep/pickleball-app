import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Award, Gift, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { RewardCard } from '../components/rewards/RewardCard'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import type { Reward } from '../types/database'

export function RewardsPage() {
  const navigate = useNavigate()
  const { member: me, refreshMember } = useAuth()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmReward, setConfirmReward] = useState<Reward | null>(null)
  const [redeeming, setRedeeming] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('cost_points', { ascending: true })
    setRewards((data ?? []) as Reward[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function onConfirmRedeem() {
    if (!confirmReward) return
    setRedeeming(true)
    const { data, error } = await supabase.rpc('redeem_reward', {
      p_reward_id: confirmReward.id,
    })
    setRedeeming(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    const remaining = (data as { remaining_points?: number } | null)?.remaining_points ?? 0
    const rewardName = confirmReward.name
    toast.success(
      `🎉 Đã đặt "${rewardName}" · còn ${remaining}đ\nAdmin/Host sẽ xác nhận giao quà tại sân`,
      { duration: 5000 }
    )
    setConfirmReward(null)
    await refreshMember()
    load()
    // Redirect to history so user sees pending status
    navigate('/redemptions')
  }

  if (!me) return null
  const memberPoints = me.total_points ?? 0

  return (
    <div className="pb-6">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-primary via-primary-600 to-primary-700 text-white relative overflow-hidden">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 z-10 p-2 rounded-lg bg-white/20 backdrop-blur hover:bg-white/30"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Link
          to="/redemptions"
          className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-white/20 backdrop-blur hover:bg-white/30 flex items-center gap-1 text-xs"
        >
          <History className="w-4 h-4" />
          Lịch sử
        </Link>
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-white/5 rounded-full" />

        <div className="relative p-5 pt-14 text-center">
          <Gift className="w-10 h-10 mx-auto mb-2 opacity-90" />
          <h1 className="text-xl font-bold mb-1">Đổi quà</h1>
          <p className="text-xs opacity-90">Dùng điểm tích luỹ đổi quà từ CLB</p>

          <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
            <Award className="w-4 h-4" />
            <span className="text-2xl font-bold">{memberPoints}</span>
            <span className="text-xs opacity-90">điểm khả dụng</span>
          </div>
        </div>
      </div>

      {/* Rewards grid */}
      <div className="p-4">
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                <div className="aspect-square bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 rounded w-1/2" />
                  <div className="h-7 bg-gray-100 rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && rewards.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Chưa có phần quà nào</p>
          </div>
        )}

        {!loading && rewards.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {rewards.map((r) => (
              <RewardCard
                key={r.id}
                reward={r}
                memberPoints={memberPoints}
                onRedeem={() => setConfirmReward(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm redeem modal */}
      <Modal
        open={Boolean(confirmReward)}
        onClose={() => setConfirmReward(null)}
        title="Xác nhận đổi quà"
        footer={
          <div className="flex gap-2">
            <Button onClick={() => setConfirmReward(null)} variant="secondary" className="flex-1">
              Huỷ
            </Button>
            <Button onClick={onConfirmRedeem} loading={redeeming} className="flex-1">
              Đổi {confirmReward?.cost_points}đ
            </Button>
          </div>
        }
      >
        {confirmReward && (
          <div className="text-center space-y-3 py-2">
            <div className="w-24 h-24 mx-auto bg-primary/10 rounded-2xl overflow-hidden flex items-center justify-center">
              {confirmReward.image_url ? (
                <img
                  src={confirmReward.image_url}
                  alt={confirmReward.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Gift className="w-10 h-10 text-primary/60" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">{confirmReward.name}</h3>
              {confirmReward.description && (
                <p className="text-xs text-gray-500 mt-1">{confirmReward.description}</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-left space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Điểm hiện có:</span>
                <span className="font-semibold">{memberPoints}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Chi phí:</span>
                <span className="font-semibold text-red-600">-{confirmReward.cost_points}đ</span>
              </div>
              <div className="border-t border-gray-200 pt-1 flex justify-between">
                <span className="text-gray-700 font-semibold">Còn lại:</span>
                <span className="font-bold text-primary">
                  {memberPoints - confirmReward.cost_points}đ
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">
              💡 Sau khi đổi, anh/chị liên hệ admin để nhận quà tại sân.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
