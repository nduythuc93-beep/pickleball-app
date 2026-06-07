import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { downloadCSV, toCSV } from '../../lib/csv'
import type { Member, Survey, SurveyResponse } from '../../types/database'

type Props = {
  open: boolean
  onClose: () => void
  survey: Survey | null
}

type Row = {
  member: Pick<Member, 'id' | 'full_name' | 'phone'>
  response: SurveyResponse
}

export function SurveyResponsesModal({ open, onClose, survey }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !survey) return
    let mounted = true
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*, members!inner(id, full_name, phone)')
        .eq('survey_id', survey!.id)
        .order('submitted_at', { ascending: false })
      if (!mounted) return
      if (error) {
        toast.error(friendlyError(error))
        setRows([])
      } else {
        setRows(
          (data ?? []).map((r) => ({
            response: r as unknown as SurveyResponse,
            member: (r as unknown as { members: Member }).members,
          }))
        )
      }
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [open, survey])

  function onExportCSV() {
    if (!survey || rows.length === 0) return
    const fieldKeys = survey.fields_schema.map((f) => f.key)
    const headers = [
      { key: 'submitted_at', label: 'Thời gian gửi' },
      { key: 'full_name', label: 'Họ tên' },
      { key: 'phone', label: 'SĐT' },
      ...survey.fields_schema.map((f) => ({ key: f.key, label: f.label })),
    ]
    const csvRows = rows.map((r) => {
      const out: Record<string, unknown> = {
        submitted_at: new Date(r.response.submitted_at).toLocaleString('vi-VN'),
        full_name: r.member.full_name,
        phone: r.member.phone ?? '',
      }
      for (const k of fieldKeys) {
        const v = (r.response.answers ?? {})[k]
        out[k] = typeof v === 'boolean' ? (v ? 'Có' : 'Không') : v
      }
      return out
    })
    const csv = toCSV(csvRows, headers)
    const fname = `${survey.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`
    downloadCSV(fname, csv)
    toast.success('Đã tải CSV')
  }

  if (!survey) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Kết quả: ${survey.title}`}
      footer={
        <div className="flex gap-2">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Đóng
          </Button>
          <Button
            onClick={onExportCSV}
            disabled={rows.length === 0}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="text-sm text-gray-600">
          <strong>{rows.length}</strong> thành viên đã điền
        </div>

        {loading && <div className="text-center py-8 text-gray-500 text-sm">Đang tải...</div>}

        {!loading && rows.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">Chưa có ai điền</div>
        )}

        {!loading &&
          rows.map(({ member, response }) => (
            <div key={response.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{member.full_name}</span>
                <span className="text-[10px] text-gray-500">
                  {new Date(response.submitted_at).toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                {survey.fields_schema.map((f) => {
                  const v = (response.answers ?? {})[f.key]
                  const display =
                    typeof v === 'boolean'
                      ? v
                        ? '✓ Có'
                        : '✕ Không'
                      : v === null || v === undefined || v === ''
                      ? '—'
                      : String(v)
                  return (
                    <div key={f.key} className="flex gap-2">
                      <span className="text-gray-500 min-w-[100px]">{f.label}:</span>
                      <span className="font-medium text-gray-800">{display}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>
    </Modal>
  )
}
