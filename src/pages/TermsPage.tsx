import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'

const LAST_UPDATED = '10/06/2026'
const APP_NAME = '8FM Pickleball'
const CONTACT_EMAIL = 'contact@8fmpickleball.vn'

/**
 * Terms of Use — for the CLB pickleball web app.
 * Public page, no auth required.
 */
export function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <FileText className="w-4 h-4 text-primary" />
          <h1 className="text-base font-bold">Điều khoản Sử dụng</h1>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-4 py-6 text-sm leading-relaxed text-gray-700">
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
          <p className="text-xs text-gray-500">
            Cập nhật lần cuối: <strong>{LAST_UPDATED}</strong>
          </p>

          <section>
            <p>
              Chào mừng anh/chị đến với {APP_NAME}. Các điều khoản này quy định
              việc sử dụng web app {APP_NAME} ("dịch vụ"). Bằng việc đăng ký tài
              khoản hoặc sử dụng dịch vụ, anh/chị đồng ý tuân thủ các điều khoản
              dưới đây.
            </p>
          </section>

          <Section title="1. Định nghĩa">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>"App" / "Dịch vụ":</strong> Web app {APP_NAME} và các
                chức năng liên quan
              </li>
              <li>
                <strong>"CLB":</strong> Câu lạc bộ {APP_NAME}, đơn vị vận hành
              </li>
              <li>
                <strong>"Thành viên":</strong> Người đã đăng ký tài khoản và
                được CLB xác nhận
              </li>
              <li>
                <strong>"Vãng lai":</strong> Người check-in qua QR mà chưa đăng
                ký tài khoản
              </li>
              <li>
                <strong>"Điểm":</strong> Đơn vị tích luỹ trong app, dùng để đổi
                quà
              </li>
            </ul>
          </Section>

          <Section title="2. Đăng ký tài khoản">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Anh/chị phải đủ <strong>16 tuổi</strong> trở lên để tự đăng ký.
                Dưới 16 cần có sự đồng ý của cha mẹ/người giám hộ.
              </li>
              <li>
                Thông tin đăng ký phải <strong>chính xác và đầy đủ</strong>.
                Mỗi người chỉ được tạo một tài khoản.
              </li>
              <li>
                Anh/chị có trách nhiệm bảo mật mật khẩu. CLB không chịu trách
                nhiệm nếu tài khoản bị truy cập trái phép do anh/chị tiết lộ
                mật khẩu.
              </li>
              <li>
                Khi đăng ký, anh/chị được tặng <strong>20 điểm khởi đầu</strong>{' '}
                và lịch sử check-in vãng lai (nếu có) sẽ được liên kết.
              </li>
            </ol>
          </Section>

          <Section title="3. Quy định Check-in">
            <p className="mb-2">
              <strong>3.1. Member check-in:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Mỗi buổi đánh được tích điểm tương ứng (mặc định +10đ/buổi
                social)
              </li>
              <li>
                <strong>Huỷ check-in:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Trước 3h giờ bắt đầu: miễn phí, không bị trừ</li>
                  <li>Từ -3h đến +1h sau giờ bắt đầu: bị trừ 10 điểm</li>
                  <li>Sau +1h từ giờ bắt đầu: không thể huỷ</li>
                </ul>
              </li>
              <li>
                <strong>Cảnh cáo:</strong> Nếu check-in nhưng không tham gia,
                Host/Admin có thể đánh dấu cảnh cáo và trừ 50% điểm buổi đó.
              </li>
            </ul>
            <p className="mt-3 mb-2">
              <strong>3.2. Walk-in vãng lai:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Check-in nhanh qua QR, chỉ cần họ tên + số điện thoại</li>
              <li>
                Mỗi SĐT chỉ check-in một lần cho mỗi buổi cùng ngày
              </li>
              <li>
                Vãng lai không nhận điểm thưởng. Để nhận điểm, vui lòng đăng ký
                thành viên.
              </li>
            </ul>
          </Section>

          <Section title="4. Hệ thống Điểm thưởng">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Điểm tích luỹ <strong>không có giá trị tiền mặt</strong>, không
                được mua bán hoặc chuyển nhượng giữa các thành viên.
              </li>
              <li>
                Điểm có thể dùng để đổi quà trong catalog của CLB.
              </li>
              <li>
                CLB có quyền <strong>điều chỉnh điểm</strong> trong trường hợp
                phát hiện gian lận, lạm dụng, hoặc lỗi kỹ thuật.
              </li>
              <li>
                Trường hợp tài khoản bị khoá, điểm còn lại sẽ không được hoàn
                trả.
              </li>
            </ul>
          </Section>

          <Section title="5. Đổi quà">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Thành viên đổi quà → đơn chuyển sang trạng thái{' '}
                <strong>"Chờ xác nhận"</strong>.
              </li>
              <li>
                Admin/Host xác nhận và giao quà tại sân trong khung giờ hoạt
                động của CLB.
              </li>
              <li>
                Sau khi quà được giao, đơn chuyển sang{' '}
                <strong>"Đã nhận"</strong> và không thể huỷ.
              </li>
              <li>
                Trong trường hợp hết hàng hoặc lỗi, Admin sẽ huỷ đơn và{' '}
                <strong>hoàn lại 100% điểm</strong>.
              </li>
              <li>
                Quà đã giao không được đổi trả trừ trường hợp lỗi từ phía CLB.
              </li>
            </ol>
          </Section>

          <Section title="6. Đăng ký Giải đấu">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Chỉ thành viên đã đăng ký tài khoản mới có thể đăng ký giải
                đấu.
              </li>
              <li>
                Đối với giải đôi, đối tác (partner) phải đồng ý xác nhận trong
                app.
              </li>
              <li>
                CLB có quyền từ chối đăng ký trong trường hợp giải đấu đã đầy
                hoặc thành viên vi phạm điều khoản.
              </li>
              <li>
                Thành viên có thể rút lui (withdraw) trước thời hạn được công
                bố cho từng giải.
              </li>
            </ul>
          </Section>

          <Section title="7. Trách nhiệm của Thành viên">
            <p>Khi sử dụng dịch vụ, anh/chị cam kết:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Cung cấp thông tin chính xác, không giả mạo</li>
              <li>
                Tuân thủ nội quy CLB tại sân (giờ giấc, an toàn, văn hoá ứng xử)
              </li>
              <li>Tôn trọng các thành viên khác, Host, Coach và Admin</li>
              <li>Không sử dụng app cho mục đích bất hợp pháp</li>
              <li>Tự chịu trách nhiệm về an toàn cá nhân khi tham gia</li>
            </ul>
          </Section>

          <Section title="8. Hành vi bị cấm">
            <p>Nghiêm cấm các hành vi sau:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Tạo nhiều tài khoản để gian lận điểm thưởng hoặc lượt đổi quà
              </li>
              <li>Mua bán, chuyển nhượng tài khoản hoặc điểm</li>
              <li>Sử dụng bot, script tự động để check-in hoặc tích điểm</li>
              <li>
                Đánh cắp, sao chép dữ liệu của thành viên khác hoặc của CLB
              </li>
              <li>
                Sử dụng app để quảng cáo, spam mà không có sự cho phép của CLB
              </li>
              <li>
                Cố ý phá hoại hệ thống hoặc khai thác lỗ hổng bảo mật
              </li>
            </ul>
          </Section>

          <Section title="9. Khoá/Xoá tài khoản">
            <p className="mb-2">
              <strong>9.1. CLB có quyền khoá tài khoản khi:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Phát hiện vi phạm điều khoản tại mục 7 và 8</li>
              <li>Thành viên không hoạt động trong 12 tháng liên tiếp</li>
              <li>Yêu cầu của cơ quan có thẩm quyền</li>
            </ul>
            <p className="mt-3 mb-2">
              <strong>9.2. Anh/chị có quyền:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Yêu cầu xoá tài khoản bằng cách liên hệ với CLB qua email hoặc
                Host tại sân
              </li>
              <li>
                Sau khi xác minh, CLB sẽ xoá tài khoản trong vòng{' '}
                <strong>30 ngày</strong>
              </li>
              <li>
                Lịch sử check-in được giữ lại dưới dạng <strong>ẩn danh</strong>{' '}
                cho mục đích thống kê CLB
              </li>
            </ul>
          </Section>

          <Section title="10. Sở hữu trí tuệ">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Toàn bộ nội dung, thiết kế, mã nguồn của app thuộc sở hữu của{' '}
                {APP_NAME}.
              </li>
              <li>
                Logo CLB là tài sản của {APP_NAME}, không được sử dụng cho mục
                đích thương mại khác mà không có sự cho phép.
              </li>
              <li>
                Nội dung do thành viên đăng tải (trả lời khảo sát, v.v.) vẫn
                thuộc về thành viên, nhưng CLB có quyền sử dụng cho mục đích vận
                hành dịch vụ.
              </li>
            </ul>
          </Section>

          <Section title="11. Miễn trừ trách nhiệm">
            <p>
              {APP_NAME} cung cấp dịch vụ "nguyên trạng" (as-is). Trong phạm vi
              tối đa pháp luật cho phép, CLB không chịu trách nhiệm về:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Gián đoạn dịch vụ do sự cố kỹ thuật, bảo trì, hoặc nguyên nhân
                khách quan
              </li>
              <li>Thiệt hại gián tiếp phát sinh từ việc sử dụng dịch vụ</li>
              <li>
                Hành vi của bên thứ ba (thành viên khác, đối tác giải đấu, v.v.)
              </li>
              <li>
                Chấn thương cá nhân khi tham gia các hoạt động thể thao tại CLB
              </li>
            </ul>
          </Section>

          <Section title="12. Thay đổi Dịch vụ và Điều khoản">
            <p>
              CLB có quyền thay đổi tính năng, điều khoản, hoặc dừng cung cấp
              dịch vụ với thông báo trước ít nhất <strong>7 ngày</strong> qua
              email hoặc thông báo trong app.
            </p>
            <p className="mt-2">
              Việc tiếp tục sử dụng dịch vụ sau ngày hiệu lực của điều khoản mới
              được coi là anh/chị đã đồng ý với các thay đổi đó.
            </p>
          </Section>

          <Section title="13. Giải quyết tranh chấp">
            <p>
              Điều khoản này được điều chỉnh và giải thích theo{' '}
              <strong>pháp luật Việt Nam</strong>.
            </p>
            <p className="mt-2">
              Mọi tranh chấp phát sinh sẽ được ưu tiên giải quyết bằng thương
              lượng. Trường hợp không đạt được thoả thuận, tranh chấp sẽ được
              đưa ra <strong>Toà án có thẩm quyền tại Thành phố Hồ Chí
              Minh</strong>.
            </p>
          </Section>

          <Section title="14. Liên hệ">
            <p>Mọi câu hỏi về điều khoản này, vui lòng liên hệ:</p>
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
                <strong>Liên hệ trực tiếp:</strong> Host tại sân
              </p>
            </div>
          </Section>

          <div className="border-t border-gray-100 pt-4 mt-6 flex items-center gap-3 text-xs">
            <Link to="/privacy" className="text-primary underline">
              Chính sách Bảo mật →
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
