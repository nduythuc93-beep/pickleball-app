import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { MemberCard } from '../components/members/MemberCard'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { Member, SkillLevel } from '../types/database'

const SKILL_OPTIONS: Array<SkillLevel | 'all'> = ['all', 'A', 'B+', 'B-', 'C']
type RoleFilter = 'all' | 'admin' | 'coach' | 'host'
const ROLE_OPTIONS: Array<{ key: RoleFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'admin', label: 'Admin' },
  { key: 'coach', label: 'Coach' },
  { key: 'host', label: 'Host' },
]

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState<SkillLevel | 'all'>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('is_active', true)
        .order('full_name', { ascending: true })
      if (!mounted) return
      if (error) {
        console.error('[members]', error)
        setMembers([])
      } else {
        setMembers((data ?? []) as Member[])
      }
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (skillFilter !== 'all' && m.skill_level !== skillFilter) return false
      if (roleFilter === 'admin' && !m.is_admin) return false
      if (roleFilter === 'coach' && !m.is_coach) return false
      if (roleFilter === 'host' && !m.is_host) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        if (!m.full_name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [members, query, skillFilter, roleFilter])

  return (
    <div>
      <TopBar title="Thành viên" subtitle={`${members.length} người`} />

      <div className="px-4 py-3 space-y-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 min-h-[40px] border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Skill filter */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
          {SKILL_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSkillFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors',
                skillFilter === s
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-200'
              )}
            >
              {s === 'all' ? 'Skill: tất cả' : `Skill ${s}`}
            </button>
          ))}
        </div>

        {/* Role filter */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
          {ROLE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRoleFilter(key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors',
                roleFilter === key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-xl p-3 flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-2 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            Không có thành viên phù hợp
          </div>
        )}
        {!loading && filtered.map((m) => <MemberCard key={m.id} member={m} />)}
      </div>
    </div>
  )
}
