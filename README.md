# SGI Portal

SGI Portal là ứng dụng web quản lý đào tạo, học sinh và điểm số cho bốn vai trò: quản trị viên, giáo vụ, giáo viên và học sinh.

Ứng dụng dùng Node.js, Express và PostgreSQL theo cách tổ chức MVC. Giao diện sử dụng HTML, CSS và JavaScript thuần; Tailwind CLI sinh một phần CSS.

## Chức năng chính

| Vai trò | Chức năng |
|---|---|
| Admin | Quản lý giáo vụ, chương trình, môn, lớp, giáo viên, học sinh và phân công |
| Giáo vụ | Quản lý giáo viên, học sinh, lớp–môn, bảng điểm và điểm danh |
| Giáo viên | Xem lớp được phân công, cập nhật điểm, ngày học và điểm danh |
| Học sinh | Xem hồ sơ, chương trình học, công nợ và kết quả |

## Công nghệ

- Node.js với ES modules.
- Express 5 và `express-session`.
- PostgreSQL qua `pg`.
- `bcryptjs` cho mật khẩu.
- HTML, CSS, JavaScript thuần và Tailwind CSS CLI.

Các package Supabase có trong dependency nhưng chưa được import trong source hiện tại.

## Chạy local

### Yêu cầu

- Node.js và npm. Repo chưa khai báo phiên bản tối thiểu.
- PostgreSQL tương thích với schema trong `MVC/database`.
- File `.env` cục bộ.

```env
DATABASE_URL=<chuỗi kết nối PostgreSQL>
SESSION_SECRET=<chuỗi bí mật đủ mạnh>
PORT=3000
NODE_ENV=development
```

Không commit `.env`, mật khẩu hoặc chuỗi kết nối thật.

```powershell
npm install
npm run dev
```

Mặc định: `http://localhost:3000`. Khởi động thông thường và build CSS:

```powershell
npm start
npm run build
```

`npm run build` ghi lại `MVC/public/css/output.css`. Repo chưa có script `test` hoặc `lint`.

## Cấu trúc nhanh

```text
MVC/
├── app.js             # Khởi tạo Express và dependency
├── controllers/       # HTTP handlers theo module
├── database/          # Schema và script cập nhật DB
├── middleware/        # Session
├── models/            # DB và tài khoản
├── public/            # CSS, JS, ảnh
├── routes/            # Route và authorization
├── utils/             # Error, validation, presenter
└── views/             # Login và dashboard
```

## Tài liệu

- [Tổng quan](docs/project-overview.md)
- [Bắt đầu phát triển](docs/getting-started.md)
- [Cấu trúc codebase](docs/codebase-structure.md)
- [Kiến trúc](docs/architecture.md)
- [Modules](docs/modules.md)
- [Database](docs/database.md)
- [API](docs/api.md)
- [Quy trình phát triển](docs/development-workflow.md)
- [Kiểm thử](docs/testing.md)
- [Debugging](docs/debugging.md)
- [Triển khai](docs/deployment-notes.md)
- [Quy ước code](docs/coding-conventions.md)
- [Đóng góp](docs/contribution-guide.md)
- [Kế hoạch QA](qa/test-plan.md)
- [Báo cáo QA](qa/test-report.md)
- [Lỗi đã biết](qa/known-issues.md)

## Production đã xác minh

- URL: <https://sgi-website.onrender.com>
- Ngày kiểm thử: 21/06/2026.
- Public routes, đăng nhập, session, API theo vai trò và luồng điểm đã được kiểm thử.
- Credential kiểm thử không được lưu trong repo.

## An toàn

- Không chạy `create-db.sql` trên DB cần giữ dữ liệu: script xóa schema `public`.
- Không chạy migration/reset/seed nếu chưa xác định đúng môi trường.
- Không ghi secret vào tài liệu hoặc commit.
- Lỗi phát hiện trong QA chỉ được ghi nhận, không sửa trong task này.
