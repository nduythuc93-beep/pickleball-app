import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'

const LAST_UPDATED = '10/06/2026'
const APP_NAME = '8FM Pickleball'
const CONTACT_EMAIL = 'contact@8fmpickleball.vn'
const CONTACT_PHONE = 'Liên hệ Host tại sân'

/**
 * Privacy Policy — compliant with Nghị định 13/2023/NĐ-CP (PDPD).
 * Public page, no auth required.
 */
export function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Shield className="w-4 h-4 text-primary" />
          <h1 className="text-base font-bold">Chính sách Bảo mật</h1>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-4 py-6 text-sm leading-relaxed text-gray-700">
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
          <p className="text-xs text-gray-500">
            Cập nhật lần cuối: <strong>{LAST_UPDATED}</strong>
          </p>

          <section>
            <p>
              {APP_NAME} ("chúng tôi") cam kết bảo mật thông tin cá nhân của
              anh/chị ("người dùng") theo Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ
              liệu Cá nhân và các quy định pháp luật Việt Nam hiện hành.
            </p>
            <p className="mt-2">
              Chính sách này giải thích chúng tôi thu thập, sử dụng, lưu trữ và
              bảo vệ thông tin cá nhân của anh/chị như thế nào khi sử dụng web
              app {APP_NAME}.
            </p>
          </section>

          <Section title="1. Thông tin chúng tôi thu thập">
            <p className="mb-2">
              <strong>1.1. Khi đăng ký thành viên:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Họ và tên</li>
              <li>Số điện thoại (10 số)</li>
              <li>Email</li>
              <li>Mật khẩu (mã hoá, chúng tôi không lưu mật khẩu gốc)</li>
              <li>Giới tính</li>
              <li>Kinh nghiệm chơi (tuỳ chọn)</li>
              <li>Trình độ DUPR (Host/Coach/Admin đánh giá sau)</li>
            </ul>
            <p className="mt-3 mb-2">
              <strong>1.2. Khi check-in vãng lai:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Họ và tên</li>
              <li>Số điện thoại</li>
              <li>Nguồn biết đến CLB (tuỳ chọn)</li>
            </ul>
            <p className="mt-3 mb-2">
              <strong>1.3. Khi sử dụng app:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Lịch sử check-in các buổi đánh</li>
              <li>Điểm tích luỹ, lịch sử đổi quà</li>
              <li>Đăng ký giải đấu</li>
              <li>Trả lời khảo sát (nếu tham gia)</li>
              <li>Thông tin thiết bị cơ bản (loại trình duyệt, hệ điều hành)</li>
            </ul>
          </Section>

          <Section title="2. Mục đích sử dụng thông tin">
            <p>Chúng tôi sử dụng thông tin của anh/chị để:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Quản lý tài khoản và xác thực đăng nhập</li>
              <li>Ghi nhận check-in và tính điểm thưởng</li>
              <li>Xử lý đổi quà và đăng ký giải đấu</li>
              <li>Gửi thông báo về sự kiện CLB, kết quả khảo sát</li>
              <li>Liên hệ khi có vấn đề về tài khoản hoặc dịch vụ</li>
              <li>Cải thiện trải nghiệm và phát triển tính năng mới</li>
              <li>Phòng chống gian lận và đảm bảo an toàn dữ liệu</li>
            </ul>
          </Section>

          <Section title="3. Cơ sở pháp lý xử lý dữ liệu">
            <p>
              Chúng tôi xử lý dữ liệu của anh/chị dựa trên{' '}
              <strong>sự đồng ý</strong> mà anh/chị đã cung cấp khi đăng ký tài
              khoản hoặc thực hiện check-in vãng lai. Anh/chị có quyền rút lại
              sự đồng ý này bất kỳ lúc nào (xem mục 8).
            </p>
          </Section>

          <Section title="4. Chia sẻ dữ liệu với bên thứ ba">
            <p>
              Chúng tôi <strong>không bán</strong> dữ liệu cá nhân của anh/chị.
              Dữ liệu chỉ được chia sẻ với các nhà cung cấp dịch vụ kỹ thuật
              sau:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Supabase Inc.</strong> (Hoa Kỳ): Lưu trữ cơ sở dữ liệu
                và xác thực người dùng. Dữ liệu được mã hoá khi truyền và lưu
                trữ.
              </li>
              <li>
                <strong>Vercel Inc.</strong> (Hoa Kỳ): Hạ tầng web app, không
                lưu trữ dữ liệu cá nhân của anh/chị.
              </li>
            </ul>
            <p className="mt-3">
              Việc chuyển dữ liệu ra nước ngoài tuân thủ Nghị định 13/2023/NĐ-CP
              và được anh/chị đồng ý khi sử dụng dịch vụ.
            </p>
          </Section>

          <Section title="5. Thời gian lưu trữ dữ liệu">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Tài khoản đang hoạt động:</strong> lưu trữ trong suốt
                thời gian anh/chị sử dụng dịch vụ.
              </li>
              <li>
                <strong>Tài khoản yêu cầu xoá:</strong> chúng tôi xoá vĩnh viễn
                trong vòng 30 ngày kể từ khi nhận yêu cầu.
              </li>
              <li>
                <strong>Thông báo / log hệ thống:</strong> tự động xoá sau 30-90
                ngày.
              </li>
              <li>
                <strong>Lịch sử check-in &amp; điểm:</strong> giữ lại cho mục
                đích thống kê CLB (ẩn danh hoá).
              </li>
            </ul>
          </Section>

          <Section title="6. Bảo mật dữ liệu">
            <p>Chúng tôi áp dụng các biện pháp bảo mật sau:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Mã hoá HTTPS toàn bộ kết nối</li>
              <li>Mật khẩu được hash (bcrypt), không lưu dạng plain text</li>
              <li>Phân quyền truy cập theo vai trò (Member/Coach/Host/Admin)</li>
              <li>Row Level Security ở cấp cơ sở dữ liệu</li>
              <li>Backup định kỳ và kiểm soát truy cập nội bộ chặt chẽ</li>
            </ul>
          </Section>

          <Section title="7. Cookie và lưu trữ cục bộ">
            <p>
              App sử dụng <strong>localStorage</strong> và <strong>session
              cookie</strong> để:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Duy trì phiên đăng nhập</li>
              <li>Lưu cài đặt giao diện (theme, ngôn ngữ)</li>
              <li>Hỗ trợ PWA (Progressive Web App) hoạt động offline</li>
            </ul>
            <p className="mt-2">
              Chúng tôi <strong>không sử dụng</strong> cookie quảng cáo hoặc
              theo dõi từ bên thứ ba.
            </p>
          </Section>

          <Section title="8. Quyền của anh/chị">
            <p>Theo Nghị định 13/2023/NĐ-CP, anh/chị có các quyền sau:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Quyền được biết:</strong> Biết dữ liệu nào đang được xử
                lý
              </li>
              <li>
                <strong>Quyền đồng ý / rút lại đồng ý:</strong> Bất kỳ lúc nào
              </li>
              <li>
                <strong>Quyền truy cập:</strong> Xem dữ liệu của mình trên app
              </li>
              <li>
                <strong>Quyền chỉnh sửa:</strong> Cập nhật trong trang Cá nhân
              </li>
              <li>
                <strong>Quyền xoá dữ liệu:</strong> Yêu cầu xoá toàn bộ tài
                khoản
              </li>
              <li>
                <strong>Quyền hạn chế xử lý:</strong> Tạm dừng tài khoản
              </li>
              <li>
                <strong>Quyền phản đối xử lý dữ liệu:</strong> Theo quy định
                pháp luật
              </li>
              <li>
                <strong>Quyền khiếu nại:</strong> Tới cơ quan có thẩm quyền
              </li>
            </ul>
            <p className="mt-3">
              Để thực hiện các quyền trên, vui lòng liên hệ chúng tôi qua thông
              tin ở mục 12.
            </p>
          </Section>

          <Section title="9. Trẻ em dưới 16 tuổi">
            <p>
              Chúng tôi không cố ý thu thập dữ liệu của trẻ em dưới 16 tuổi nếu
              không có sự đồng ý của cha mẹ hoặc người giám hộ hợp pháp.
            </p>
            <p className="mt-2">
              Nếu anh/chị là cha mẹ và phát hiện con mình đã cung cấp dữ liệu
              cho chúng tôi mà không có sự đồng ý, vui lòng liên hệ để chúng tôi
              xoá thông tin đó.
            </p>
          </Section>

          <Section title="10. Chuyển dữ liệu xuyên biên giới">
            <p>
              Như đã nêu ở mục 4, dữ liệu của anh/chị được lưu trữ trên hạ tầng
              của Supabase Inc. (Hoa Kỳ). Việc này tuân thủ Nghị định
              13/2023/NĐ-CP. Bằng việc sử dụng dịch vụ, anh/chị đồng ý cho việc
              chuyển dữ liệu này.
            </p>
          </Section>

          <Section title="11. Thay đổi chính sách">
            <p>
              Chúng tôi có thể cập nhật chính sách này theo thời gian. Khi có
              thay đổi quan trọng, chúng tôi sẽ thông báo qua email hoặc thông
              báo trong app ít nhất 7 ngày trước khi áp dụng.
            </p>
            <p className="mt-2">
              Phiên bản hiện tại có hiệu lực từ ngày {LAST_UPDATED}.
            </p>
          </Section>

          <Section title="12. Liên hệ">
            <p>
              Để thực hiện các quyền liên quan đến dữ liệu cá nhân hoặc gửi câu
              hỏi về chính sách này:
            </p>
            <div className="bg-gray-50 rounded-xl p-3 mt-2 space-y-1">
              <p>
                <strong>Đơn vị vận hành:</strong> {APP_NAME}
              </p>
              <p>
                <strong>Email:</strong>{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-primary underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p>
                <strong>Liên hệ:</strong> {CONTACT_PHONE}
              </p>
            </div>
          </Section>

          <div className="border-t border-gray-100 pt-4 mt-6 flex items-center gap-3 text-xs">
            <Link to="/terms" className="text-primary underline">
              Điều khoản Sử dụng →
            </Link>
            <Link to="/login" className="text-gray-500 underline">
              Về trang đăng nhập
            </Link>
          </div>
        </div>
      </article>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-700 space-y-1">{children}</div>
    </section>
  )
}
