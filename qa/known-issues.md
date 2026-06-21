# Lỗi đã biết

## QA-001 — Thông báo lỗi đăng nhập không hiển thị

| Thuộc tính | Giá trị |
|---|---|
| Severity | Medium |
| Môi trường | Production, 21/06/2026 |
| Trạng thái | Open |

### Tái hiện

Đăng nhập bằng username không tồn tại, password sai hoặc account block.

### Mong đợi

Trang hiển thị thông báo tương ứng.

### Thực tế

Server dùng `wrong_username`, `wrong_password`, `blocked`; frontend chỉ tra `username`, `password`, `status`, nên error box vẫn ẩn.

## QA-002 — Login làm lộ username có tồn tại

| Thuộc tính | Giá trị |
|---|---|
| Severity | Medium |
| Môi trường | Production, 21/06/2026 |
| Trạng thái | Open |

### Tái hiện

So sánh login với username không tồn tại và username hợp lệ/password sai.

### Mong đợi

Phản hồi tổng quát.

### Thực tế

Redirect khác nhau: `wrong_username` và `wrong_password`, cho phép account enumeration.

## QA-003 — `/db-test` đang public

| Thuộc tính | Giá trị |
|---|---|
| Severity | Low |
| Môi trường | Production, 21/06/2026 |
| Trạng thái | Open |

### Tái hiện

Không đăng nhập, mở `/db-test`.

### Mong đợi

Endpoint bị tắt/bảo vệ hoặc chỉ trả health tối thiểu.

### Thực tế

Trả `200`, thông báo DB kết nối thành công và thời gian database.

## QA-004 — Thiếu security headers cơ bản

| Thuộc tính | Giá trị |
|---|---|
| Severity | Medium |
| Môi trường | Production, 21/06/2026 |
| Trạng thái | Open |

### Tái hiện

Kiểm tra response headers của `GET /login`.

### Mong đợi

Có HSTS, CSP, clickjacking, MIME sniffing và referrer policy phù hợp.

### Thực tế

Không thấy `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.

Các lỗi chỉ được ghi nhận; không sửa source hoặc production config.
