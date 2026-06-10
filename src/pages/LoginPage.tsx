import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { session, signInWithEmail, signInWithPassword, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  if (!loading && session) return <Navigate to="/home" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)

    if (forgot) {
      const { error } = await signInWithEmail(email.trim())
      setSending(false)
      if (error) {
        toast.error(error)
        return
      }
      setMagicSent(true)
      toast.success('Đã gửi link đăng nhập vào email!')
      return
    }

    if (!password) {
      setSending(false)
      toast.error('Nhập mật khẩu')
      return
    }
    const { error } = await signInWithPassword(email.trim(), password)
    setSending(false)
    if (error) {
      toast.error(error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        {/* Logo + branding */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-primary flex items-center justify-center text-4xl shadow-md">
            🏓
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pickleball CLB</h1>
          <p className="text-sm text-gray-500 mt-1">Đăng nhập để tiếp tục</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {magicSent ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-5xl">📧</div>
              <p className="text-sm text-gray-700">
                Link đăng nhập đã gửi đến<br />
                <strong>{email}</strong>
              </p>
              <p className="text-xs text-gray-500">
                Mở email và bấm vào link để đăng nhập tự động.
              </p>
              <button
                onClick={() => {
                  setMagicSent(false)
                  setForgot(false)
                }}
                className="text-xs text-primary font-semibold mt-3"
              >
                ← Quay lại
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
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
                {forgot ? 'Gửi link đăng nhập' : 'Đăng nhập'}
              </Button>

              {/* Quên password / Magic link fallback */}
              <button
                type="button"
                onClick={() => setForgot(!forgot)}
                className="w-full text-xs text-gray-500 hover:text-primary text-center mt-2"
              >
                {forgot
                  ? '← Đăng nhập bằng mật khẩu'
                  : 'Quên mật khẩu? Gửi link qua email →'}
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
