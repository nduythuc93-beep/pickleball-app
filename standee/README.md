# Standee 8FM Pickleball

File standee print-ready cho CLB. Mở bằng Chrome/Safari → preview → in/export PDF.

## File trong thư mục

- `walkin-standee.html` — Standee 60×160cm cho cổng sân (Walk-in conversion)

## Cách dùng

### 1. Preview trên screen

```bash
# Mở bằng Chrome
open standee/walkin-standee.html
```

Trên screen tự scale 40% để vừa màn hình. Click trên zoom để xem chi tiết.

### 2. Tuỳ chỉnh trước khi in

Mở file `walkin-standee.html`, sửa các chỗ này nếu cần:

- **Tên CLB** (line ~233): `8FM Pickleball`
- **Tagline** (line ~234): `Cộng đồng Pickleball`
- **QR URL** (line ~265): thay `pickleball-app-beryl.vercel.app/checkin` thành custom domain nếu đã setup
- **Domain footer** (line ~306): tương tự

### 3. Export sang PDF

**Chrome/Edge:**
1. Mở file `.html`
2. `Cmd+P` (Mac) / `Ctrl+P` (Win)
3. Destination → **Save as PDF**
4. Paper size → **Custom**: 60cm × 160cm
5. Margins → **None**
6. Scale → **100%**
7. ✅ Background graphics
8. Save → gửi file PDF cho printer

**Safari:**
1. Mở file
2. `Cmd+P`
3. PDF → Save as PDF
4. Bottom: **Show Details** → Paper Size → Manage Custom Sizes → tạo "Standee 60×160cm"

### 4. Spec gửi printer

| Mục | Giá trị |
|---|---|
| Kích thước | 60cm × 160cm |
| DPI | 300 |
| Bleed | 3mm mỗi cạnh |
| Material | PP film (chống nước) hoặc Hiflex |
| Format file | PDF/X-1a (chuẩn print) |
| Color mode | CMYK (printer tự convert) |
| Standee frame | Roll-up alloy frame |

### 5. Giá in tham khảo (TP.HCM)

- In + frame roll-up: 600k – 1.2 triệu / cái
- Chỉ in PP film (gắn frame có sẵn): 250k – 400k

Có thể đặt:
- Inpro, Long Vũ (Q3, Q10)
- In trên Shopee: search "standee 60x160"

## QR Code

QR auto-generate từ API `api.qrserver.com` với error correction H (cao nhất, chịu được logo overlay nếu cần).

**Thay URL:** trong file HTML, tìm:
```html
data=https%3A%2F%2Fpickleball-app-beryl.vercel.app%2Fcheckin
```
Encode URL mới (https://www.urlencoder.org/) rồi paste vào.

**Test QR trước khi in:**
- Mở camera điện thoại → quét QR trong file HTML preview
- Phải mở đúng trang `/checkin` của app

## Brand spec (cho design mới sau này)

| Element | Value |
|---|---|
| Primary Emerald | `#1D9E75` |
| Deep Emerald | `#11614A` |
| Dark Emerald | `#0B4334` |
| Amber Accent | `#FBBF24` / `#F59E0B` |
| Pink Soft | `#FCE7F3` |
| Font | Inter (Google Fonts) |
| Weights | 400, 500, 600, 700, 800, 900 |
