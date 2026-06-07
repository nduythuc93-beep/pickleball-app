import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { FieldRenderer } from '../components/surveys/FieldRenderer'
import { Button } from '../components/ui/Button'
import { validateField } from '../lib/surveyTemplates'
import type { Survey, SurveyResponse } from '../types/database'

export function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { member } = useAuth()

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [existing, setExisting] = useState<SurveyResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!id || !member) return
      const [{ data: surveyData }, { data: respData }] = await Promise.all([
        supabase.from('surveys').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('survey_responses')
          .select('*')
          .eq('survey_id', id)
          .eq('member_id', member.id)
          .maybeSingle(),
      ])
      if (!mounted) return
      const s = surveyData as Survey | null
      setSurvey(s)
      if (respData) {
        const r = respData as SurveyResponse
        setExisting(r)
        setAnswers(r.answers ?? {})
      } else if (s) {
        // Init defaults từ fields_schema
        const init: Record<string, unknown> = {}
        for (const f of s.fields_schema) {
          if (f.default !== undefined) init[f.key] = f.default
        }
        setAnswers(init)
      }
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [id, member])

  const closedAt = survey?.closes_at ? new Date(survey.closes_at) : null
  const isClosed = !survey?.is_open || (closedAt !== null && closedAt < new Date())
  const hasSubmitted = Boolean(existing)
  const readonly = hasSubmitted || isClosed

  function setAnswer(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  async function onSubmit() {
    if (!survey || !member) return

    // Validate
    const newErrors: Record<string, string> = {}
    for (const f of survey.fields_schema) {
      const err = validateField(f, answers[f.key])
      if (err) newErrors[f.key] = err
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error('Vui lòng điền đủ các trường bắt buộc')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('survey_responses').insert({
      survey_id: survey.id,
      member_id: member.id,
      answers,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Đã gửi khảo sát')
    navigate('/surveys')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600 mb-4">Không tìm thấy khảo sát</p>
        <Link to="/surveys" className="text-primary underline">Về danh sách</Link>
      </div>
    )
  }

  return (
    <div className="pb-6">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/surveys')}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold truncate">{survey.title}</h1>
      </header>

      <div className="bg-white p-4 border-b border-gray-100">
        {survey.description && (
          <p className="text-sm text-gray-600 mb-3">{survey.description}</p>
        )}
        {closedAt && (
          <p className="text-xs text-gray-500">
            Hạn điền: {closedAt.toLocaleString('vi-VN')}
          </p>
        )}
      </div>

      {hasSubmitted && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Đã gửi câu trả lời</p>
            <p className="text-xs">Anh/chị đã điền khảo sát này lúc {new Date(existing!.submitted_at).toLocaleString('vi-VN')}</p>
          </div>
        </div>
      )}

      {!hasSubmitted && isClosed && (
        <div className="mx-4 mt-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl p-3 text-sm flex items-start gap-2">
          <Lock className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>Khảo sát đã đóng. Liên hệ admin nếu cần điền muộn.</p>
        </div>
      )}

      <form
        className="p-4 space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        {survey.fields_schema.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={answers[field.key]}
            onChange={(v) => setAnswer(field.key, v)}
            error={errors[field.key]}
            disabled={readonly}
          />
        ))}

        {!readonly && (
          <Button type="submit" loading={submitting} className="w-full">
            Gửi câu trả lời
          </Button>
        )}
      </form>
    </div>
  )
}
