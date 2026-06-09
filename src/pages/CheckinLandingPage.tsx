import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Gift,
  Clock,
  ArrowRight,
  Lock,
  Trophy,
  Calendar,
  MapPin,
  CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import {
  ACTIVITY_STYLE,
  formatDateShort,
  formatTime,
  formatVnd,
} from '../lib/sessions'
import { cn } from '../lib/cn'
import type { ActivityType, PlaySession, Reward, Tournament } from '../types/database'

const REFERRAL_OPTIONS = [
  'Bạn giới thiệu',
  'Facebook',
  'Zalo',
  'Đi ngang sân',
  'Khác',
]

export function CheckinLandingPage() {
  const { session: authSession, loading } = useAuth()
  const [todaySessions, setTodaySessions] = useState<PlaySession[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [mode, setMode] = useState<'landing' | 'walkin'>('landing')
  const [done, setDone] = useState(false)

  // Form fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [referral, setReferral] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkedInSessions, setCheckedInSessions] = useState<Set<string>>(new Set())
  const [checkingInSessionId, setCheckingInSessionId] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const todayIso = new Date().toISOString().slice(0, 10)
      const in7DaysIso = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      const [{ data: sess }, { data: tour }, { data: at }, { data: rew }] = await Promise.all([
        supabase
          .from('play_sessions')
          .select('*')
          .gte('session_date', todayIso)
          .lte('session_date', in7DaysIso)
          .neq('status', 'cancelled')
          .order('session_date')
          .order('start_time')
          .limit(6),
        supabase
          .from('tournaments')
          .select('*')
          .in('status', ['open', 'ongoing'])
          .order('event_date', { ascending: true, nullsFirst: false })
          .limit(3),
        supabase.from('activity_types').select('*').order('display_order'),
        supabase
          .from('rewards')
          .select('*')
          .eq('is_active', true)
          .order('cost_points')
          .limit(4),
      ])
      setTodaySessions((sess ?? []) as PlaySession[])
      setTournaments((tour ?? []) as Tournament[])
      setActivityTypes((at ?? []) as ActivityType[])
      setRewards((rew ?? []) as Reward[])
    }
    loadData()
  }, [])

  if (!loading && authSession) {
    return <Navigate to="/home" replace />
  }

  async function onWalkInSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Nhập họ tên')
      return
    }
    if (!phone.trim() || phone.trim().length < 9) {
      toast.error('Nhập SĐT hợp lệ')
      return
    }
    setSubmitting(true)
    // Lấy social session hôm nay (nếu có)
    const todayIso = new Date().toISOString().slice(0, 10)
    const todaySocial = todaySessions.find(
      (s) => s.session_date === todayIso && s.activity_type === 'social'
    )
    const { error } = await supabase.rpc('walk_in_checkin', {
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_referral_source: referral || null,
      p_session_id: todaySocial?.id ?? null,
    })
    setSubmitting(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    // Auto-track session đầu nếu attach được
    if (todaySocial) setCheckedInSessions(new Set([todaySocial.id]))
    setDone(true)
  }

  async function onCheckInSession(sessionId: string) {
    if (!fullName || !phone) {
      toast.error('Thiếu thông tin walk-in')
      return
    }
    setCheckingInSessionId(sessionId)
    const { error } = await supabase.rpc('walk_in_checkin', {
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_referral_source: referral || null,
      p_session_id: sessionId,
    })
    setCheckingInSessionId(null)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    setCheckedInSessions((prev) => new Set([...prev, sessionId]))
    toast.success('Đã check-in! 🎉')
  }

  // Done screen — visible content, locked actions
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 pb-10">
        {/* Success header with gradient */}
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white p-6 pb-10 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-white/5 rounded-full" />
          <div className="relative text-center">
            <div className="text-5xl mb-2">🎉</div>
            <h1 className="text-2xl font-bold">Đã ghi nhận tham gia!</h1>
            <p className="text-sm opacity-95 mt-1">
              Chào <strong>{fullName}</strong>, chúc đánh vui vẻ
            </p>
          </div>
        </div>

        {/* Signup CTA — chìm xuống từ header */}
        <div className="px-4 -mt-6 mb-3 relative z-10">
          <Link
            to="/signup"
            className="block bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 rounded-2xl p-4 text-white shadow-xl relative overflow-hidden"
          >
            <Gift className="absolute -right-3 -bottom-3 w-24 h-24 opacity-20" />
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-95">
                ⚡ Mở khoá đầy đủ tính năng
              </p>
              <h3 className="text-lg font-bold mt-1">Đăng ký thành viên (30 giây)</h3>
              <div className="flex flex-wrap gap-1.5 mt-2 text-xs opacity-95">
                <span className="bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">🎯 +20 điểm khởi đầu</span>
                <span className="bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">🏆 Đổi quà</span>
                <span className="bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">🎫 Đăng ký giải</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 bg-white text-purple-700 px-4 py-1.5 rounded-full text-sm font-bold shadow">
                Đăng ký ngay <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </Link>
        </div>

        {/* SỰ KIỆN SẮP TỚI */}
        <div className="px-4 mt-4">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-primary" />
            Sự kiện sắp tới
          </h2>
          {todaySessions.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center text-xs text-gray-500">
              <Calendar className="w-8 h-8 mx-auto text-gray-300 mb-1" />
              Chưa có sự kiện sắp tới
            </div>
          ) : (
            <div className="space-y-2">
              {todaySessions.slice(0, 6).map((s) => {
                const at = activityTypes.find((a) => a.key === s.activity_type)
                const style = ACTIVITY_STYLE[s.activity_type]
                const isCheckedIn = checkedInSessions.has(s.id)
                const isLoading = checkingInSessionId === s.id
                return (
                  <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-11 h-11 rounded-lg flex items-center justify-center text-xl flex-shrink-0',
                          style.iconBg
                        )}
                      >
                        {at?.icon ?? '🏓'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{at?.label}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {formatDateShort(s.session_date)} ·{' '}
                          {formatTime(s.start_time)}-{formatTime(s.end_time)}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">📍 {s.venue}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-700 flex-shrink-0">
                        {formatVnd(s.price_vnd)}
                      </span>
                    </div>

                    {isCheckedIn ? (
                      <div className="mt-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold text-center flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã check-in
                      </div>
                    ) : (
                      <button
                        onClick={() => onCheckInSession(s.id)}
                        disabled={isLoading}
                        className="mt-2 w-full py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {isLoading ? 'Đang check-in...' : 'Check-in buổi này →'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* GIẢI ĐẤU — visible content, locked action */}
        <div className="px-4 mt-5">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-500" />
            Giải đấu CLB
          </h2>
          {tournaments.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center text-xs text-gray-500">
              <Trophy className="w-8 h-8 mx-auto text-gray-300 mb-1" />
              Chưa có giải đấu sắp tới
            </div>
          ) : (
            <div className="space-y-2">
              {tournaments.slice(0, 2).map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm relative"
                >
                  {t.banner_url ? (
                    <div className="aspect-[16/9] bg-gray-100">
                      <img
                        src={t.banner_url}
                        alt={t.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                      <Trophy className="w-12 h-12 text-amber-400" />
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-bold text-sm">{t.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                      {t.event_date && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(t.event_date).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                      {t.venue && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {t.venue}
                        </span>
                      )}
                    </div>
                    <Link
                      to="/signup"
                      className="mt-2 w-full block py-2 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold text-center flex items-center justify-center gap-1 hover:bg-amber-50 hover:text-amber-700"
                    >
                      <Lock className="w-3 h-3" />
                      Đăng ký thành viên để tham gia
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QUÀ — visible với dimmed look + locked CTA */}
        <div className="px-4 mt-5">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Gift className="w-3 h-3 text-pink-500" />
            Đổi điểm nhận quà
          </h2>
          {rewards.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center text-xs text-gray-500">
              <Gift className="w-8 h-8 mx-auto text-gray-300 mb-1" />
              Chưa có quà nào
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {rewards.slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm opacity-70"
                >
                  <div className="aspect-square bg-gray-100">
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        alt={r.name}
                        className="w-full h-full object-cover grayscale"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-orange-50">
                        <Gift className="w-8 h-8 text-pink-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold truncate text-gray-800">{r.name}</p>
                    <p className="text-[10px] text-pink-600 font-bold">{r.cost_points} điểm</p>
                    <div className="mt-1.5 py-1 rounded text-[10px] font-bold text-center bg-gray-100 text-gray-500 flex items-center justify-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      Khoá
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link
            to="/signup"
            className="mt-3 block py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold text-center flex items-center justify-center gap-1.5"
          >
            <Gift className="w-3.5 h-3.5" />
            Đăng ký thành viên để đổi quà
          </Link>
        </div>

        <div className="px-4 mt-6 text-center">
          <button
            onClick={() => {
              setDone(false)
              setMode('landing')
              setFullName('')
              setPhone('')
              setReferral('')
            }}
            className="text-xs text-gray-500 underline"
          >
            ← Về trang chính
          </button>
        </div>
      </div>
    )
  }

  // Walk-in form
  if (mode === 'walkin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white p-6">
        <div className="max-w-sm w-full mx-auto">
          <button
            onClick={() => setMode('landing')}
            className="text-sm text-gray-600 mb-4 hover:text-primary"
          >
            ← Quay lại
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary flex items-center justify-center text-3xl">
                👋
              </div>
              <h1 className="text-xl font-bold">Đánh Social Vãng Lai</h1>
              <p className="text-xs text-gray-500 mt-1">
                Chỉ 2 thông tin — chưa cần tạo tài khoản
              </p>
            </div>

            <form onSubmit={onWalkInSubmit} className="space-y-3">
              <Input
                label="Họ tên *"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
                autoFocus
              />
              <Input
                type="tel"
                label="SĐT *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xxxxxxxx"
                required
                inputMode="tel"
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Bạn biết CLB qua đâu? (tuỳ chọn)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {REFERRAL_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setReferral(referral === opt ? '' : opt)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-medium ${
                        referral === opt
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" loading={submitting} className="w-full !mt-4">
                Xác nhận tham gia
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Landing — WALK-IN làm chính, signup + login secondary
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="max-w-sm w-full mx-auto py-6">
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🏓</div>
          <h1 className="text-2xl font-bold text-gray-900">CLB Pickleball</h1>
          <p className="text-sm text-gray-500 mt-1">Chào mừng anh/chị đến sân!</p>
        </div>

        {/* PRIMARY — Walk-in (LỚN NHẤT) */}
        <button
          onClick={() => setMode('walkin')}
          className="w-full block bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-xl mb-3 relative overflow-hidden hover:shadow-2xl transition-shadow"
        >
          <div className="absolute -right-4 -top-4 text-6xl opacity-20">🏓</div>
          <div className="relative text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-95">
              ⚡ Đánh ngay — không cần tạo tài khoản
            </p>
            <h2 className="text-2xl font-bold mt-1">Tham gia Vãng lai</h2>
            <p className="text-xs mt-1.5 opacity-90">
              Chỉ cần Họ tên + SĐT (15 giây)
            </p>
            <div className="mt-3 inline-flex items-center gap-1 bg-white text-emerald-700 px-4 py-2 rounded-full text-sm font-bold shadow">
              Bắt đầu <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </button>

        {/* SECONDARY — Signup */}
        <Link
          to="/signup"
          className="block bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 rounded-2xl p-4 text-white shadow-md mb-3 relative overflow-hidden"
        >
          <Gift className="absolute -right-4 -bottom-4 w-20 h-20 opacity-15" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">
              🎁 Tham gia thành viên
            </p>
            <h3 className="text-base font-bold mt-0.5">Đăng ký miễn phí</h3>
            <p className="text-[11px] mt-1 opacity-90">
              +20 điểm khởi đầu · Đổi quà · Xem giải đấu
            </p>
            <div className="mt-2 text-xs font-bold flex items-center gap-1">
              Đăng ký <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </Link>

        {/* SECONDARY — Login (smallest) */}
        <Link
          to="/login"
          className="block bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:border-primary"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Đã có tài khoản? <span className="font-bold text-primary">Đăng nhập</span>
            </p>
            <ArrowRight className="w-4 h-4 text-primary" />
          </div>
        </Link>

        {/* Today preview at bottom */}
        {todaySessions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
              Sự kiện sắp tới
            </h3>
            <div className="space-y-1.5">
              {todaySessions.slice(0, 3).map((s) => {
                const at = activityTypes.find((a) => a.key === s.activity_type)
                return (
                  <div key={s.id} className="bg-white rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
                    <span className="text-base">{at?.icon}</span>
                    <span className="flex-1 truncate">
                      <strong>{at?.label}</strong> · {formatDateShort(s.session_date)}{' '}
                      {formatTime(s.start_time)}
                    </span>
                    <span className="flex items-center gap-0.5 text-gray-500">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime(s.end_time)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
