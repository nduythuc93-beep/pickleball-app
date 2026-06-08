import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Member } from '../types/database'

type AuthContextValue = {
  session: Session | null
  user: User | null
  member: Member | null
  isAdmin: boolean
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null; needsConfirm: boolean }>
  signOut: () => Promise<void>
  refreshMember: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMember = async (userId: string) => {
    // Idempotent link phòng case trigger chưa fire
    await supabase.rpc('link_current_user_to_member')
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    const m = data as Member | null
    // Block inactive members — coi như chưa link
    if (m && !m.is_active) {
      setMember(null)
      return
    }
    setMember(m)
  }

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        await fetchMember(data.session.user.id)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        await fetchMember(newSession.user.id)
      } else {
        setMember(null)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    return { error: error?.message ?? null }
  }

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUpWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) return { error: error.message, needsConfirm: false }
    // Nếu identities rỗng → user đã tồn tại, signUp không tạo mới
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { error: 'Email này đã được đăng ký. Vui lòng đăng nhập.', needsConfirm: false }
    }
    // Nếu Supabase yêu cầu confirm email trước khi login
    const needsConfirm = !data.session
    return { error: null, needsConfirm }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshMember = async () => {
    if (session?.user) await fetchMember(session.user.id)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        member,
        isAdmin: member?.is_admin ?? false,
        loading,
        signInWithEmail,
        signInWithPassword,
        signUpWithPassword,
        signOut,
        refreshMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
