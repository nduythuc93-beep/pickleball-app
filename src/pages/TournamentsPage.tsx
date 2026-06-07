import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { TournamentCard } from '../components/tournaments/TournamentCard'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { Tournament } from '../types/database'

type Tab = 'active' | 'completed'

export function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [regCounts, setRegCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('active')

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .order('event_date', { ascending: false, nullsFirst: false })
      if (!mounted) return
      const list = (data ?? []) as Tournament[]
      setTournaments(list)
      // Count registrations per tournament
      const counts: Record<string, number> = {}
      await Promise.all(
        list.map(async (t) => {
          const { count } = await supabase
            .from('tournament_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', t.id)
            .neq('status', 'withdrawn')
          counts[t.id] = count ?? 0
        })
      )
      setRegCounts(counts)
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    return tournaments.filter((t) =>
      tab === 'active' ? t.status !== 'completed' : t.status === 'completed'
    )
  }, [tournaments, tab])

  return (
    <div>
      <TopBar title="Giải đấu" />

      <nav className="bg-white border-b border-gray-200 grid grid-cols-2">
        {(['active', 'completed'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'py-3 text-sm font-medium border-b-2 transition-colors',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500'
            )}
          >
            {t === 'active' ? 'Đang / sắp diễn ra' : 'Đã kết thúc'}
          </button>
        ))}
      </nav>

      <div className="p-4 space-y-2">
        {loading && <div className="text-center text-gray-500 text-sm py-8">Đang tải...</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-12">
            {tab === 'active' ? 'Chưa có giải nào sắp diễn ra' : 'Chưa có giải đã kết thúc'}
          </div>
        )}
        {!loading &&
          filtered.map((t) => (
            <TournamentCard key={t.id} tournament={t} registrationCount={regCounts[t.id]} />
          ))}
      </div>
    </div>
  )
}
