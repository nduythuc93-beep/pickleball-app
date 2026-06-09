import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { cn } from '../lib/cn'
import type { Gender, PlayExperience } from '../types/database'

const EXPERIENCE_OPTIONS: Array<{
  key: PlayExperience
  label: string
  emoji: string
}> = [
  { key: 'beginner', label: 'Chưa biết chơi', emoji: '🌱' },
  { key: 'under_6m', label: 'Dưới 6 tháng', emoji: '🏓' },
  { key: 'over_6m', label: 'Trên 6 tháng', emoji: '🔥' },
]

export function SignupPage() {
  const { session, signUpWithPassword, loading } = useAuth()
  const navigate = useNavigate()

  // Required
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')

  // Optional (collapsible)
  const [showMore, setShowMore] = useState(false)
  const [experience, setExperience] = useState<PlayExperience>('beginner')

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<null | { needsConfirm: boolean }>(null)

  if (!loading && session) return <Navigate to="/home" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Nhập họ tên')
      return
    }
    if (!email.trim()) {
      toast.error('Nhập email')
      return
    }
    if (password.length < 6) {
      toast.error('Mật khẩu tối thiểu 6 ký tự')
      return
    }
    if (!phone.trim() || phone.trim().length < 9) {
      toast.error('Nhập số điện thoại hợp lệ')
      return
    }
    if (!gender) {
      toast.error('Chọn giới tính')
      return
    }
    setSubmitting(true)

    // 1. Tạo member record
    const { error: memErr } = await supabase.rpc('signup_member', {
      p_full_name: fullName.trim(),
      p_email: email.trim().toLowerCase(),
      p_phone: phone.trim(),
      p_experience: experience,
      p_gender: gender,
    })
    if (memErr) {
      setSubmitting(false)
      toast.error(friendlyError(memErr))
      return
    }

    // 2. Tạo auth user
    const { error, needsConfirm } = await signUpWithPassword(email.trim(), password)
    setSubmitting(false)
    if (error) {
      toast.error(error)
      return
    }
    setDone({ needsConfirm })
    if (!needsConfirm) {
      toast.success('Chào mừng đến với CLB! 🎉')
      setTimeout(() => navigate('/home'), 600)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            {done.needsConfirm ? 'Cần xác nhận email' : 'Chào mừng! 🎉'}
          </h2>
          {done.needsConfirm ? (
            <>
              <p className="text-sm text-gray-600">
                Em đã gửi link xác nhận đến <strong>{email}</strong>.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Mở email và click link để hoàn tất.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600">Đang chuyển vào app...</p>
          )}
          <Link
            to="/login"
            className="mt-6 inline-block text-xs text-primary font-semibold"
          >
            Về đăng nhập
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white p-6">
      <div className="max-w-sm w-full mx-auto">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-gray-600 mb-4 hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-5">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary flex items-center justify-center text-3xl">
              🏓
            </div>
            <h1 className="text-xl font-bold text-gray-900">Tham gia CLB</h1>
            <p className="text-xs text-gray-500 mt-1">3 bước đơn giản</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="Họ tên *"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
              autoFocus
            />
            <Input
              type="email"
              label="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@gmail.com"
              required
              autoComplete="email"
            />
            <Input
              type="tel"
              label="Số điện thoại *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              required
              inputMode="tel"
              autoComplete="tel"
              minLength={9}
            />
            <Input
              type="password"
              label="Mật khẩu *"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              required
              autoComplete="new-password"
              minLength={6}
            />

            {/* Gender — required, 2 button */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Giới tính *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={cn(
                    'py-2.5 rounded-lg border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    gender === 'male'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700'
                  )}
                >
                  <span className="text-xl">👨</span> Nam
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={cn(
                    'py-2.5 rounded-lg border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    gender === 'female'
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-gray-200 bg-white text-gray-700'
                  )}
                >
                  <span className="text-xl">👩</span> Nữ
                </button>
              </div>
            </div>

            {/* Optional fields collapsible */}
            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-primary py-2"
            >
              <span>
                {showMore ? 'Ẩn' : 'Thêm thông tin'} (tuỳ chọn)
              </span>
              {showMore ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showMore && (
              <div className="space-y-3 pt-1 border-t border-gray-100">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">
                    Bạn đã chơi Pickleball bao lâu?
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setExperience(opt.key)}
                        className={cn(
                          'py-2 px-1 rounded-lg border text-[11px] font-medium flex flex-col items-center gap-0.5',
                          experience === opt.key
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-gray-200 bg-white text-gray-700'
                        )}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        <span className="leading-tight text-center">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" loading={submitting} className="w-full !mt-4">
              Tham gia CLB
            </Button>

            <p className="text-[10px] text-center text-gray-400 leading-relaxed">
              Sau khi đăng ký, Host/Coach/Admin sẽ đánh giá trình độ của
              anh/chị sau buổi đầu tiên.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
