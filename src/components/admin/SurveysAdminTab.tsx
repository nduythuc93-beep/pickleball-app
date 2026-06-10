import { useEffect, useState } from 'react'
import { Plus, Pencil, UserX, Eye, Lock, Unlock } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../ui/Button'
import { SurveyFormModal } from '../surveys/SurveyFormModal'
import { SurveyResponsesModal } from '../surveys/SurveyResponsesModal'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { cn } from '../../lib/cn'
import type { Survey } from '../../types/database'

export function SurveysAdminTab() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Survey | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [respSurvey, setRespSurvey] = useState<Survey | null>(null)
  const [respOpen, setRespOpen] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error(friendlyError(error))
      setSurveys([])
    } else {
      const list = (data ?? []) as Survey[]
      setSurveys(list)
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
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleOpen(s: Survey) {
    const { error } = await supabase
      .from('surveys')
      .update({ is_open: !s.is_open })
      .eq('id', s.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(s.is_open ? 'Đã đóng' : 'Đã mở lại')
    load()
  }

  async function onDelete(s: Survey) {
    if (!confirm(`Xoá khảo sát "${s.title}"? (responses cũng bị xoá)`)) return
    const { error } = await supabase.from('surveys').delete().eq('id', s.id)
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
          <Plus className="w-4 h-4 mr-1" /> Tạo khảo sát mới
        </Button>
      </div>

      <div className="p-4 space-y-2">
        {loading && <div className="text-center text-gray-500 text-sm py-8">Đang tải...</div>}
        {!loading && surveys.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            Chưa có khảo sát nào
          </div>
        )}
        {!loading &&
          surveys.map((s) => {
            const closedByDate = s.closes_at && new Date(s.closes_at) < new Date()
            return (
              <div key={s.id} className="bg-white rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.title}</div>
                    <div className="text-xs text-gray-500">
                      {responseCounts[s.id] ?? 0} phản hồi
                      {s.closes_at && ` · Hạn ${new Date(s.closes_at).toLocaleDateString('vi-VN')}`}
                    </div>
                  </div>
                  {!s.is_open && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-bold">
                      ĐÓNG
                    </span>
                  )}
                  {closedByDate && s.is_open && (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-bold">
                      QUÁ HẠN
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setRespSurvey(s)
                      setRespOpen(true)
                    }}
                    className="flex-1 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Kết quả
                  </button>
                  <button
                    onClick={() => {
                      setEditing(s)
                      setFormOpen(true)
                    }}
                    className="py-2 px-3 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    aria-label="Sửa"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleOpen(s)}
                    className={cn(
                      'py-2 px-3 text-xs font-medium rounded-lg',
                      s.is_open
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    )}
                    aria-label={s.is_open ? 'Đóng' : 'Mở'}
                  >
                    {s.is_open ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => onDelete(s)}
                    className="py-2 px-3 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                    aria-label="Xoá"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      <SurveyFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        survey={editing}
        onSaved={load}
      />
      <SurveyResponsesModal
        open={respOpen}
        onClose={() => setRespOpen(false)}
        survey={respSurvey}
      />
    </div>
  )
}
