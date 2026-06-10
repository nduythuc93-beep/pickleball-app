import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Pencil, ChevronRight, Award } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { MemberAvatar } from '../components/members/MemberAvatar'
import { SkillBadge } from '../components/members/SkillBadge'
import { RoleBadges } from '../components/members/RoleBadges'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import { useAuth } from '../hooks/useAuth'
import type { Member, PlayExperience, SkillLevel } from '../types/database'
import { PLAY_EXPERIENCE_LABEL, SKILL_PRESETS } from '../types/database'

const SKILL_OPTIONS: Array<SkillLevel | 'all'> = ['all', ...SKILL_PRESETS]
type RoleFilter = 'all' | 'admin' | 'coach' | 'host'
const ROLE_OPTIONS: Array<{ key: RoleFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'admin', label: 'Admin' },
  { key: 'coach', label: 'Coach' },
  { key: 'host', label: 'Host' },
]

const EXPERIENCE_EMOJI: Record<PlayExperience, string> = {
  beginner: '🌱',
  under_6m: '🏓',
  over_6m: '🔥',
}

export function MembersPage() {
  const { member: me } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState<SkillLevel | 'all'>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [displayCount, setDisplayCount] = useState(30)
  const PAGE_SIZE = 30

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

  // Always-fresh "me" from members list (sync với DB)
  const myRecord = useMemo(
    () => members.find((m) => m.id === me?.id) ?? me,
    [members, me]
  )

  // Apply filters (skill, role, query, exclude self)
  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (m.id === me?.id) return false
      // Host/Coach skip skill filter (vì họ không hiển thị skill)
      if (
        skillFilter !== 'all' &&
        m.skill_level !== skillFilter &&
        !m.is_host &&
        !m.is_coach
      )
        return false
      if (roleFilter === 'admin' && !m.is_admin) return false
      if (roleFilter === 'coach' && !m.is_coach) return false
      if (roleFilter === 'host' && !m.is_host) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        if (!m.full_name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [members, query, skillFilter, roleFilter, me])

  // Tách Host & Coach ra section riêng, hiển thị nổi bật
  const hostsCoaches = useMemo(
    () => filtered.filter((m) => m.is_host || m.is_coach),
    [filtered]
  )
  const others = useMemo(
    () => filtered.filter((m) => !m.is_host && !m.is_coach),
    [filtered]
  )

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE)
  }, [query, skillFilter, roleFilter])

  const visibleOthers = useMemo(
    () => others.slice(0, displayCount),
    [others, displayCount]
  )
  const hiddenCount = Math.max(0, others.length - displayCount)

  return (
    <div>
      <TopBar title="Thành viên" subtitle={`${members.length} người`} />

      {/* Hero "You" card */}
      {myRecord && <HeroMyCard member={myRecord} />}

      {/* Compact filters */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm thành viên khác..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 min-h-[40px] border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider whitespace-nowrap mr-0.5">
            Skill
          </span>
          {SKILL_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSkillFilter(s)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors',
                skillFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              )}
            >
              {s === 'all' ? 'Tất cả' : s}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider whitespace-nowrap mr-0.5">
            Role
          </span>
          {ROLE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRoleFilter(key)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors',
                roleFilter === key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Host & HLV section — nổi bật */}
      {!loading && hostsCoaches.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-1.5 flex items-center gap-1.5">
            <span className="text-base">👑</span>
            <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Host & HLV ({hostsCoaches.length})
            </h2>
          </div>
          <div className="px-4 grid grid-cols-2 gap-2 pb-2">
            {hostsCoaches.map((m) => (
              <HostCoachCard key={m.id} member={m} />
            ))}
          </div>
        </>
      )}

      {/* Section header */}
      <div className="px-4 pt-4 pb-1.5">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Thành viên khác ({others.length})
        </h2>
      </div>

      {/* Compact rows */}
      <div className="px-4 space-y-1 pb-2">
        {loading && (
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-lg p-2.5 flex items-center gap-2 animate-pulse">
                <div className="w-9 h-9 bg-gray-200 rounded-full" />
                <div className="flex-1 h-3 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}
        {!loading && others.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Không có thành viên phù hợp
          </div>
        )}
        {!loading && visibleOthers.map((m) => <CompactMemberRow key={m.id} member={m} />)}
        {!loading && hiddenCount > 0 && (
          <button
            onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
            className="w-full mt-2 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"
          >
            Hiển thị thêm{' '}
            <span className="text-gray-500">
              ({Math.min(PAGE_SIZE, hiddenCount)} / còn {hiddenCount})
            </span>
          </button>
        )}
      </div>

    </div>
  )
}

function HeroMyCard({ member }: { member: Member }) {
  return (
    <div className="px-4 pt-4 pb-2">
      <Link
        to={`/members/${member.id}`}
        className="block bg-gradient-to-br from-primary via-primary-600 to-primary-700 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden hover:shadow-xl transition-shadow"
      >
        {/* decorative */}
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
              ★ Hồ sơ của bạn
            </span>
            <button className="bg-white/20 backdrop-blur p-1.5 rounded-lg hover:bg-white/30">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <MemberAvatar member={member} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold leading-tight truncate">{member.full_name}</h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <SkillBadge level={member.skill_level} size="sm" />
                <RoleBadges member={member} size="sm" />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            {member.play_experience && (
              <div className="bg-white/15 backdrop-blur rounded-lg p-2">
                <div className="text-[10px] opacity-80 uppercase font-semibold tracking-wide">
                  Kinh nghiệm
                </div>
                <div className="text-xs font-bold flex items-center gap-1 mt-0.5">
                  <span>{EXPERIENCE_EMOJI[member.play_experience]}</span>
                  <span className="truncate">{PLAY_EXPERIENCE_LABEL[member.play_experience]}</span>
                </div>
              </div>
            )}
            <div className="bg-white/15 backdrop-blur rounded-lg p-2">
              <div className="text-[10px] opacity-80 uppercase font-semibold tracking-wide">
                Điểm tích luỹ
              </div>
              <div className="text-xs font-bold flex items-center gap-1 mt-0.5">
                <Award className="w-3 h-3" />
                <span>{member.total_points ?? 0} đ</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

function CompactMemberRow({ member }: { member: Member }) {
  const hideSkill = member.is_host || member.is_coach
  return (
    <Link
      to={`/members/${member.id}`}
      className="bg-white rounded-lg p-2.5 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
    >
      <MemberAvatar member={member} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-900 truncate">{member.full_name}</span>
          <RoleBadges member={member} size="sm" />
        </div>
        {member.play_experience && (
          <div className="text-[10px] text-gray-500 flex items-center gap-0.5 mt-0.5">
            <span>{EXPERIENCE_EMOJI[member.play_experience]}</span>
            <span>{PLAY_EXPERIENCE_LABEL[member.play_experience]}</span>
            {(member.total_points ?? 0) > 0 && <span className="ml-1">· {member.total_points}đ</span>}
          </div>
        )}
      </div>
      {!hideSkill && <SkillBadge level={member.skill_level} size="sm" />}
      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
    </Link>
  )
}

function HostCoachCard({ member }: { member: Member }) {
  const role = member.is_host ? 'Host' : 'HLV'
  const roleIcon = member.is_host ? '👑' : '🎓'
  const gradient = member.is_host
    ? 'from-amber-50 to-orange-50 border-amber-200'
    : 'from-blue-50 to-cyan-50 border-blue-200'
  const roleColor = member.is_host ? 'text-amber-700' : 'text-blue-700'

  return (
    <Link
      to={`/members/${member.id}`}
      className={cn(
        'bg-gradient-to-br border rounded-2xl p-3 hover:shadow-md transition-shadow relative overflow-hidden',
        gradient
      )}
    >
      <div className="absolute -right-3 -top-3 text-3xl opacity-20">{roleIcon}</div>
      <div className="flex flex-col items-center text-center gap-1.5">
        <MemberAvatar member={member} size="md" className="ring-2 ring-white shadow-sm" />
        <div className="min-w-0 w-full">
          <p className="text-sm font-bold text-gray-900 truncate">{member.full_name}</p>
          <p className={cn('text-[10px] font-bold uppercase tracking-wider', roleColor)}>
            {roleIcon} {role}
            {member.is_host && member.is_coach && ' · HLV'}
          </p>
        </div>
        {(member.total_points ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-gray-600">
            <Award className="w-2.5 h-2.5" />
            <span className="font-semibold">{member.total_points}đ</span>
          </div>
        )}
      </div>
    </Link>
  )
}
