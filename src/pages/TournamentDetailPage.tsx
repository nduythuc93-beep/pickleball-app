import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Trophy, UserPlus, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { RegistrationForm } from '../components/tournaments/RegistrationForm'
import { MatchCard } from '../components/tournaments/MatchCard'
import {
  computeRoundRobinStandings,
  generateRoundRobin,
  generateSingleElim,
  type Team,
} from '../lib/bracket'
import { cn } from '../lib/cn'
import type {
  Member,
  Tournament,
  TournamentMatch,
  TournamentRegistration,
} from '../types/database'

type Tab = 'info' | 'register' | 'bracket'

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { member: me, isAdmin } = useAuth()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('info')
  const [regOpen, setRegOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [
      { data: t },
      { data: regs },
      { data: ms },
      { data: mems },
    ] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('tournament_registrations')
        .select('*')
        .eq('tournament_id', id)
        .order('registered_at'),
      supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', id)
        .order('round'),
      supabase.from('members').select('*').eq('is_active', true),
    ])
    setTournament(t as Tournament | null)
    setRegistrations((regs ?? []) as TournamentRegistration[])
    setMatches((ms ?? []) as TournamentMatch[])
    setMembers((mems ?? []) as Member[])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const membersById = useMemo(() => {
    const m = new Map<string, Member>()
    for (const x of members) m.set(x.id, x)
    return m
  }, [members])

  const myRegistration = useMemo(
    () => registrations.find((r) => r.member_id === me?.id && !r.is_mirror),
    [registrations, me]
  )

  const confirmedNonMirror = useMemo(
    () => registrations.filter((r) => r.status === 'confirmed' && !r.is_mirror),
    [registrations]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!tournament) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600 mb-4">Không tìm thấy giải đấu</p>
        <Link to="/tournaments" className="text-primary underline">Về danh sách</Link>
      </div>
    )
  }

  async function confirmRegistration(reg: TournamentRegistration) {
    const { error: e1 } = await supabase
      .from('tournament_registrations')
      .update({ status: 'confirmed' })
      .eq('id', reg.id)
    if (e1) {
      toast.error(friendlyError(e1))
      return
    }
    if (reg.partner_id) {
      const { error: e2 } = await supabase
        .from('tournament_registrations')
        .upsert(
          {
            tournament_id: reg.tournament_id,
            member_id: reg.partner_id,
            partner_id: reg.member_id,
            category: reg.category,
            status: 'confirmed',
            is_mirror: true,
          },
          { onConflict: 'tournament_id,member_id' }
        )
      if (e2) {
        toast.error(friendlyError(e2))
        return
      }
    }
    toast.success('Đã confirm')
    load()
  }

  async function withdrawRegistration(reg: TournamentRegistration) {
    if (!confirm('Rút đăng ký?')) return
    await supabase
      .from('tournament_registrations')
      .update({ status: 'withdrawn' })
      .eq('id', reg.id)
    if (reg.partner_id) {
      await supabase
        .from('tournament_registrations')
        .update({ status: 'withdrawn' })
        .eq('tournament_id', reg.tournament_id)
        .eq('member_id', reg.partner_id)
    }
    toast.success('Đã rút')
    load()
  }

  async function generateBracket() {
    if (!tournament) return
    if (matches.length > 0) {
      if (!confirm('Đã có matches — sinh lại sẽ XOÁ kết quả cũ. Tiếp tục?')) return
      await supabase.from('tournament_matches').delete().eq('tournament_id', tournament.id)
    }

    const teams: Team[] = confirmedNonMirror.map((r) => {
      const a = membersById.get(r.member_id)
      const b = r.partner_id ? membersById.get(r.partner_id) : null
      return {
        ids: b ? [r.member_id, r.partner_id!] : [r.member_id],
        label: b ? `${a?.full_name} & ${b.full_name}` : a?.full_name ?? '?',
      }
    })

    if (teams.length < 2) {
      toast.error('Cần ít nhất 2 team đã confirm')
      return
    }

    const newMatches =
      tournament.format === 'round_robin'
        ? generateRoundRobin(teams)
        : generateSingleElim(teams)

    const rows = newMatches.map((m) => ({
      tournament_id: tournament.id,
      round: m.round,
      team_a_ids: m.team_a_ids,
      team_b_ids: m.team_b_ids,
    }))

    const { error } = await supabase.from('tournament_matches').insert(rows)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(`Đã sinh ${rows.length} trận`)
    // Set status ongoing
    await supabase.from('tournaments').update({ status: 'ongoing' }).eq('id', tournament.id)
    load()
  }

  return (
    <div className="pb-6">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/tournaments')}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold truncate">{tournament.name}</h1>
      </header>

      <nav className="bg-white border-b border-gray-200 grid grid-cols-3">
        {(['info', 'register', 'bracket'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'py-3 text-sm font-medium border-b-2 transition-colors',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500'
            )}
          >
            {t === 'info' && 'Thông tin'}
            {t === 'register' && `Đăng ký (${confirmedNonMirror.length})`}
            {t === 'bracket' && 'Bracket'}
          </button>
        ))}
      </nav>

      {tab === 'info' && <InfoTab tournament={tournament} />}

      {tab === 'register' && (
        <RegisterTab
          tournament={tournament}
          registrations={registrations}
          membersById={membersById}
          myRegistration={myRegistration}
          isAdmin={isAdmin}
          onRegister={() => setRegOpen(true)}
          onConfirm={confirmRegistration}
          onWithdraw={withdrawRegistration}
        />
      )}

      {tab === 'bracket' && (
        <BracketTab
          tournament={tournament}
          matches={matches}
          membersById={membersById}
          confirmedNonMirror={confirmedNonMirror}
          isAdmin={isAdmin}
          onGenerate={generateBracket}
          onUpdated={load}
        />
      )}

      {me && (
        <RegistrationForm
          open={regOpen}
          onClose={() => setRegOpen(false)}
          tournament={tournament}
          members={members}
          existing={myRegistration}
          onSaved={load}
        />
      )}
    </div>
  )
}

function InfoTab({ tournament }: { tournament: Tournament }) {
  return (
    <div className="p-4 space-y-3">
      <div className="bg-white rounded-xl p-4 space-y-3">
        {tournament.description && (
          <p className="text-sm text-gray-700">{tournament.description}</p>
        )}
        {tournament.event_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            {new Date(tournament.event_date).toLocaleDateString('vi-VN', {
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
        )}
        {tournament.venue && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-400" />
            {tournament.venue}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-gray-400" />
          Thể thức: {tournament.format === 'round_robin' ? 'Round Robin' : 'Single Elim'}
        </div>
        {tournament.skill_filter && tournament.skill_filter.length > 0 && (
          <div className="text-xs text-gray-500">
            Skill: {tournament.skill_filter.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}

function RegisterTab({
  tournament,
  registrations,
  membersById,
  myRegistration,
  isAdmin,
  onRegister,
  onConfirm,
  onWithdraw,
}: {
  tournament: Tournament
  registrations: TournamentRegistration[]
  membersById: Map<string, Member>
  myRegistration: TournamentRegistration | undefined
  isAdmin: boolean
  onRegister: () => void
  onConfirm: (r: TournamentRegistration) => void
  onWithdraw: (r: TournamentRegistration) => void
}) {
  const canRegister = tournament.status === 'open'
  const visible = registrations.filter((r) => r.status !== 'withdrawn')

  const CATEGORY_LABEL: Record<string, string> = {
    mens_doubles: 'Nam đôi',
    womens_doubles: 'Nữ đôi',
    mixed: 'Hỗn hợp',
    singles: 'Đơn',
  }

  return (
    <div className="p-4 space-y-3">
      {canRegister && (
        <Button onClick={onRegister} className="w-full">
          <UserPlus className="w-4 h-4 mr-1" />
          {myRegistration ? 'Sửa đăng ký của tôi' : 'Đăng ký giải'}
        </Button>
      )}
      {!canRegister && tournament.status !== 'completed' && (
        <div className="text-center py-2 text-sm text-gray-500">
          Giải chưa mở đăng ký
        </div>
      )}

      {visible.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">Chưa có ai đăng ký</div>
      )}

      {visible.map((r) => {
        const m = membersById.get(r.member_id)
        const p = r.partner_id ? membersById.get(r.partner_id) : null
        const isPending = r.status === 'pending'
        return (
          <div key={r.id} className="bg-white rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {m?.full_name ?? '?'}
                  {p && (
                    <span className="text-gray-500"> & {p.full_name}</span>
                  )}
                  {r.is_mirror && (
                    <span className="text-[10px] ml-2 text-gray-400">(mirror)</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {CATEGORY_LABEL[r.category ?? ''] ?? r.category}
                </div>
              </div>
              {isPending && (
                <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-bold">
                  PENDING
                </span>
              )}
              {r.status === 'confirmed' && (
                <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded font-bold">
                  ✓ CONFIRMED
                </span>
              )}
            </div>
            {isAdmin && !r.is_mirror && (
              <div className="flex gap-2 pt-1">
                {isPending && (
                  <button
                    onClick={() => onConfirm(r)}
                    className="flex-1 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Confirm
                  </button>
                )}
                <button
                  onClick={() => onWithdraw(r)}
                  className="py-1.5 px-3 text-xs font-medium bg-red-50 text-red-600 rounded-lg flex items-center justify-center gap-1"
                >
                  <X className="w-3 h-3" /> Rút
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BracketTab({
  tournament,
  matches,
  membersById,
  confirmedNonMirror,
  isAdmin,
  onGenerate,
  onUpdated,
}: {
  tournament: Tournament
  matches: TournamentMatch[]
  membersById: Map<string, Member>
  confirmedNonMirror: TournamentRegistration[]
  isAdmin: boolean
  onGenerate: () => void
  onUpdated: () => void
}) {
  const byRound = useMemo(() => {
    const m = new Map<string, TournamentMatch[]>()
    for (const x of matches) {
      const arr = m.get(x.round) ?? []
      arr.push(x)
      m.set(x.round, arr)
    }
    return Array.from(m.entries())
  }, [matches])

  // Standings cho round robin
  const standings = useMemo(() => {
    if (tournament.format !== 'round_robin') return null
    const teams: Team[] = confirmedNonMirror.map((r) => ({
      ids: r.partner_id ? [r.member_id, r.partner_id] : [r.member_id],
      label: '',
    }))
    return computeRoundRobinStandings(teams, matches)
  }, [tournament.format, confirmedNonMirror, matches])

  if (matches.length === 0) {
    return (
      <div className="p-4">
        {isAdmin && confirmedNonMirror.length >= 2 ? (
          <div className="text-center py-8 space-y-3">
            <Trophy className="w-12 h-12 mx-auto text-gray-300" />
            <p className="text-sm text-gray-600">
              {confirmedNonMirror.length} team đã confirm. Sinh bracket để bắt đầu.
            </p>
            <Button onClick={onGenerate}>Sinh bracket</Button>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Chưa có bracket. {!isAdmin && 'Đợi admin sinh sau khi confirm các team.'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {isAdmin && (
        <Button onClick={onGenerate} variant="secondary" className="w-full">
          Sinh lại bracket (xoá kết quả)
        </Button>
      )}

      {byRound.map(([round, ms]) => (
        <div key={round} className="space-y-2">
          <h3 className="font-bold text-sm text-gray-700">{round}</h3>
          {ms.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              membersById={membersById}
              isAdmin={isAdmin}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      ))}

      {standings && standings.length > 0 && (
        <div className="bg-white rounded-xl p-3">
          <h3 className="font-bold text-sm mb-2">Bảng xếp hạng</h3>
          <table className="w-full text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left py-1">Team</th>
                <th className="text-center py-1">W</th>
                <th className="text-center py-1">L</th>
                <th className="text-center py-1">+/-</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.team_ids.join(',')} className="border-t border-gray-100">
                  <td className="py-1.5">
                    <span className="font-bold text-gray-400 mr-1">#{i + 1}</span>
                    {s.team_ids
                      .map((id) => membersById.get(id)?.full_name ?? '?')
                      .join(' & ')}
                  </td>
                  <td className="text-center font-semibold text-primary">{s.wins}</td>
                  <td className="text-center text-gray-500">{s.losses}</td>
                  <td className="text-center font-mono">
                    {s.points_diff > 0 ? '+' : ''}
                    {s.points_diff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
