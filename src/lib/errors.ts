import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Parse Supabase/Postgres errors thành message tiếng Việt thân thiện.
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export function friendlyError(err: unknown): string {
  if (!err) return 'Có lỗi xảy ra'

  // PostgrestError có dạng { code, message, details, hint }
  const pg = err as Partial<PostgrestError>
  const code = pg.code
  const msg = pg.message ?? String(err)

  // 23505 = unique_violation
  if (code === '23505') {
    if (msg.includes('members_email_key')) return 'Email này đã có thành viên dùng rồi'
    if (msg.includes('members_phone_key')) return 'Số điện thoại này đã có rồi'
    if (msg.includes('survey_responses')) return 'Anh/chị đã điền khảo sát này rồi'
    if (msg.includes('tournament_registrations')) return 'Thành viên đã đăng ký giải này'
    return 'Giá trị này đã tồn tại — phải duy nhất'
  }

  // 23503 = foreign_key_violation
  if (code === '23503') return 'Không thể xoá vì đang được tham chiếu ở chỗ khác'

  // 23502 = not_null_violation
  if (code === '23502') {
    const match = msg.match(/column "([^"]+)"/)
    return `Trường "${match?.[1] ?? '?'}" không được để trống`
  }

  // 23514 = check_violation
  if (code === '23514') return 'Dữ liệu không hợp lệ (vi phạm constraint)'

  // 42501 = insufficient_privilege (RLS chặn)
  if (code === '42501' || msg.includes('row-level security')) {
    return 'Anh/chị không có quyền thực hiện thao tác này'
  }

  // 23P01 = exclusion_violation (rare)
  if (code === '23P01') return 'Dữ liệu trùng lặp'

  // Auth errors
  if (msg.includes('Invalid login credentials')) return 'Email hoặc password sai'
  if (msg.includes('Email not confirmed')) return 'Email chưa được xác nhận'
  if (msg.includes('rate limit')) return 'Quá nhiều yêu cầu — vui lòng thử lại sau ít phút'

  // Network
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Mất kết nối — kiểm tra mạng và thử lại'
  }

  // Fallback: return original message
  return msg
}
