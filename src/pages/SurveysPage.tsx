import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { SurveyCard } from '../components/surveys/SurveyCard'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import { useAuth } from '../hooks/useAuth'
import type { Survey } from '../types/database'

type Tab = 'open' | 'closed'

export function SurveysPage() {
  const { member } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({})
  const [myResponded, setMyResponded] = useState<Set<string>>(new Set())
  const [totalMembers, setTotalMembers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('open')

  useEffect(() => {
    let mounted = true

    async function load() {
      const [{ data: surveysData }, { count: total }] = await Promise.all([
        supabase.from('surveys').select('*').order('created_at', { ascending: false }),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ])
      if (!mounted) return
      const list = (surveysData ?? []) as Survey[]
      setSurveys(list)
      setTotalMembers(total ?? 0)

      // Count responses per survey
      if (list.length > 0) {
        const counts: Record<string, number> = {}
        await Promise.all(
          list.map(async (s) => {
            const { count } = await supabase
              .from('survey_responses')
              .select('*', { count: 'exact', head: true })
              .eq('survey_id', s.id)
            counts[s.id] = count ?? 0
          })
        )
        setResponseCounts(counts)
      }

      // Which surveys current member has responded
      if (member) {
        const { data: mine } = await supabase
          .from('survey_responses')
          .select('survey_id')
          .eq('member_id', member.id)
        setMyResponded(new Set((mine ?? []).map((r) => r.survey_id as string)))
      }

      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [member])

  const filtered = useMemo(() => {
    const now = new Date()
    return surveys.filter((s) => {
      const closed = !s.is_open || (s.closes_at && new Date(s.closes_at) < now)
      return tab === 'open' ? !closed : closed
    })
  }, [surveys, tab])

  return (
    <div>
      <TopBar title="Khảo sát" />

      <div className="px-4 pt-3 pb-3 bg-white border-b border-gray-100">
        <div className="bg-gray-100 p-0.5 rounded-lg grid grid-cols-2 gap-0.5">
          {(['open', 'closed'] as Tab[]).map((t) => {
            const count =
              t === 'open'
                ? surveys.filter(
                    (s) => s.is_open && (!s.closes_at || new Date(s.closes_at) >= new Date())
                  ).length
                : surveys.filter(
                    (s) => !s.is_open || (s.closes_at && new Date(s.closes_at) < new Date())
                  ).length
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                  tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                )}
              >
                {t === 'open' ? 'Đang mở' : 'Đã đóng'}
                {count > 0 && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                      tab === t ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 space-y-2">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            {tab === 'open' ? 'Không có khảo sát nào đang mở' : 'Chưa có khảo sát đã đóng'}
          </div>
        )}
        {!loading &&
          filtered.map((s) => (
            <SurveyCard
              key={s.id}
              survey={s}
              responseCount={responseCounts[s.id]}
              totalMembers={totalMembers}
              hasResponded={myResponded.has(s.id)}
            />
          ))}
      </div>
    </div>
  )
}
