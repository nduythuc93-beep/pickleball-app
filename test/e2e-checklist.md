# 8FM Pickleball — End-to-End Test Checklist

**Time required:** 30 phút (full) hoặc 10 phút (smoke)
**Mục tiêu:** verify mọi flow trước khi public launch.

## Cách dùng

1. Mở file này trên máy tính, mở app trên điện thoại
2. Đi từng bước, **tick ☑** khi pass
3. Nếu fail: copy error → search trong section **❌ Troubleshoot** ở cuối

---

## 🚦 Quick smoke test (10 phút) — must pass trước public launch

Chỉ làm 5 việc dưới. Pass hết = launch được.

- [ ] **S1.** Tạo tài khoản mới end-to-end (xem [§4 Signup](#4-signup))
- [ ] **S2.** Walk-in từ chế độ ẩn danh (xem [§2 Walk-in](#2-walk-in-no-auth))
- [ ] **S3.** Check-in 1 social session (xem [§7 Check-in](#7-check-in-social))
- [ ] **S4.** Đổi quà → admin confirm → member nhận notification (xem [§10-13](#10-redeem-reward))
- [ ] **S5.** Forgot password → reset → login với mật khẩu mới (xem [§5 Forgot password](#5-forgot-password))

Pass hết 5 cái → tiếp tục full test hoặc launch soft.

---

## ⚙️ Phase 0: Setup (chỉ làm lần đầu, ~5 phút)

### A. Chạy SQL migrations

Vào **Supabase Dashboard → SQL Editor**, mở từng file và Run theo thứ tự:

```
sql/27_skill_level_dupr.sql
sql/28_host_opt_outs.sql
sql/29_get_home_data.sql
sql/30_get_sessions_data.sql
sql/31_notification_cleanup.sql
sql/32_checkin_points_fixes.sql   ← QUAN TRỌNG NHẤT (bug fixes)
sql/33_walkin_ux_fixes.sql
sql/34_phone_validation_10digits.sql
sql/35_signup_friendlier_errors.sql
sql/36_account_deletion.sql
sql/37_walkin_rate_limit.sql
```

- [ ] **0A.** Mỗi file Run thành công không lỗi
- [ ] **0B.** Output cuối mỗi file có dòng verify (✓ check tên function)

**Nếu pg_cron chưa enable** (cần cho 3 cron jobs):
1. Dashboard → Database → Extensions
2. Tìm `pg_cron` → bật
3. Re-run SQL 31, 36, 37

### B. Configure Auth URLs

Dashboard → Authentication → URL Configuration:

- [ ] **0C.** **Site URL**: `https://pickleball-app-beryl.vercel.app` (hoặc custom domain)
- [ ] **0D.** **Redirect URLs** allow list, add:
  - `https://pickleball-app-beryl.vercel.app/reset-password`
  - `https://pickleball-app-beryl.vercel.app/**`

### C. Email templates (optional nhưng nên customize)

Dashboard → Authentication → Email Templates:

- [ ] **0E.** "Confirm signup" — Vietnamese (xem template ở cuối file này)
- [ ] **0F.** "Reset Password" — Vietnamese

---

## 🌍 Phase 1: Public flows (~8 phút)

> Đăng xuất trước khi test public flows. Mở chế độ ẩn danh (Incognito) Chrome trên điện thoại để mô phỏng user mới.

### 1. Landing page

Vào URL gốc `https://pickleball-app-beryl.vercel.app`

- [ ] **1.1.** Redirect về `/login` (vì chưa đăng nhập)
- [ ] **1.2.** Trang Login hiện 🏓 logo + 2 input + nút "Đăng nhập"
- [ ] **1.3.** Footer có 2 link "Điều khoản · Chính sách Bảo mật"
- [ ] **1.4.** Click "Điều khoản" → page mở, có 14 sections
- [ ] **1.5.** Click "Chính sách Bảo mật" → page mở, có 12 sections

### 2. Walk-in (no auth)

Vào `/checkin` (route walk-in landing)

- [ ] **2.1.** Trang hiện 3 lựa chọn: Walk-in (lớn), Signup, Login
- [ ] **2.2.** Tap **"Tham gia Vãng lai"** → form mở
- [ ] **2.3.** Nhập:
  - Họ tên: `Test User`
  - SĐT: `0901234567`
  - Bạn biết qua: `Facebook`
- [ ] **2.4.** Tap "Xác nhận tham gia"
- [ ] **2.5.** Done screen hiện:
  - Header xanh "Xác nhận thành công!"
  - **🔔 Reassurance card** "Host & Admin đã nhận thông tin"
  - Card hiện đúng tên + SĐT + thời gian
- [ ] **2.6.** Nếu hôm nay có social: **📅 Appointment card** hiện với tên buổi, giờ, sân
- [ ] **2.7.** **👫 Mời bạn cùng đi card** hiện (purple gradient)
- [ ] **2.8.** Tap "Chia sẻ" → native share sheet hiện (Zalo, Messenger, ...)

### 3. Walk-in dedup

- [ ] **3.1.** Trên cùng session, walk-in lại với `0901234567` → error message: "Anh/chị đã check-in [tên buổi] rồi..."
- [ ] **3.2.** Nhập SĐT chỉ 9 số `090123456` → error "Số điện thoại không hợp lệ — phải đủ 10 số bắt đầu bằng 0"
- [ ] **3.3.** Nhập SĐT bắt đầu bằng 1 `1234567890` → cùng error

### 4. Signup

Quay về `/login` → tap "Tham gia CLB ngay →"

- [ ] **4.1.** Form 5 input + 2 nút giới tính + collapsible "Thêm thông tin"
- [ ] **4.2.** Nhập:
  - Họ tên: `Test User 2`
  - Email: `your-email+test@gmail.com` (Gmail "+" trick để có inbox riêng)
  - SĐT: `0901234568`
  - Mật khẩu: `test123`
  - Giới tính: Nam
- [ ] **4.3.** Tap "Tham gia CLB"
- [ ] **4.4.** Done screen hiện:
  - Hoặc emerald check "Chào mừng! 🎉" + `🎁 +20 điểm khởi đầu` card
  - Hoặc amber check "📧 Kiểm tra email" + 3-step list
- [ ] **4.5.** Nếu Walk-in trước với `0901234568`: card `👋 Đã link N check-in vãng lai` hiện

**Nếu cần confirm email:**
- [ ] **4.6.** Mở email, click link → tự động login → redirect home

### 5. Forgot password

Vào `/login` → tap "Quên mật khẩu?"

- [ ] **5.1.** Form chuyển sang chỉ Email + "Gửi link đặt lại mật khẩu"
- [ ] **5.2.** Nhập email vừa signup, tap submit
- [ ] **5.3.** Hiện screen "📧 Kiểm tra email" + 3-step ordered list
- [ ] **5.4.** Mở email → có email "Reset Password"
- [ ] **5.5.** Click link trong email → mở `/reset-password`
- [ ] **5.6.** Page hiện form 2 input password + show/hide eye
- [ ] **5.7.** Nhập password mới `newpass123` 2 lần → indicator "✓ Mật khẩu khớp" emerald
- [ ] **5.8.** Tap "Cập nhật mật khẩu" → toast success → redirect `/home`
- [ ] **5.9.** Đăng xuất → login lại với password cũ → error "Email hoặc mật khẩu không đúng"
- [ ] **5.10.** Login với password mới → success

---

## 👤 Phase 2: Member flows (~10 phút)

> Đã login bằng tài khoản test ở §4

### 6. Home page

- [ ] **6.1.** HomePage load < 2s trên 4G
- [ ] **6.2.** Hero greeting "Chào buổi sáng/trưa/tối Test User 👋"
- [ ] **6.3.** Section "Sự kiện sắp tới" hiện 1 hero card (Đánh Social) + 0-2 mini cards
- [ ] **6.4.** Hero card có:
  - Title "Đánh Social"
  - 1 dòng meta: `Mai · 07:00-10:00 · 📍Sân chung · 👥0/16`
  - Progress bar 0%
  - Pill **"Check-in"** (chưa CK) hoặc **"Đã check-in"** (đã CK)
- [ ] **6.5.** "Đổi quà CTA" purple gradient hiện điểm số: `Bạn có 20đ`
- [ ] **6.6.** Stats row 3 cards: Khảo sát · Giải đấu · Điểm của bạn
- [ ] **6.7.** Tournament carousel (nếu có giải đấu open)

### 7. Check-in social

Tap pill **"Check-in"** trên hero card

- [ ] **7.1.** Spinner "Đang check-in..." trên pill
- [ ] **7.2.** Toast `Check-in thành công! +10 điểm 🎉`
- [ ] **7.3.** Pill chuyển thành **"Đã check-in"** + emerald background
- [ ] **7.4.** Avatar mình hiện trong avatar stack
- [ ] **7.5.** Counter `1/16` đã tăng
- [ ] **7.6.** Quay lại trang chính → điểm số tăng từ 20đ → 30đ

### 8. Tap card → SessionDetailPage

Tap toàn bộ hero card (không phải pill)

- [ ] **8.1.** Navigate `/sessions/<id>`
- [ ] **8.2.** Hero gradient có activity icon + title + date + time + venue + count
- [ ] **8.3.** **3-col info bar**: Phí Social | ✓ Đã check-in | +10 điểm
- [ ] **8.4.** Cancel row hiện: `✓ Đã check-in lúc [time] · +10đ` + nút `Huỷ` đỏ
- [ ] **8.5.** Section **Host & HLV của buổi** (nếu CLB có host/coach)
- [ ] **8.6.** **Attendees list** có tên mình

### 9. Cancel check-in (free window)

> Test này chỉ work nếu session bắt đầu > 3h nữa

- [ ] **9.1.** Tap "Huỷ" → confirm "Huỷ check-in?" → OK
- [ ] **9.2.** Toast "Đã huỷ check-in"
- [ ] **9.3.** Pill chuyển về "Check-in", counter giảm
- [ ] **9.4.** Quay lại home → **điểm giảm 10** (verify bug #1 fixed)

### 10. Redeem reward

Tap "Đổi điểm lấy quà" → /rewards

- [ ] **10.1.** Hero gradient + điểm hiện tại
- [ ] **10.2.** Grid 2-col cards quà
- [ ] **10.3.** Quà rẻ nhất < điểm mình → button "Đổi" enable
- [ ] **10.4.** Quà đắt hơn điểm → button "Thiếu Nđ" disabled
- [ ] **10.5.** Tap "Đổi" → modal "Xác nhận đổi quà"
- [ ] **10.6.** Modal hiện preview: Điểm hiện có / Chi phí / Còn lại
- [ ] **10.7.** Tap "Đổi Nđ" → spinner → toast: `🎉 Đã đặt "[tên quà]" · còn Mđ`
- [ ] **10.8.** **Auto-redirect** /redemptions
- [ ] **10.9.** Pending row hiện: badge amber "Chờ giao" + amber hint card "⏳ Liên hệ Admin / Host tại sân để nhận"

### 11. Profile + edit

Tap "Thành viên" tab → tap card "Hồ sơ của bạn"

- [ ] **11.1.** MemberDetailPage hiện
- [ ] **11.2.** Avatar + tên + skill badge + role
- [ ] **11.3.** Tap Pencil icon → edit mode
- [ ] **11.4.** Đổi bio → "Test bio" → Save → toast "Đã lưu"
- [ ] **11.5.** Scroll xuống cuối: **Khu vực nguy hiểm** với nút đỏ "Yêu cầu xoá tài khoản"
  (Đừng tap! Test ở phase 5.)

---

## 🛡️ Phase 3: Admin flows (~5 phút)

> Cần login bằng tài khoản admin (anh + chị Kế toán trưởng)

### 12. Notification bell

- [ ] **12.1.** Bell icon trên TopBar có badge đỏ với số (nếu có notif)
- [ ] **12.2.** Bell có wiggle animation khi có unread
- [ ] **12.3.** Tap bell → dropdown slide down từ trên
- [ ] **12.4.** Header có gradient + 2 filter pills "Tất cả · N" / "Chưa đọc M"
- [ ] **12.5.** Notif "🎁 Đổi quà — chờ xác nhận" hiện với pink icon + bold title
- [ ] **12.6.** Tap notif → mark as read + navigate `/admin`

### 13. Confirm redemption

Vào /admin → tab "🎁 Quà" → sub-tab "✓ Đổi quà"

- [ ] **13.1.** Sub-tab có badge amber pulsing với số pending
- [ ] **13.2.** List hiện redemption mới từ §10
- [ ] **13.3.** Row có pink Gift icon + tên quà + tên member + cost
- [ ] **13.4.** Tap "Đánh dấu đã giao" → toast → status đổi sang "Đã giao" emerald
- [ ] **13.5.** Logout → login lại với tài khoản đã đổi quà:
- [ ] **13.6.** Notification bell có notif mới: "✅ Quà đã sẵn sàng"
- [ ] **13.7.** Vào /redemptions → row đã đổi sang emerald "Đã nhận lúc..."

### 14. Walk-in management

Login admin lại → /admin → tab "👋 Vãng lai"

- [ ] **14.1.** Stats row: Tổng / SĐT unique / Chưa member / Đã convert
- [ ] **14.2.** List walk-ins gần nhất hiện
- [ ] **14.3.** Filter chips: Tất cả / Chưa convert / Đã convert
- [ ] **14.4.** Search box → gõ tên test → list filter
- [ ] **14.5.** Export CSV → file download

### 15. Quick session management

Tab "🏓 Đánh tập"

- [ ] **15.1.** List sessions sắp tới
- [ ] **15.2.** Tap "Sửa" → modal mở → đổi venue → Save
- [ ] **15.3.** Auto-gen sessions tới 7 ngày

---

## 🚨 Phase 4: Anti-abuse (~5 phút)

### 16. Phone validation edge cases

Mở `/checkin` ẩn danh, tap walk-in:

- [ ] **16.1.** `0901234567` (10 số) → pass
- [ ] **16.2.** `0901 234 567` (có space) → pass (auto strip)
- [ ] **16.3.** `0901-234-567` → pass
- [ ] **16.4.** `0123` → fail "10 số bắt đầu bằng 0"
- [ ] **16.5.** `1901234567` (không bắt đầu 0) → fail
- [ ] **16.6.** `09012345678` (11 số) → fail
- [ ] **16.7.** `abcdefghij` → fail

### 17. Honeypot trap

Mở `/checkin` → Walk-in form → mở DevTools (F12):

- [ ] **17.1.** Inspect form → tìm `<input id="company-website">` hidden
- [ ] **17.2.** Trong DevTools Console, gõ:
  ```js
  document.getElementById('company-website').value = 'spam-bot'
  ```
- [ ] **17.3.** Fill form bình thường → Submit
- [ ] **17.4.** Page chuyển sang Done **NHƯNG** Supabase Dashboard → walk_in_checkins **không có row mới** (silent block)

### 18. Rate limit IP

Trong 1 giờ, từ cùng device, walk-in 5 lần:

- [ ] **18.1.** Submit 4 attempts với 4 SĐT khác nhau → 4 success
- [ ] **18.2.** Submit attempt thứ 5 → error: `"Có quá nhiều lượt check-in từ thiết bị này. Vui lòng thử lại sau 1 giờ..."`
- [ ] **18.3.** Verify trong Supabase: 
  ```sql
  SELECT * FROM walk_in_rate_limits 
  WHERE was_blocked = true 
  ORDER BY attempted_at DESC LIMIT 5;
  ```
  → có row mới với `block_reason = 'ip_rate_limit'`

### 19. Rate limit per-phone

- [ ] **19.1.** Submit cùng SĐT vào 3 sessions khác nhau (hôm nay + tomorrow + day after)
- [ ] **19.2.** Submit lần thứ 4 (vào session 4 hoặc thử lại session cũ) → error: `"SĐT này đã check-in quá nhiều buổi..."`

---

## ⚠️ Phase 5: Account deletion (~3 phút)

> **DÙNG TÀI KHOẢN TEST**, KHÔNG dùng admin chính!

Login tài khoản test ở §4 → Profile mình → scroll xuống cuối:

### 20. Multi-step deletion modal

- [ ] **20.1.** Tap "Yêu cầu xoá tài khoản" → modal step 1 mở
- [ ] **20.2.** Step 1: red alert + 2 lists (mất / giữ) + link to /privacy /terms
- [ ] **20.3.** Tap "Tôi đã đọc, tiếp tục" → step 2
- [ ] **20.4.** Step 2: gõ "xoa tai khoan" (sai) → "Chưa khớp" + button disabled
- [ ] **20.5.** Gõ chính xác **XOÁ TÀI KHOẢN** → button enable
- [ ] **20.6.** Tap "Tiếp tục" → step 3 final
- [ ] **20.7.** Step 3: trash icon + "Sẵn sàng xoá tài khoản?"
- [ ] **20.8.** Tap "Xoá vĩnh viễn" → spinner → toast "Tài khoản đã được xoá. Cảm ơn 🙏"
- [ ] **20.9.** Tự động redirect `/login`

### 21. Verify anonymization

Login bằng admin → /admin → tab "👥 Thành viên" → check toggle "Hiện cả thành viên đã tắt":

- [ ] **21.1.** Tìm member test bị "Đã xoá tài khoản" + phone NULL
- [ ] **21.2.** Trong DB:
  ```sql
  SELECT full_name, email, phone, is_active, deletion_requested_at
  FROM members WHERE id = '<test-member-id>';
  ```
  → full_name = "Đã xoá tài khoản", email = "deleted-<uuid>@deleted.local", is_active = false

- [ ] **21.3.** Login lại bằng email test → fail "Email hoặc mật khẩu không đúng"

### 22. Admin restore (in 30 days)

> Chỉ test nếu muốn — admin có thể restore trong grace period

```sql
SELECT public.cancel_deletion_request('<test-member-id>');
```

- [ ] **22.1.** Function return success
- [ ] **22.2.** Member is_active = true lại, nhưng full_name vẫn "Đã xoá tài khoản" (cần member liên hệ admin để update lại)

---

## 🎉 Wrap-up checklist

Final go/no-go criteria:

- [ ] **W1.** Tất cả [Quick smoke test](#-quick-smoke-test-10-phút--must-pass-trước-public-launch) (S1-S5) pass
- [ ] **W2.** §16 phone validation pass cả 7 cases
- [ ] **W3.** §17 honeypot block bot
- [ ] **W4.** §18-19 rate limit hoạt động
- [ ] **W5.** Test trên iPhone Safari + Android Chrome thật (không chỉ desktop)
- [ ] **W6.** Standee in thử 1 cái → QR scan đúng → màu OK → kích thước OK
- [ ] **W7.** Vercel deployment URL accessible từ 4G

→ **Tất cả pass = SẴN SÀNG PUBLIC LAUNCH** 🚀

---

## ❌ Troubleshoot

### "Failed to fetch dynamically imported module"
→ Service worker cache stale. RouteErrorBoundary tự catch. User tap "Tải lại".

Fix: 
```js
// trong DevTools Console:
caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
// rồi reload
```

### Email confirmation không tới
1. Check Spam folder
2. Supabase Dashboard → Auth → Email Templates: verify template không trống
3. Free tier limit 3 emails/h — chờ 1h hoặc upgrade Pro

### `/reset-password` báo "Link đã hết hạn" dù vừa click
1. Check Supabase Dashboard → Auth → URL Configuration:
   - Site URL đúng production domain?
   - Redirect URLs allow list có `/reset-password`?

### Rate limit không trigger
1. Verify SQL 37 đã run: `SELECT * FROM pg_proc WHERE proname = 'get_client_ip';`
2. Check ENV: PostgREST có forward request headers không? (Supabase default = yes)
3. Test query trực tiếp trong SQL Editor:
   ```sql
   SELECT public.get_client_ip();
   ```

### Rewards/Đổi quà không có notification
1. Verify SQL 32 đã run: `SELECT * FROM pg_trigger WHERE tgname = 'trg_notify_admins_redemption';`
2. Test trigger: insert giả vào reward_redemptions → query notifications table

### pg_cron jobs không chạy
1. Dashboard → Database → Extensions → bật `pg_cron`
2. Query check:
   ```sql
   SELECT jobname, schedule, active FROM cron.job;
   ```
3. Nếu rỗng: re-run SQL 31, 36, 37

---

## 📧 Email templates (copy vào Supabase Dashboard)

### Confirm Signup
```
Subject: 8FM Pickleball — Xác nhận email

Chào anh/chị,

Cảm ơn anh/chị đã đăng ký tài khoản 8FM Pickleball.

Click link bên dưới để xác nhận email và bắt đầu sử dụng app:

{{ .ConfirmationURL }}

Link có hiệu lực trong 24 giờ.

Nếu không phải anh/chị đăng ký, vui lòng bỏ qua email này.

— 8FM Pickleball
```

### Reset Password
```
Subject: 8FM Pickleball — Đặt lại mật khẩu

Chào anh/chị,

Anh/chị nhận được email này vì có yêu cầu đặt lại mật khẩu
cho tài khoản 8FM Pickleball.

Click link bên dưới để đặt mật khẩu mới (có hiệu lực 1 giờ):

{{ .ConfirmationURL }}

Nếu không phải anh/chị yêu cầu, vui lòng bỏ qua email này
hoặc liên hệ Admin/Host tại sân để được hỗ trợ.

— 8FM Pickleball
```

---

## 📊 Test report

Khi xong, ghi lại:

```
Test ngày: __________
Tester: __________
Device: iPhone __ / Android __
Browser: Safari / Chrome / Firefox __

Smoke pass: __ / 5
Full pass: __ / 22
Bugs found:
1. ___________________________________________________________
2. ___________________________________________________________
3. ___________________________________________________________

Verdict: 🟢 LAUNCH READY  /  🟡 LAUNCH WITH FIXES  /  🔴 BLOCK
```
