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
    if (data) {
      setMember(data as Member)
      return
    }
    // Fallback: lookup theo email
    const { data: u } = await supabase.auth.getUser()
    if (u.user?.email) {
      const { data: byEmail } = await supabase
        .from('members')
        .select('*')
        .ilike('email', u.user.email)
        .maybeSingle()
      setMember((byEmail as Member) ?? null)
      return
    }
    setMember(null)
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
