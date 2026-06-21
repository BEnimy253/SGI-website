# Quy ước code

## JavaScript

- ES modules (`import`/`export`).
- Class dùng PascalCase; private fields dùng `#`.
- File/module dùng kebab-case.
- Dependency truyền qua constructor.
- Async route bọc bằng `route.asyncRoute`.

## Route và quyền

- URL tập trung trong `Route`.
- Page dùng `requireLogin`.
- API dùng `requireApiLogin` hoặc `requireRole`.
- Không chỉ ẩn UI; luôn kiểm tra quyền phía server.

## Input và lỗi

- Parse ID/số/enum bằng `Values`.
- Chuỗi bắt buộc dùng `requiredText`.
- Query SQL dùng parameter `$1`, `$2`, không nối chuỗi input.
- Lỗi nghiệp vụ tạo bằng `http.createError(status, message)`.
- API trả `{ "message": "..." }` khi lỗi.

## Database

- Thao tác nhiều bước dùng `withAppContext`.
- Luôn rollback khi lỗi.
- Đánh giá trigger trước khi cập nhật bảng.
- Không thay schema bằng query runtime.

## Frontend

- Escape nội dung động bằng `escapeHtml`/`escapeAttr`.
- Gọi API qua helper chung.
- Render loading/empty/error.
- Tên field camelCase ở request; row DB thường snake_case trong management overview.

## Tài liệu

- Viết tiếng Việt.
- Chỉ ghi thông tin xác minh được.
- Không ghi secret/credential.
- Phần chưa biết ghi “Chưa xác định trong repo hiện tại”.
