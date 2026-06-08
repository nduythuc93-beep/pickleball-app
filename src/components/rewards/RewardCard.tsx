import { Gift, Award, Lock } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Reward } from '../../types/database'

type Props = {
  reward: Reward
  memberPoints: number
  onRedeem: () => void
  disabled?: boolean
}

export function RewardCard({ reward, memberPoints, onRedeem, disabled }: Props) {
  const canAfford = memberPoints >= reward.cost_points
  const outOfStock = reward.stock !== null && reward.stock <= 0
  const blocked = !canAfford || outOfStock || disabled || !reward.is_active

  const bannerSrc = reward.image_url
    ? `${reward.image_url}${reward.image_updated_at ? `?v=${encodeURIComponent(reward.image_updated_at)}` : ''}`
    : null

  return (
    <div
      className={cn(
        'bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col',
        !reward.is_active && 'opacity-50'
      )}
    >
      {/* Image */}
      <div className="aspect-square bg-gradient-to-br from-primary-50 to-emerald-50 relative">
        {bannerSrc ? (
          <img
            src={bannerSrc}
            alt={reward.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gift className="w-12 h-12 text-primary/30" />
          </div>
        )}
        {/* Cost badge */}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-bold text-primary flex items-center gap-0.5 shadow-sm">
          <Award className="w-3 h-3" />
          {reward.cost_points}
        </div>
        {/* Stock badge */}
        {reward.stock !== null && (
          <div
            className={cn(
              'absolute top-2 left-2 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-bold',
              reward.stock > 0 ? 'bg-white/90 text-gray-700' : 'bg-red-500/90 text-white'
            )}
          >
            {reward.stock > 0 ? `Còn ${reward.stock}` : 'Hết'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm text-gray-900 leading-tight">{reward.name}</h3>
        {reward.description && (
          <p className="text-[11px] text-gray-500 line-clamp-2 mt-1 flex-1">
            {reward.description}
          </p>
        )}

        <button
          onClick={onRedeem}
          disabled={blocked}
          className={cn(
            'mt-3 w-full py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1',
            blocked
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary-600'
          )}
        >
          {outOfStock ? (
            <>
              <Lock className="w-3 h-3" /> Hết hàng
            </>
          ) : !canAfford ? (
            <>
              <Lock className="w-3 h-3" /> Thiếu {reward.cost_points - memberPoints}đ
            </>
          ) : (
            <>
              <Gift className="w-3 h-3" /> Đổi {reward.cost_points}đ
            </>
          )}
        </button>
      </div>
    </div>
  )
}
