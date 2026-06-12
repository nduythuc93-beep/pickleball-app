import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Database,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { cn } from '../../lib/cn'
import { Modal } from '../ui/Modal'
import { MemberAvatar } from '../members/MemberAvatar'
import type { Member } from '../../types/database'

type DbStats = {
  members_total: number
  members_active: number
  members_inactive: number
  members_deletion_pending: number
  members_no_auth_link: number
  sessions_total: number
  sessions_upcoming: number
  sessions_past: number
  checkins_total: number
  checkins_warned: number
  walkins_total: number
  walkins_orphan: number
  walkins_converted: number
  rewards_active: number
  redemptions_pending: number
  redemptions_cancelled_old: number
  tournaments_active: number
  registrations_withdrawn_old: number
  surveys_open: number
  survey_responses_total: number
  notifications_total: number
  notifications_unread: number
  notifications_old_read: number
  rate_limits_total: number
  rate_limits_expired: number
  opt_outs_past: number
  generated_at: string
}

type CleanupResult = {
  notifications_deleted: number
  orphan_walkins_deleted: number
  cancelled_redemptions_deleted: number
  withdrawn_registrations_deleted: number
  expired_rate_limits_deleted: number
  past_opt_outs_deleted: number
  total_deleted: number
}

export function DataHygieneAdminTab() {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [lastCleanup, setLastCleanup] = useState<CleanupResult | null>(null)

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    const { data, error } = await supabase.rpc('get_db_stats')
    if (error) {
      toast.error(friendlyError(error))
    } else {
      setStats(data as DbStats)
    }
    setLoadingStats(false)
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  async function runCleanup() {
    if (!confirm('Dọn dẹp dữ liệu dư thừa? Hành động này không thể hoàn tác.')) return
    setCleaning(true)
    const { data, error } = await supabase.rpc('cleanup_excess_data')
    setCleaning(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    const result = data as CleanupResult
    setLastCleanup(result)
    toast.success(`Đã dọn ${result.total_deleted} row dữ liệu cũ`)
    loadStats()
  }

  return (
    <div>
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">Dữ liệu &amp; Vệ sinh</h2>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
              Thống kê DB, dọn dữ liệu dư thừa, xoá vĩnh viễn thành viên.
            </p>
          </div>
          <button
            onClick={loadStats}
            disabled={loadingStats}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 text-gray-600', loadingStats && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats overview */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Thống kê tổng quan
          </h3>
        </div>

        {loadingStats || !stats ? (
          <div className="text-center text-gray-500 text-sm py-6">Đang tải...</div>
        ) : (
          <div className="space-y-2">
            <StatGroup title="Thành viên" icon="👥">
              <StatItem label="Đang hoạt động" value={stats.members_active} />
              <StatItem label="Đã tắt" value={stats.members_inactive} muted />
              <StatItem
                label="Chờ xoá (grace 30d)"
                value={stats.members_deletion_pending}
                warn={stats.members_deletion_pending > 0}
              />
              <StatItem
                label="Chưa link auth"
                value={stats.members_no_auth_link}
                warn={stats.members_no_auth_link > 0}
              />
            </StatGroup>

            <StatGroup title="Buổi đánh" icon="🏓">
              <StatItem label="Sắp tới" value={stats.sessions_upcoming} />
              <StatItem label="Đã qua" value={stats.sessions_past} muted />
              <StatItem label="Tổng check-in" value={stats.checkins_total} />
              <StatItem
                label="Đã cảnh cáo"
                value={stats.checkins_warned}
                warn={stats.checkins_warned > 0}
              />
            </StatGroup>

            <StatGroup title="Vãng lai" icon="👋">
              <StatItem label="Tổng" value={stats.walkins_total} />
              <StatItem label="Đã thành member" value={stats.walkins_converted} />
              <StatItem
                label="Orphan (> 7d, NULL session)"
                value={stats.walkins_orphan}
                warn={stats.walkins_orphan > 0}
              />
            </StatGroup>

            <StatGroup title="Đổi quà" icon="🎁">
              <StatItem
                label="Chờ giao"
                value={stats.redemptions_pending}
                warn={stats.redemptions_pending > 0}
              />
              <StatItem
                label="Huỷ > 90d"
                value={stats.redemptions_cancelled_old}
                warn={stats.redemptions_cancelled_old > 0}
              />
            </StatGroup>

            <StatGroup title="Hệ thống" icon="⚙️">
              <StatItem label="Notification tổng" value={stats.notifications_total} />
              <StatItem
                label="Đã đọc > 30d"
                value={stats.notifications_old_read}
                warn={stats.notifications_old_read > 0}
              />
              <StatItem label="Rate limit hiện tại" value={stats.rate_limits_total} />
              <StatItem
                label="Rate limit hết hạn"
                value={stats.rate_limits_expired}
                warn={stats.rate_limits_expired > 0}
              />
              <StatItem
                label="Opt-out buổi cũ"
                value={stats.opt_outs_past}
                warn={stats.opt_outs_past > 0}
              />
            </StatGroup>

            <p className="text-[10px] text-gray-400 text-center pt-2">
              Cập nhật: {new Date(stats.generated_at).toLocaleString('vi-VN')}
            </p>
          </div>
        )}
      </div>

      {/* Cleanup section */}
      {stats && (
        <div className="px-4 pb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-900">Dọn dẹp dữ liệu</h3>
            </div>
            <p className="text-xs text-amber-800 mb-3 leading-relaxed">
              Xoá data dư thừa: notification cũ, walk-in mồ côi, redemption huỷ cũ,
              registration withdraw cũ, rate limit hết hạn, opt-out buổi cũ.
            </p>

            <CleanupTargets stats={stats} />

            <button
              onClick={runCleanup}
              disabled={cleaning}
              className="w-full mt-3 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {cleaning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang dọn...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Dọn dẹp dữ liệu
                </>
              )}
            </button>

            {lastCleanup && (
              <div className="mt-3 pt-3 border-t border-amber-200 text-[11px] text-amber-900">
                <p className="font-bold mb-1">✓ Lần dọn gần nhất:</p>
                <ul className="space-y-0.5 ml-2">
                  {lastCleanup.notifications_deleted > 0 && (
                    <li>• {lastCleanup.notifications_deleted} notifications</li>
                  )}
                  {lastCleanup.orphan_walkins_deleted > 0 && (
                    <li>• {lastCleanup.orphan_walkins_deleted} walk-in mồ côi</li>
                  )}
                  {lastCleanup.cancelled_redemptions_deleted > 0 && (
                    <li>• {lastCleanup.cancelled_redemptions_deleted} redemptions huỷ</li>
                  )}
                  {lastCleanup.withdrawn_registrations_deleted > 0 && (
                    <li>
                      • {lastCleanup.withdrawn_registrations_deleted} registrations withdraw
                    </li>
                  )}
                  {lastCleanup.expired_rate_limits_deleted > 0 && (
                    <li>• {lastCleanup.expired_rate_limits_deleted} rate limits</li>
                  )}
                  {lastCleanup.past_opt_outs_deleted > 0 && (
                    <li>• {lastCleanup.past_opt_outs_deleted} opt-outs</li>
                  )}
                  <li className="font-bold pt-1">
                    Tổng: {lastCleanup.total_deleted} rows
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hard delete member */}
      <div className="px-4 pb-6">
        <HardDeleteMemberSection onDeleted={loadStats} />
      </div>
    </div>
  )
}

function StatGroup({
  title,
  icon,
  children,
}: {
  title: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
          {title}
        </h4>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  )
}

function StatItem({
  label,
  value,
  muted,
  warn,
}: {
  label: string
  value: number
  muted?: boolean
  warn?: boolean
}) {
  return (
    <div className="px-3 py-1.5 flex items-center justify-between text-xs">
      <span className={cn('text-gray-600', muted && 'text-gray-400')}>{label}</span>
      <span
        className={cn(
          'font-bold tabular-nums',
          warn && value > 0 && 'text-amber-700',
          muted && 'text-gray-400',
          !muted && !warn && 'text-gray-900'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function CleanupTargets({ stats }: { stats: DbStats }) {
  const targets = [
    { label: 'Notification cũ', count: stats.notifications_old_read },
    { label: 'Walk-in mồ côi', count: stats.walkins_orphan },
    { label: 'Redemption huỷ', count: stats.redemptions_cancelled_old },
    { label: 'Registration withdraw', count: stats.registrations_withdrawn_old },
    { label: 'Rate limit hết hạn', count: stats.rate_limits_expired },
    { label: 'Opt-out buổi cũ', count: stats.opt_outs_past },
  ]
  const total = targets.reduce((s, t) => s + t.count, 0)

  if (total === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-700 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" />
        DB sạch — không có dữ liệu dư thừa để dọn
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-2 space-y-0.5">
      {targets.map(
        (t) =>
          t.count > 0 && (
            <div key={t.label} className="flex justify-between text-[11px]">
              <span className="text-gray-600">{t.label}</span>
              <span className="font-bold text-amber-700 tabular-nums">{t.count}</span>
            </div>
          )
      )}
      <div className="border-t border-gray-100 mt-1 pt-1 flex justify-between text-xs font-bold">
        <span>Tổng sẽ xoá</span>
        <span className="text-amber-700 tabular-nums">{total} rows</span>
      </div>
    </div>
  )
}

// ============================================================
// HARD DELETE MEMBER section
// ============================================================
const CONFIRM_PHRASE = 'XOÁ VĨNH VIỄN'

function HardDeleteMemberSection({ onDeleted }: { onDeleted: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Member[]>([])
  const [searching, setSearching] = useState(false)
  const [confirmMember, setConfirmMember] = useState<Member | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function search() {
    if (!query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    const q = query.trim()
    const { data } = await supabase
      .from('members')
      .select('*')
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(10)
    setResults((data ?? []) as Member[])
    setSearching(false)
  }

  async function handleDelete() {
    if (!confirmMember) return
    setDeleting(true)
    const { data, error } = await supabase.rpc('hard_delete_member', {
      p_member_id: confirmMember.id,
    })
    setDeleting(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    const result = data as { member_name?: string; deleted_checkins?: number }
    toast.success(
      `Đã xoá vĩnh viễn ${result.member_name ?? '?'} (${result.deleted_checkins ?? 0} check-ins)`,
      { duration: 5000 }
    )
    setConfirmMember(null)
    setConfirmText('')
    setQuery('')
    setResults([])
    onDeleted()
  }

  return (
    <>
      <div className="bg-white border-2 border-red-200 rounded-2xl p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <h3 className="text-sm font-bold text-red-700">Xoá vĩnh viễn thành viên</h3>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-800 leading-relaxed">
            Bypass grace period 30 ngày. Xoá ngay member + auth.users + check-ins +
            redemptions + registrations + notifications. Walk-in lịch sử chỉ
            unlink (vẫn giữ ẩn danh).
          </p>
        </div>

        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Tìm tên / email / SĐT..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
          />
        </div>
        <button
          onClick={search}
          disabled={searching || !query.trim()}
          className="w-full py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg disabled:opacity-50"
        >
          {searching ? 'Đang tìm...' : 'Tìm thành viên'}
        </button>

        {results.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {results.map((m) => (
              <button
                key={m.id}
                onClick={() => setConfirmMember(m)}
                className="w-full flex items-center gap-2.5 p-2 bg-gray-50 hover:bg-red-50 rounded-lg text-left transition-colors"
              >
                <MemberAvatar member={m} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{m.full_name}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {m.email ?? m.phone ?? 'Không có liên hệ'}
                    {!m.is_active && ' · Đã tắt'}
                  </p>
                </div>
                <Trash2 className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(confirmMember)}
        onClose={() => {
          setConfirmMember(null)
          setConfirmText('')
        }}
        title="⚠️ Xoá vĩnh viễn"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirmMember(null)
                setConfirmText('')
              }}
              disabled={deleting}
              className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg"
            >
              Huỷ
            </button>
            <button
              onClick={handleDelete}
              disabled={
                deleting || confirmText.trim().toUpperCase() !== CONFIRM_PHRASE
              }
              className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {deleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang xoá...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Xoá vĩnh viễn
                </>
              )}
            </button>
          </div>
        }
      >
        {confirmMember && (
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 leading-relaxed">
                <p className="font-bold mb-1">Hành động này KHÔNG HOÀN TÁC được.</p>
                <p>
                  Member <strong>{confirmMember.full_name}</strong> sẽ bị xoá ngay
                  lập tức cùng toàn bộ dữ liệu liên quan. Bypass grace period 30 ngày.
                </p>
              </div>
            </div>

            <div className="text-xs space-y-1 bg-gray-50 rounded-xl p-3">
              <p className="font-bold text-gray-700 mb-1">Sẽ bị xoá:</p>
              <ul className="space-y-0.5 ml-3 list-disc text-gray-600">
                <li>Member record + auth.users login</li>
                <li>Tất cả check-ins + điểm</li>
                <li>Tất cả redemptions (đã giao / chờ / huỷ)</li>
                <li>Tournament registrations</li>
                <li>Notifications</li>
              </ul>
              <p className="font-bold text-gray-700 mt-2 mb-1">Sẽ unlink:</p>
              <ul className="space-y-0.5 ml-3 list-disc text-gray-600">
                <li>Walk-in lịch sử (giữ ẩn danh cho thống kê)</li>
              </ul>
            </div>

            <div>
              <p className="text-xs text-gray-700 mb-1.5">
                Gõ <strong className="text-red-700">{CONFIRM_PHRASE}</strong> để xác nhận:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-red-300 uppercase"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
