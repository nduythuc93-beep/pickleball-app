import { useState } from 'react'
import toast from 'react-hot-toast'
import { Edit2, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { cn } from '../../lib/cn'
import type { Member, TournamentMatch } from '../../types/database'

type Props = {
  match: TournamentMatch
  membersById: Map<string, Member>
  isAdmin: boolean
  onUpdated: () => void
}

function teamLabel(ids: string[], byId: Map<string, Member>) {
  return ids.map((id) => byId.get(id)?.full_name ?? '?').join(' & ')
}

export function MatchCard({ match, membersById, isAdmin, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [scoreA, setScoreA] = useState(match.score_a?.toString() ?? '')
  const [scoreB, setScoreB] = useState(match.score_b?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const hasResult = match.score_a !== null && match.score_b !== null
  const aWon = hasResult && (match.score_a ?? 0) > (match.score_b ?? 0)
  const bWon = hasResult && (match.score_b ?? 0) > (match.score_a ?? 0)

  async function onSave() {
    const a = parseInt(scoreA, 10)
    const b = parseInt(scoreB, 10)
    if (Number.isNaN(a) || Number.isNaN(b)) {
      toast.error('Nhập điểm hợp lệ')
      return
    }
    setSaving(true)
    const winner_ids = a > b ? match.team_a_ids : b > a ? match.team_b_ids : null
    const { error } = await supabase
      .from('tournament_matches')
      .update({
        score_a: a,
        score_b: b,
        winner_ids,
        played_at: new Date().toISOString(),
      })
      .eq('id', match.id)
    setSaving(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã lưu kết quả')
    setEditing(false)
    onUpdated()
  }

  return (
    <div className="bg-white rounded-xl p-3 space-y-2 border border-gray-100">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{match.round}</span>
        {match.court && <span>Sân {match.court}</span>}
        {isAdmin && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-primary flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            {hasResult ? 'Sửa' : 'Nhập KQ'}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <TeamRow
          label={teamLabel(match.team_a_ids, membersById)}
          score={editing ? scoreA : match.score_a?.toString() ?? '-'}
          editing={editing}
          onChange={setScoreA}
          isWinner={aWon}
        />
        <TeamRow
          label={teamLabel(match.team_b_ids, membersById)}
          score={editing ? scoreB : match.score_b?.toString() ?? '-'}
          editing={editing}
          onChange={setScoreB}
          isWinner={bWon}
        />
      </div>

      {editing && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              setEditing(false)
              setScoreA(match.score_a?.toString() ?? '')
              setScoreB(match.score_b?.toString() ?? '')
            }}
            className="flex-1 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg"
          >
            Huỷ
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-1.5 text-xs font-medium bg-primary text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Check className="w-3 h-3" /> Lưu
          </button>
        </div>
      )}
    </div>
  )
}

function TeamRow({
  label,
  score,
  editing,
  onChange,
  isWinner,
}: {
  label: string
  score: string
  editing: boolean
  onChange: (v: string) => void
  isWinner: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2 py-1', isWinner && 'font-bold')}>
      <span className="text-sm flex-1 min-w-0 truncate">
        {isWinner && '🏆 '}
        {label}
      </span>
      {editing ? (
        <input
          type="number"
          value={score}
          onChange={(e) => onChange(e.target.value)}
          className="w-14 text-center py-1 border border-gray-300 rounded text-sm font-semibold"
        />
      ) : (
        <span className={cn('text-lg font-bold', isWinner ? 'text-primary' : 'text-gray-700')}>
          {score}
        </span>
      )}
    </div>
  )
}
