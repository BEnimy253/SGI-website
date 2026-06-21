# Hướng dẫn đóng góp

## Trước khi bắt đầu

- Xác định source, API và database bị ảnh hưởng.
- Không dùng production để thử thay đổi chưa kiểm chứng.

## Khi tạo thay đổi

- Giữ phạm vi nhỏ.
- Không trộn refactor với bug fix nếu không cần.
- Không commit `.env`, cookie, token, password hoặc dump dữ liệu.
- Không cập nhật dependency ngoài phạm vi.
- Không sửa file sinh tự động nếu chưa chạy đúng build.

## Kiểm tra tối thiểu

```powershell
node --check .\MVC\app.js
npm ls --depth=0
```

Sau đó kiểm thử:

- Happy path.
- Input sai và boundary.
- `401`, `403`, `404`, `409`.
- Role khác gọi trực tiếp API.
- Rollback khi thao tác nhiều bước lỗi.
- Console/network và responsive nếu có UI.

## Pull request

Mô tả:

- Mục tiêu và lý do.
- Files/modules thay đổi.
- Database/API compatibility.
- Test đã chạy và kết quả.
- Rủi ro, rollback và phần chưa kiểm thử.

## Thay đổi database

Phải có migration reviewable, backup, rollback và test trên database riêng. Không chạy `create-db.sql` trên dữ liệu cần giữ.
