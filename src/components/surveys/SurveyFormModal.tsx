import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { SURVEY_TEMPLATES, type TemplateKey } from '../../lib/surveyTemplates'
import { cn } from '../../lib/cn'
import type { Survey } from '../../types/database'

type Props = {
  open: boolean
  onClose: () => void
  survey?: Survey | null
  onSaved: () => void
}

export function SurveyFormModal({ open, onClose, survey, onSaved }: Props) {
  const { user } = useAuth()
  const isEdit = Boolean(survey)

  const [template, setTemplate] = useState<TemplateKey>('jersey')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (survey) {
      setTemplate(survey.type as TemplateKey)
      setTitle(survey.title)
      setDescription(survey.description ?? '')
      setClosesAt(survey.closes_at ? survey.closes_at.slice(0, 16) : '')
      setIsOpen(survey.is_open)
    } else {
      setTemplate('jersey')
      setTitle(SURVEY_TEMPLATES.jersey.defaultTitle)
      setDescription('')
      // Default: 14 ngày sau
      const d = new Date()
      d.setDate(d.getDate() + 14)
      setClosesAt(d.toISOString().slice(0, 16))
      setIsOpen(true)
    }
  }, [open, survey])

  useEffect(() => {
    if (!isEdit && template !== 'custom') {
      setTitle(SURVEY_TEMPLATES[template].defaultTitle)
    }
  }, [template, isEdit])

  async function onSubmit() {
    if (!title.trim()) {
      toast.error('Nhập tiêu đề')
      return
    }
    setSaving(true)

    const fields_schema =
      template === 'custom'
        ? survey?.fields_schema ?? []
        : SURVEY_TEMPLATES[template].fields

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      type: template,
      fields_schema,
      closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      is_open: isOpen,
    }

    let error
    if (isEdit && survey) {
      ;({ error } = await supabase.from('surveys').update(payload).eq('id', survey.id))
    } else {
      ;({ error } = await supabase
        .from('surveys')
        .insert({ ...payload, created_by: user?.id ?? null }))
    }

    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(isEdit ? 'Đã cập nhật' : 'Đã tạo khảo sát')
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Sửa: ${survey?.title}` : 'Tạo khảo sát mới'}
      footer={
        <div className="flex gap-2">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Huỷ
          </Button>
          <Button onClick={onSubmit} loading={saving} className="flex-1">
            {isEdit ? 'Lưu' : 'Tạo'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!isEdit && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Template</label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(SURVEY_TEMPLATES) as Array<keyof typeof SURVEY_TEMPLATES>).map((key) => {
                const t = SURVEY_TEMPLATES[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTemplate(key)}
                    className={cn(
                      'text-left p-3 rounded-lg border transition-colors',
                      template === key
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-white'
                    )}
                  >
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {t.fields.length} câu hỏi
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <Input
          label="Tiêu đề *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Đặt áo CLB tháng 6"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Hướng dẫn ngắn cho thành viên..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>

        <Input
          label="Hạn điền"
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
            className="rounded text-primary"
          />
          Cho phép điền (uncheck để đóng thủ công)
        </label>
      </div>
    </Modal>
  )
}
