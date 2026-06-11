import { useState, useEffect, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

/**
 * Reset password landing page.
 *
 * Two entry paths:
 *  1) User clicked the email reset link → Supabase auto-establishes a
 *     session from the access_token in the URL hash. We just collect
 *     the new password.
 *  2) User logged in and wants to change password from settings → same
 *     form works (uses the existing session).
 *
 * If no session at all → show "link hết hạn" UI with a CTA to request
 * a fresh email.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { session, loading: authLoading, updatePassword } = useAuth()

  const [sessionReady, setSessionReady] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Wait for Supabase to parse access_token from URL hash and establish session
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSessionReady(Boolean(data.session))
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSessionReady(Boolean(s))
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Already done — go home (only if user is signed in normally, not after reset)
  if (done && session) return <Navigate to="/home" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới tối thiểu 6 ký tự')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Hai mật khẩu chưa khớp')
      return
    }
    setSubmitting(true)
    const { error } = await updatePassword(newPassword)
    setSubmitting(false)
    if (error) {
      toast.error(error)
      return
    }
    setDone(true)
    toast.success('Đổi mật khẩu thành công!')
    // Give the toast a moment, then route to home (user is now signed in)
    setTimeout(() => navigate('/home', { replace: true }), 800)
  }

  // === No active session AND not loading → link expired / invalid ===
  if (!authLoading && !sessionReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-7 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-9 h-9 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">Link đã hết hạn</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Link đặt lại mật khẩu chỉ có hiệu lực trong 1 giờ. Vui lòng
            yêu cầu gửi lại link mới.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-block w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-600"
          >
            Về trang đăng nhập
          </Link>
        </div>
      </div>
    )
  }

  // === Loading auth state ===
  if (authLoading || !sessionReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // === Form ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white p-6">
      <div className="max-w-sm w-full mx-auto">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-gray-600 mb-4 hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Về đăng nhập
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-5">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Đặt lại mật khẩu</h1>
            <p className="text-xs text-gray-500 mt-1">
              Nhập mật khẩu mới cho tài khoản
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                label="Mật khẩu mới"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                required
                autoComplete="new-password"
                minLength={6}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <Input
              type={showPassword ? 'text' : 'password'}
              label="Nhập lại mật khẩu mới"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Xác nhận mật khẩu"
              required
              autoComplete="new-password"
              minLength={6}
            />

            {/* Match indicator */}
            {confirmPassword.length > 0 && (
              <div
                className={`text-[11px] flex items-center gap-1 ${
                  newPassword === confirmPassword
                    ? 'text-emerald-600'
                    : 'text-red-500'
                }`}
              >
                {newPassword === confirmPassword ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Mật khẩu khớp
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    Hai mật khẩu chưa khớp
                  </>
                )}
              </div>
            )}

            <Button
              type="submit"
              loading={submitting}
              disabled={
                newPassword.length < 6 || newPassword !== confirmPassword
              }
              className="w-full !mt-4"
            >
              Cập nhật mật khẩu
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 text-[11px] text-gray-500 leading-relaxed">
            💡 Sau khi cập nhật, anh/chị sẽ được tự động đăng nhập và đưa
            về trang chính.
          </div>
        </div>

        <div className="text-center mt-6 text-[11px] text-gray-400 space-x-3">
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
