import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { cn } from '../lib/cn'
import type { SkillLevel } from '../types/database'

const SKILLS: Array<{ key: SkillLevel; label: string; hint: string }> = [
  { key: 'A', label: 'A', hint: 'Cao cấp' },
  { key: 'B+', label: 'B+', hint: 'Trên trung bình' },
  { key: 'B-', label: 'B-', hint: 'Trung bình' },
  { key: 'C', label: 'C', hint: 'Mới chơi' },
]

export function SignupPage() {
  const { session, signUpWithPassword, signInWithEmail, loading } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [skill, setSkill] = useState<SkillLevel>('C')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<null | { mode: 'password' | 'magic'; needsConfirm: boolean }>(null)

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
    if (usePassword && password.length < 6) {
      toast.error('Password tối thiểu 6 ký tự')
      return
    }
    setSubmitting(true)

    // 1. Tạo member record trước
    const { error: memErr } = await supabase.rpc('signup_member', {
      p_full_name: fullName.trim(),
      p_email: email.trim().toLowerCase(),
      p_phone: phone.trim() || null,
      p_skill_level: skill,
    })
    if (memErr) {
      setSubmitting(false)
      toast.error(friendlyError(memErr))
      return
    }

    // 2. Tạo auth user
    if (usePassword) {
      const { error, needsConfirm } = await signUpWithPassword(email.trim(), password)
      setSubmitting(false)
      if (error) {
        toast.error(error)
        return
      }
      setDone({ mode: 'password', needsConfirm })
      if (!needsConfirm) {
        toast.success('Đăng ký thành công 🎉')
        setTimeout(() => navigate('/home'), 800)
      }
    } else {
      const { error } = await signInWithEmail(email.trim())
      setSubmitting(false)
      if (error) {
        toast.error(error)
        return
      }
      setDone({ mode: 'magic', needsConfirm: true })
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">Đã đăng ký 🎉</h2>
          {done.mode === 'magic' || done.needsConfirm ? (
            <>
              <p className="text-sm text-gray-600">
                Em đã gửi link xác nhận đến <strong>{email}</strong>.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Mở email và bấm vào link để hoàn tất.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600">Đang chuyển vào app...</p>
          )}
          <Link
            to="/login"
            className="mt-6 inline-block text-xs text-primary font-semibold"
          >
            Về trang đăng nhập
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
          Quay lại đăng nhập
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-5">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary flex items-center justify-center text-3xl">
              🏓
            </div>
            <h1 className="text-xl font-bold text-gray-900">Tham gia CLB</h1>
            <p className="text-xs text-gray-500 mt-1">
              Đăng ký nhanh — không cần admin duyệt
            </p>
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
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              autoComplete="tel"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Trình độ *
              </label>
              <div className="grid grid-cols-4 gap-1">
                {SKILLS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSkill(s.key)}
                    className={cn(
                      'py-2 rounded-lg border text-sm font-bold transition-colors',
                      skill === s.key
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-200'
                    )}
                    title={s.hint}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">
                {SKILLS.find((s) => s.key === skill)?.hint}
              </p>
            </div>

            {/* Auth method toggle */}
            <div className="pt-2 space-y-2">
              <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setUsePassword(true)}
                  className={cn(
                    'py-1.5 text-xs font-medium rounded-md transition-colors',
                    usePassword ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  )}
                >
                  🔑 Password (nhanh)
                </button>
                <button
                  type="button"
                  onClick={() => setUsePassword(false)}
                  className={cn(
                    'py-1.5 text-xs font-medium rounded-md transition-colors',
                    !usePassword ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  )}
                >
                  ✉️ Magic link
                </button>
              </div>

              {usePassword ? (
                <Input
                  type="password"
                  label="Password *"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  required
                  autoComplete="new-password"
                />
              ) : (
                <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                  Link xác nhận sẽ gửi đến email anh/chị
                </p>
              )}
            </div>

            <Button type="submit" loading={submitting} className="w-full !mt-5">
              Đăng ký
            </Button>

            <p className="text-[10px] text-center text-gray-400">
              Bằng cách đăng ký, anh/chị đồng ý tham gia cộng đồng CLB.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
