import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Gift, Sparkles, Clock, MapPin, ArrowRight, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { formatTime, formatVnd } from '../lib/sessions'
import type { PlaySession } from '../types/database'

const REFERRAL_OPTIONS = [
  'Bạn giới thiệu',
  'Facebook',
  'Zalo',
  'Đi ngang sân',
  'Khác',
]

export function CheckinLandingPage() {
  const { session: authSession, loading } = useAuth()
  const [todaySession, setTodaySession] = useState<PlaySession | null>(null)
  const [mode, setMode] = useState<'landing' | 'walkin'>('landing')
  const [done, setDone] = useState(false)

  // Form fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [referral, setReferral] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadTodaySession() {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('play_sessions')
        .select('*')
        .eq('session_date', today)
        .eq('activity_type', 'social')
        .neq('status', 'cancelled')
        .limit(1)
        .maybeSingle()
      setTodaySession(data as PlaySession | null)
    }
    loadTodaySession()
  }, [])

  // Nếu đã login, redirect về home
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
    const { error } = await supabase.rpc('walk_in_checkin', {
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_referral_source: referral || null,
      p_session_id: todaySession?.id ?? null,
    })
    setSubmitting(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white p-6 flex items-center">
        <div className="max-w-sm w-full mx-auto bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
            <UserCheck className="w-9 h-9 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold mb-1">Đã ghi nhận tham gia 🎉</h2>
          <p className="text-sm text-gray-600 mb-5">
            Chào <strong>{fullName}</strong>, chúc anh/chị buổi đánh vui vẻ!
          </p>

          {/* Soft sell signup */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-4 text-left mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-700 mb-2">
              ⚡ Đăng ký NGAY để nhận
            </p>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>🎁 1 chai nước miễn phí tại buổi này</li>
              <li>🎯 20 điểm thưởng khởi đầu</li>
              <li>🎾 Tích đủ 30đ = vệ sinh vợt free</li>
              <li>📅 Đặt áo CLB + đăng ký giải đấu</li>
            </ul>
          </div>

          <Link to="/signup" className="block">
            <Button className="w-full">
              Đăng ký miễn phí (30 giây) <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
          <button
            onClick={() => {
              setDone(false)
              setMode('landing')
              setFullName('')
              setPhone('')
              setReferral('')
            }}
            className="mt-3 text-xs text-gray-500 underline"
          >
            Để sau, tôi đánh xong rồi tính
          </button>
        </div>
      </div>
    )
  }

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
              <p className="text-xs text-gray-500 mt-1">Chỉ cần 2 thông tin</p>
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
                  Bạn biết CLB qua đâu? (không bắt buộc)
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

              <Link
                to="/signup"
                className="block text-center text-xs text-primary mt-2 underline"
              >
                Hoặc đăng ký để được ưu đãi hơn →
              </Link>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Landing — 3 choices
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="max-w-sm w-full mx-auto py-6">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🏓</div>
          <h1 className="text-2xl font-bold text-gray-900">CLB Pickleball</h1>
          <p className="text-sm text-gray-500 mt-1">Chào mừng anh/chị đến sân!</p>
        </div>

        {/* Today's session preview */}
        {todaySession && (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">
              ★ Hoạt động hôm nay
            </p>
            <h2 className="text-lg font-bold mt-1">🏓 Đánh Social</h2>
            <div className="flex items-center gap-3 text-xs mt-2 opacity-90">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(todaySession.start_time)}-{formatTime(todaySession.end_time)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {todaySession.venue}
              </span>
              <span className="font-bold">{formatVnd(todaySession.price_vnd)}</span>
            </div>
          </div>
        )}

        {/* Choice 1: Login */}
        <Link
          to="/login"
          className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-primary transition-colors mb-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                ✓ Tôi đã có tài khoản
              </p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                Đăng nhập + Check-in
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-primary" />
          </div>
        </Link>

        {/* Choice 2: Signup (HIGHLIGHT) */}
        <Link
          to="/signup"
          className="block bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg mb-3 relative overflow-hidden"
        >
          <Gift className="absolute -right-6 -bottom-6 w-28 h-28 opacity-15" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-95 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Khuyến mãi member
            </p>
            <h3 className="text-lg font-bold mt-1">Đăng ký miễn phí (30 giây)</h3>
            <ul className="text-xs mt-2 space-y-1 opacity-95">
              <li>🎁 Free 1 chai nước tại buổi này</li>
              <li>🎯 Tặng 20 điểm khởi đầu</li>
              <li>🎾 Tích điểm đổi quà mỗi lần đánh</li>
              <li>📅 Xem lịch đặt áo + giải CLB</li>
            </ul>
            <div className="mt-3 inline-flex items-center gap-1 bg-white/25 backdrop-blur px-3 py-1 rounded-full text-xs font-bold">
              Đăng ký ngay <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </Link>

        {/* Choice 3: Walk-in */}
        <button
          onClick={() => setMode('walkin')}
          className="block w-full bg-gray-100 rounded-2xl p-4 text-left hover:bg-gray-200 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                👋 Lần đầu đến — đánh thử
              </p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">
                Đánh vãng lai
                {todaySession && ` (${formatVnd(todaySession.price_vnd)})`}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Chỉ cần tên + SĐT
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>
      </div>
    </div>
  )
}
