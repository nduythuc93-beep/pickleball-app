# Test Suite

End-to-end manual testing kit cho 8FM Pickleball trước public launch.

## Files

- **`e2e-checklist.md`** — Full E2E test (~30 phút) hoặc smoke test (~10 phút)
- **`sample-queries.sql`** — SQL verification queries cho Supabase Dashboard

## Quick start

1. Mở `e2e-checklist.md` trên máy tính
2. Mở app trên điện thoại (Chrome/Safari thật, không emulator)
3. Đi từng bước, tick ☑ khi pass
4. Dùng `sample-queries.sql` ở Supabase SQL Editor để verify state

## Strategy

| Khi nào | Test gì |
|---|---|
| Trước public launch | **Smoke test** (10 phút, 5 việc) — MUST pass |
| Sau mỗi đợt deploy lớn | Smoke test |
| Mỗi 2 tuần | Full E2E (30 phút) |
| Khi có user báo bug | Section liên quan |

## Test accounts cần chuẩn bị

| Tài khoản | Mục đích |
|---|---|
| Admin chính (anh) | Test admin flows |
| Member thường (chị Kế toán hoặc 1 member khác) | Test member flows |
| **Test account throwaway** | Test account deletion (xoá xong không khôi phục) |
| Email Gmail "+" trick | Tạo nhiều account với 1 inbox: `you+test1@gmail.com`, `you+test2@gmail.com`, ... |

## Khi nào skip test nào

- **Skip §9 cancel-with-penalty**: nếu trong 24h sắp tới không có session nào < 3h
- **Skip §22 admin restore**: chỉ cần test khi có yêu cầu cụ thể từ user
- **Skip §15 admin session edit**: nếu không đụng tới session schedules

## Sau khi test xong

Ghi kết quả vào "Test report" section ở cuối `e2e-checklist.md` rồi commit:

```bash
git add test/e2e-checklist.md
git commit -m "test: e2e checklist run YYYY-MM-DD — N/22 pass"
git push
```
