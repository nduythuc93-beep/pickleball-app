import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'

type Mode = 'password' | 'magic'

export function LoginPage() {
  const { session, signInWithEmail, signInWithPassword, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!loading && session) return <Navigate to="/members" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)

    if (mode === 'magic') {
      const { error } = await signInWithEmail(email.trim())
      setSending(false)
      if (error) {
        toast.error(error)
        return
      }
      setSent(true)
      toast.success('Đã gửi magic link. Check email!')
    } else {
      if (!password) {
        setSending(false)
        toast.error('Nhập password')
        return
      }
      const { error } = await signInWithPassword(email.trim(), password)
      setSending(false)
      if (error) {
        toast.error(error)
        return
      }
      // Auth state listener sẽ tự redirect
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary flex items-center justify-center">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4v8m-4-4h8" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-center text-gray-900 mb-1">Pickleball Community</h1>
        <p className="text-sm text-center text-gray-500 mb-6">Đăng nhập bằng email CLB</p>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('password')
              setSent(false)
            }}
            className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('magic')
              setSent(false)
            }}
            className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'magic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Magic link
          </button>
        </div>

        {sent && mode === 'magic' ? (
          <div className="text-center space-y-3">
            <div className="text-4xl">📧</div>
            <p className="text-sm text-gray-700">
              Magic link đã gửi đến <strong>{email}</strong>.<br />
              Mở email và bấm vào link để đăng nhập.
            </p>
            <button
              className="text-xs text-gray-500 underline mt-4"
              onClick={() => {
                setSent(false)
                setEmail('')
              }}
            >
              Đổi email khác
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="anh.email@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
            {mode === 'password' && (
              <Input
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            )}
            <Button type="submit" loading={sending} className="w-full">
              {mode === 'magic' ? 'Gửi magic link' : 'Đăng nhập'}
            </Button>
            <p className="text-xs text-center text-gray-500">
              Chỉ thành viên đã được admin add mới đăng nhập được.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
