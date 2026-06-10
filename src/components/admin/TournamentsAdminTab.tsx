import { useEffect, useState } from 'react'
import { Plus, Pencil, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../ui/Button'
import { TournamentCard } from '../tournaments/TournamentCard'
import { TournamentFormModal } from '../tournaments/TournamentFormModal'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import type { Tournament } from '../../types/database'

export function TournamentsAdminTab() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Tournament | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
    const list = (data ?? []) as Tournament[]
    setTournaments(list)
    const c: Record<string, number> = {}
    await Promise.all(
      list.map(async (t) => {
        const { count } = await supabase
          .from('tournament_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id)
          .neq('status', 'withdrawn')
        c[t.id] = count ?? 0
      })
    )
    setCounts(c)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function onDelete(t: Tournament) {
    if (!confirm(`Xoá giải "${t.name}"? Cascade xoá đăng ký + matches.`)) return
    const { error } = await supabase.from('tournaments').delete().eq('id', t.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã xoá')
    load()
  }

  return (
    <div>
      <div className="p-4 bg-white border-b border-gray-100">
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-1" /> Tạo giải mới
        </Button>
      </div>

      <div className="p-4 space-y-2">
        {loading && <div className="text-center text-gray-500 text-sm py-8">Đang tải...</div>}
        {!loading && tournaments.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">Chưa có giải nào</div>
        )}
        {!loading &&
          tournaments.map((t) => (
            <div key={t.id} className="space-y-2">
              <TournamentCard tournament={t} registrationCount={counts[t.id]} />
              <div className="flex gap-2 px-1">
                <button
                  onClick={() => {
                    setEditing(t)
                    setFormOpen(true)
                  }}
                  className="flex-1 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> Sửa
                </button>
                <button
                  onClick={() => onDelete(t)}
                  className="py-1.5 px-3 text-xs font-medium bg-red-50 text-red-600 rounded-lg"
                >
                  <UserX className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
      </div>

      <TournamentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        tournament={editing}
        onSaved={load}
      />
    </div>
  )
}
