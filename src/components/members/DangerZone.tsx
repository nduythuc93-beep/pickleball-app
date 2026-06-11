import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'

const CONFIRM_PHRASE = 'XOÁ TÀI KHOẢN'

type Step = 'warn' | 'confirm' | 'final'

/**
 * Account deletion section — visible only on user's own profile.
 * Multi-step confirm modal so it's impossible to delete accidentally.
 *
 * After successful deletion: sign user out and redirect to /login with
 * a final farewell toast. PII is anonymized server-side immediately;
 * hard delete runs via cron after 30 days (grace period for accidental
 * deletion — admin can restore within that window).
 */
export function DangerZone() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('warn')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  function closeModal() {
    setOpen(false)
    setTimeout(() => {
      setStep('warn')
      setConfirmText('')
    }, 200)
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.rpc('request_account_deletion')
    if (error) {
      setDeleting(false)
      toast.error(friendlyError(error))
      return
    }
    // Sign out and redirect — show a long-duration goodbye toast
    await signOut()
    toast.success('Tài khoản đã được xoá. Cảm ơn anh/chị đã sử dụng app 🙏', {
      duration: 6000,
    })
    navigate('/login', { replace: true })
  }

  return (
    <>
      <div className="bg-white border border-red-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <h3 className="text-sm font-bold text-red-700">Khu vực nguy hiểm</h3>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Xoá tài khoản sẽ huỷ toàn bộ điểm tích luỹ, lịch sử đổi quà và
          quyền đăng ký giải đấu. Lịch sử check-in được giữ lại dưới dạng
          ẩn danh phục vụ thống kê CLB.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Yêu cầu xoá tài khoản
        </button>
      </div>

      <Modal
        open={open}
        onClose={closeModal}
        title={
          step === 'warn'
            ? '⚠️ Xoá tài khoản'
            : step === 'confirm'
            ? 'Xác nhận xoá'
            : 'Bước cuối'
        }
        footer={
          step === 'warn' ? (
            <div className="flex gap-2">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Huỷ
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Tôi đã đọc, tiếp tục
              </button>
            </div>
          ) : step === 'confirm' ? (
            <div className="flex gap-2">
              <button
                onClick={() => setStep('warn')}
                className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                ← Quay lại
              </button>
              <button
                onClick={() => setStep('final')}
                disabled={confirmText.trim().toUpperCase() !== CONFIRM_PHRASE}
                className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Tiếp tục
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                disabled={deleting}
              >
                ← Đổi ý
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang xoá...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Xoá vĩnh viễn
                  </>
                )}
              </button>
            </div>
          )
        }
      >
        {step === 'warn' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 leading-relaxed">
                Hành động này <strong>không thể hoàn tác</strong> sau 30 ngày
                kể từ thời điểm yêu cầu xoá.
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-700 mb-1.5">
                Anh/chị sẽ mất:
              </p>
              <ul className="text-xs text-gray-700 space-y-1.5 ml-4 list-disc">
                <li>Toàn bộ điểm tích luỹ</li>
                <li>Lịch sử đổi quà cá nhân</li>
                <li>Quyền đăng ký giải đấu</li>
                <li>Thông tin cá nhân (tên, SĐT, email, avatar)</li>
                <li>Tài khoản đăng nhập</li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-700 mb-1.5">
                Sẽ được giữ (ẩn danh):
              </p>
              <ul className="text-xs text-gray-600 space-y-1.5 ml-4 list-disc">
                <li>Lịch sử check-in (cho thống kê CLB)</li>
                <li>Kết quả giải đấu đã tham gia</li>
              </ul>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed">
              💡 Có <strong>30 ngày grace period</strong> — nếu đổi ý, liên hệ
              admin/host để khôi phục. Sau 30 ngày, dữ liệu bị xoá vĩnh viễn,
              không khôi phục được.
            </p>

            <p className="text-[11px] text-gray-500">
              Đọc{' '}
              <Link to="/privacy" className="text-primary underline">
                Chính sách Bảo mật
              </Link>{' '}
              và{' '}
              <Link to="/terms" className="text-primary underline">
                Điều khoản
              </Link>{' '}
              mục 9 để biết chi tiết.
            </p>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              Để xác nhận xoá tài khoản, vui lòng gõ chính xác cụm từ bên
              dưới:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <code className="text-base font-bold tracking-wider text-red-700">
                {CONFIRM_PHRASE}
              </code>
            </div>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Gõ vào đây..."
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 uppercase"
            />
            {confirmText.length > 0 && confirmText.toUpperCase() !== CONFIRM_PHRASE && (
              <p className="text-[11px] text-red-600 flex items-center gap-1">
                <X className="w-3 h-3" />
                Chưa khớp
              </p>
            )}
          </div>
        )}

        {step === 'final' && (
          <div className="space-y-3 text-center py-2">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-7 h-7 text-red-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">
              Sẵn sàng xoá tài khoản?
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Anh/chị sẽ được đăng xuất ngay sau khi xác nhận. Có 30 ngày
              để liên hệ admin nếu đổi ý.
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Cảm ơn anh/chị đã sử dụng app 🙏
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
