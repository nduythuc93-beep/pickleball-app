import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { session, signInWithPassword, resetPasswordForEmail, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  if (!loading && session) return <Navigate to="/home" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return
    setSending(true)

    if (forgot) {
      const { error } = await resetPasswordForEmail(cleanEmail)
      setSending(false)
      if (error) {
        toast.error(error)
        return
      }
      setResetSent(true)
      toast.success('Đã gửi link đặt lại mật khẩu vào email!')
      return
    }

    if (!password) {
      setSending(false)
      toast.error('Nhập mật khẩu')
      return
    }
    const { error } = await signInWithPassword(cleanEmail, password)
    setSending(false)
    if (error) {
      // Friendlier mapping for the common errors
      if (/invalid login credentials/i.test(error)) {
        toast.error('Email hoặc mật khẩu không đúng')
      } else if (/email not confirmed/i.test(error)) {
        toast.error('Vui lòng xác nhận email trước khi đăng nhập')
      } else {
        toast.error(error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        {/* Logo + branding */}
        <div className="text-center mb-6">
          <img
            src="/icon-192.png"
            alt="8FM Pickleball"
            className="w-20 h-20 mx-auto mb-3 rounded-full object-cover drop-shadow-md"
          />
          <h1 className="text-2xl font-bold text-gray-900">8FM Pickleball</h1>
          <p className="text-sm text-gray-500 mt-1">Đăng nhập để tiếp tục</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {resetSent ? (
            <div className="text-center py-2">
              <div className="text-5xl mb-2">📧</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                Kiểm tra email
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Em đã gửi link đặt lại mật khẩu đến{' '}
                <strong className="text-gray-900">{email}</strong>
              </p>
              <ol className="text-xs text-gray-700 mt-4 space-y-2 text-left bg-amber-50 rounded-xl p-3">
                <li className="flex gap-2">
                  <span className="font-bold text-amber-700">1.</span>
                  <span>Mở email (cả thư mục Spam nếu cần)</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-700">2.</span>
                  <span>Click link để đặt mật khẩu mới</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-700">3.</span>
                  <span>Đăng nhập với mật khẩu mới</span>
                </li>
              </ol>
              <p className="text-[11px] text-gray-500 mt-3">
                Link có hiệu lực trong 1 giờ
              </p>
              <button
                onClick={() => {
                  setResetSent(false)
                  setForgot(false)
                  setPassword('')
                }}
                className="text-xs text-primary font-semibold mt-4"
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              {forgot && (
                <p className="text-xs text-gray-600 -mb-1">
                  Nhập email tài khoản — em sẽ gửi link đặt lại mật khẩu
                </p>
              )}
              <Input
                type="email"
                label="Email"
                placeholder="email@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
              {!forgot && (
                <Input
                  type="password"
                  label="Mật khẩu"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              )}
              <Button type="submit" loading={sending} className="w-full !mt-4">
                {forgot ? 'Gửi link đặt lại mật khẩu' : 'Đăng nhập'}
              </Button>

              <button
                type="button"
                onClick={() => setForgot(!forgot)}
                className="w-full text-xs text-gray-500 hover:text-primary text-center mt-2"
              >
                {forgot
                  ? '← Đăng nhập bằng mật khẩu'
                  : 'Quên mật khẩu?'}
              </button>
            </form>
          )}
        </div>

        {/* Signup CTA */}
        <div className="text-center mt-5">
          <p className="text-sm text-gray-500 mb-1">Chưa có tài khoản?</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 text-base text-primary font-bold hover:underline"
          >
            Tham gia CLB ngay →
          </Link>
        </div>

        {/* Legal footer */}
        <div className="text-center mt-8 text-[11px] text-gray-400 space-x-3">
          <Link to="/terms" className="hover:text-primary hover:underline">
            Điều khoản
          </Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-primary hover:underline">
            Chính sách Bảo mật
          </Link>
        </div>
      </div>
    </div>
  )
}
