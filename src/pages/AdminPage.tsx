import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, UserX, UserCheck, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { TopBar } from '../components/layout/TopBar'
import { MemberAvatar } from '../components/members/MemberAvatar'
import { SkillBadge } from '../components/members/SkillBadge'
import { RoleBadges } from '../components/members/RoleBadges'
import { MemberForm } from '../components/members/MemberForm'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { Member } from '../types/database'

type Tab = 'members' | 'surveys' | 'tournaments'
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'members', label: 'Thành viên' },
  { key: 'surveys', label: 'Khảo sát' },
  { key: 'tournaments', label: 'Giải đấu' },
]

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('members')

  return (
    <div>
      <TopBar title="Admin" />
      <nav className="bg-white border-b border-gray-200 flex">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500'
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'members' && <MembersAdminTab />}
      {tab === 'surveys' && <StubTab name="Khảo sát" />}
      {tab === 'tournaments' && <StubTab name="Giải đấu" />}
    </div>
  )
}

function StubTab({ name }: { name: string }) {
  return (
    <div className="p-6 text-center text-gray-500 text-sm">
      Quản lý {name} — sẽ build ở phase tiếp theo.
    </div>
  )
}

function MembersAdminTab() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('full_name', { ascending: true })
    if (error) {
      toast.error(error.message)
      setMembers([])
    } else {
      setMembers((data ?? []) as Member[])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (!showInactive && !m.is_active) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        return (
          m.full_name.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.phone?.includes(q)
        )
      }
      return true
    })
  }, [members, query, showInactive])

  async function toggleActive(m: Member) {
    const newState = !m.is_active
    const verb = newState ? 'kích hoạt lại' : 'tắt'
    if (!confirm(`Bạn có chắc muốn ${verb} ${m.full_name}?`)) return
    const { error } = await supabase
      .from('members')
      .update({ is_active: newState })
      .eq('id', m.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Đã ${verb}`)
    load()
  }

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(m: Member) {
    setEditing(m)
    setFormOpen(true)
  }

  const counts = useMemo(
    () => ({
      total: members.length,
      active: members.filter((m) => m.is_active).length,
      admin: members.filter((m) => m.is_admin).length,
      coach: members.filter((m) => m.is_coach).length,
      host: members.filter((m) => m.is_host).length,
    }),
    [members]
  )

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 p-4 bg-white border-b border-gray-100">
        <Stat label="Active" value={counts.active} />
        <Stat label="Admin" value={counts.admin} />
        <Stat label="Coach" value={counts.coach} />
        <Stat label="Host" value={counts.host} />
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3 bg-white border-b border-gray-100">
        <Button onClick={openAdd} className="w-full">
          <Plus className="w-4 h-4 mr-1" /> Thêm thành viên
        </Button>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên / email / phone..."
            className="w-full pl-9 pr-3 py-2 min-h-[40px] border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded text-primary focus:ring-primary"
          />
          Hiện cả thành viên đã tắt
        </label>
      </div>

      {/* List */}
      <div className="p-4 space-y-2">
        {loading && <div className="text-center text-gray-500 text-sm py-8">Đang tải...</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">Không có thành viên</div>
        )}
        {!loading &&
          filtered.map((m) => (
            <div
              key={m.id}
              className={cn(
                'bg-white rounded-xl p-3 flex items-center gap-3',
                !m.is_active && 'opacity-60'
              )}
            >
              <MemberAvatar member={m} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 truncate">{m.full_name}</span>
                  <RoleBadges member={m} />
                  {!m.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold">
                      OFF
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {m.email ?? m.phone ?? 'Chưa có liên hệ'}
                </p>
              </div>
              <SkillBadge level={m.skill_level} />
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => openEdit(m)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  aria-label="Sửa"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(m)}
                  className={cn(
                    'p-2 rounded-lg',
                    m.is_active
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-green-600 hover:bg-green-50'
                  )}
                  aria-label={m.is_active ? 'Tắt' : 'Bật'}
                >
                  {m.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
      </div>

      <MemberForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        member={editing}
        onSaved={load}
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <div className="text-lg font-bold text-primary">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}
