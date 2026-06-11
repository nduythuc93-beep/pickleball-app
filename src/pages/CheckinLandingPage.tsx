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
  BellRing,
  Share2,
  UserPlus,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { isValidVnPhone, normalizePhone, PHONE_INVALID_MSG } from '../lib/phone'
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
  // Honeypot — hidden field, real users never fill it; bots scraping the
  // DOM tend to autofill all inputs they find
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkedInSessions, setCheckedInSessions] = useState<Set<string>>(new Set())
  const [checkingInSessionId, setCheckingInSessionId] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      // Format date in VN timezone — avoids off-by-one at midnight UTC
      const todayIso = new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
      })
      const in7DaysIso = new Date(Date.now() + 7 * 86400000).toLocaleDateString(
        'en-CA',
        { timeZone: 'Asia/Ho_Chi_Minh' }
      )
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
    // Honeypot trap — silently pretend success for bots that filled it
    if (honeypot.trim().length > 0) {
      setDone(true)
      return
    }
    if (!fullName.trim()) {
      toast.error('Nhập họ tên')
      return
    }
    if (!isValidVnPhone(phone)) {
      toast.error(PHONE_INVALID_MSG)
      return
    }
    setSubmitting(true)

    // Find today's social — VN timezone safe
    const todayIso = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    })
    const todaySocial = todaySessions.find(
      (s) => s.session_date === todayIso && s.activity_type === 'social'
    )

    // Only auto-create walk_in if there's a session to attach to.
    // Otherwise show done screen and let user pick a specific session
    // (avoids orphan walk_in rows with NULL session_id).
    if (todaySocial) {
      const { error } = await supabase.rpc('walk_in_checkin', {
        p_full_name: fullName.trim(),
        p_phone: normalizePhone(phone),
        p_referral_source: referral || null,
        p_session_id: todaySocial.id,
      })
      setSubmitting(false)
      if (error) {
        toast.error(friendlyError(error))
        return
      }
      setCheckedInSessions(new Set([todaySocial.id]))
    } else {
      setSubmitting(false)
    }
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
      p_phone: normalizePhone(phone),
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
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white p-6 pb-12 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-white/5 rounded-full" />
          <div className="relative text-center">
            <div className="text-5xl mb-2">{checkedInSessions.size > 0 ? '🎉' : '👋'}</div>
            <h1 className="text-2xl font-bold">
              {checkedInSessions.size > 0
                ? 'Xác nhận thành công!'
                : `Chào ${fullName}!`}
            </h1>
            <p className="text-sm opacity-95 mt-1">
              {checkedInSessions.size > 0
                ? 'Hẹn gặp anh/chị tại sân 🏓'
                : 'Chọn buổi muốn tham gia bên dưới ↓'}
            </p>
          </div>
        </div>

        {/* ============ REASSURANCE CARD ============ */}
        {checkedInSessions.size > 0 && (
          <div className="px-4 -mt-7 mb-3 relative z-10">
            <div className="bg-white rounded-2xl shadow-xl p-4 border border-emerald-100">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <BellRing className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    Host &amp; Admin đã nhận thông tin
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    CLB đã ghi nhận, hẹn gặp anh/chị tại sân
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tên</span>
                  <span className="font-semibold text-gray-900">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SĐT</span>
                  <span className="font-semibold text-gray-900">{phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Thời gian</span>
                  <span className="font-semibold text-gray-900">
                    {new Date().toLocaleString('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ SESSION DETAIL — "Hẹn anh/chị tại" ============ */}
        {checkedInSessions.size > 0 && (() => {
          const firstId = Array.from(checkedInSessions)[0]
          const sess = todaySessions.find((s) => s.id === firstId)
          if (!sess) return null
          const at = activityTypes.find((a) => a.key === sess.activity_type)
          const style = ACTIVITY_STYLE[sess.activity_type]
          return (
            <div className="px-4 mb-3">
              <div
                className={cn(
                  'rounded-2xl p-4 text-white shadow-lg relative overflow-hidden',
                  style.gradient
                )}
              >
                <Trophy className="absolute -right-5 -top-5 w-28 h-28 opacity-10 rotate-12" />
                <div className="relative">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-90 mb-1.5">
                    📅 Hẹn anh/chị tại
                  </p>
                  <h3 className="text-xl font-bold leading-tight">{at?.label}</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/15 backdrop-blur rounded-lg p-2.5">
                      <div className="opacity-80 text-[10px] uppercase font-semibold tracking-wide">
                        Thời gian
                      </div>
                      <div className="font-bold mt-0.5 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(sess.start_time)} - {formatTime(sess.end_time)}
                      </div>
                      <div className="text-[10px] opacity-90 mt-0.5">
                        {formatDateShort(sess.session_date)}
                      </div>
                    </div>
                    <div className="bg-white/15 backdrop-blur rounded-lg p-2.5">
                      <div className="opacity-80 text-[10px] uppercase font-semibold tracking-wide">
                        Địa điểm
                      </div>
                      <div className="font-bold mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {sess.venue}
                      </div>
                      <div className="text-[10px] opacity-90 mt-0.5">
                        Phí {formatVnd(sess.price_vnd)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 bg-white/15 backdrop-blur rounded-lg p-2.5 text-xs flex items-start gap-2">
                    <span className="text-base">💡</span>
                    <span className="leading-relaxed">
                      <strong>Đến sớm 5-10 phút</strong> để Host nhận diện và sắp xếp sân
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ============ INVITE FRIEND ============ */}
        {checkedInSessions.size > 0 && (
          <InviteFriend
            sessionLabel={(() => {
              const firstId = Array.from(checkedInSessions)[0]
              const sess = todaySessions.find((s) => s.id === firstId)
              const at = activityTypes.find((a) => a.key === sess?.activity_type)
              if (!sess || !at) return ''
              return `${at.label} · ${formatDateShort(sess.session_date)} ${formatTime(sess.start_time)}-${formatTime(sess.end_time)} · ${sess.venue}`
            })()}
          />
        )}

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
              {/* Honeypot — invisible to humans, bots will fill */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '-10000px',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden',
                }}
              >
                <label htmlFor="company-website">
                  Website (do not fill)
                </label>
                <input
                  id="company-website"
                  name="company-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

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
                placeholder="0901234567 (10 số)"
                required
                inputMode="tel"
                maxLength={13}
                pattern="0\d{9}"
                title="10 số bắt đầu bằng 0"
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
              <p className="text-[10px] text-center text-gray-500 leading-relaxed mt-2">
                Bằng việc xác nhận, anh/chị đồng ý với{' '}
                <Link to="/terms" className="text-primary underline">
                  Điều khoản
                </Link>{' '}
                và{' '}
                <Link to="/privacy" className="text-primary underline">
                  Chính sách Bảo mật
                </Link>
              </p>
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
          <img
            src="/icon-192.png"
            alt="8FM Pickleball"
            className="w-24 h-24 mx-auto mb-3 rounded-full shadow-lg ring-4 ring-white object-cover"
          />
          <h1 className="text-2xl font-bold text-gray-900">8FM Pickleball</h1>
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

/**
 * Invite a friend to join the social session.
 * Uses Web Share API on mobile (Zalo, Messenger, etc.) with copy-link fallback.
 */
function InviteFriend({ sessionLabel }: { sessionLabel: string }) {
  const checkinUrl = `${window.location.origin}/checkin`
  const shareText = sessionLabel
    ? `Tới chơi Pickleball với mình tại 8FM CLB!\n📅 ${sessionLabel}\n\nQuét QR check-in 15 giây → ${checkinUrl}`
    : `Tới chơi Pickleball với mình tại 8FM CLB! Quét QR check-in 15 giây → ${checkinUrl}`

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function handleShare() {
    if (canNativeShare) {
      try {
        await navigator.share({
          title: '8FM Pickleball — Cùng đi đánh nhé!',
          text: shareText,
          url: checkinUrl,
        })
      } catch {
        // user cancelled — silent
      }
    } else {
      handleCopy()
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText)
      toast.success('Đã copy lời mời 📋')
    } catch {
      toast.error('Không copy được, anh/chị copy thủ công nhé')
    }
  }

  return (
    <div className="px-4 mb-3">
      <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 border border-purple-100 rounded-2xl p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Mời bạn cùng đi</p>
            <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
              Đánh đôi vui hơn — share link cho bạn để cùng đến sân
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform"
          >
            <Share2 className="w-4 h-4" />
            {canNativeShare ? 'Chia sẻ' : 'Copy lời mời'}
          </button>
          {canNativeShare && (
            <button
              onClick={handleCopy}
              className="px-3 bg-white text-purple-700 border border-purple-200 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
              aria-label="Copy link"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
