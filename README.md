# SGI Website

SGI Website là ứng dụng web quản lý học sinh và điểm số cho môi trường đào tạo. Dự án hỗ trợ đăng nhập theo vai trò, hiển thị dashboard phù hợp với từng người dùng và cung cấp các thao tác quản lý cơ bản cho nhà trường.

Tài liệu này mô tả cách sử dụng và chạy project. Không trình bày thiết kế database hoặc UML.

## Chức năng chính

- Đăng nhập bằng tài khoản được phân quyền.
- Admin quản lý tài khoản giáo vụ, giáo viên và học sinh.
- Giáo vụ quản lý tài khoản giáo viên và học sinh.
- Giáo vụ/Admin quản lý lớp học, thông tin học sinh và thông tin giáo viên.
- Giáo viên xem các lớp được phân công, xem danh sách học sinh trong lớp và cập nhật điểm khi lớp đang mở.
- Học sinh xem thông tin cá nhân, danh sách môn học, điểm tổng và chi tiết điểm từng môn.

## Vai trò người dùng

- `Admin`: quản trị tài khoản và dữ liệu vận hành.
- `Giáo vụ`: quản lý giáo viên, học sinh và lớp học.
- `Giáo viên`: xem lớp được phân công và cập nhật điểm học sinh.
- `Học sinh`: xem hồ sơ cá nhân và điểm số.

## Công nghệ sử dụng

- Node.js
- Express
- PostgreSQL/Supabase
- `pg` để kết nối database
- `bcryptjs` để kiểm tra mật khẩu
- `express-session` để quản lý phiên đăng nhập
- HTML, CSS và JavaScript thuần cho giao diện

## Cấu trúc thư mục

```text
SGI-website/
├── database/              # Các file query SQL phục vụ khởi tạo, dữ liệu mẫu và kiểm tra dữ liệu
├── public/                # Tài nguyên public, CSS và JavaScript phía client
├── src/                   # Source code backend
│   ├── db.js              # Kết nối database
│   └── server.js          # Express server và API
├── views/                 # File HTML giao diện
├── package.json
└── README.md
```

## Yêu cầu môi trường

- Node.js phiên bản mới.
- Supabase hoặc PostgreSQL đã được chuẩn bị dữ liệu cho project.
- File `.env` ở thư mục gốc.

Ví dụ `.env`:

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=your-session-secret
PORT=3000
```

## Cài đặt

```bash
npm install
```

## Chạy project

Chạy ở chế độ thường:

```bash
npm start
```

Chạy ở chế độ tự reload khi sửa code:

```bash
npm run dev
```

Sau khi chạy, mở trình duyệt tại:

```text
http://localhost:3000
```

Nếu bạn đặt `PORT` khác trong `.env`, hãy dùng đúng cổng đó.

## Build CSS

Project hiện có script build CSS:

```bash
npm run build
```

Chạy watch CSS khi phát triển:

```bash
npm run css
```

## Tài khoản mẫu

Nếu đã chạy các query dữ liệu mẫu, có thể dùng một số tài khoản sau:

```text
admin001 / 123456
academic001 / 123456
academic002 / 123456
teacher003 / 123456
teacher004 / 123456
student005 / 123456
student006 / 123456
```

## Luồng sử dụng nhanh

1. Mở trang đăng nhập.
2. Đăng nhập bằng tài khoản theo vai trò.
3. Dashboard sẽ tự hiển thị đúng chức năng của vai trò đó.
4. Admin hoặc Giáo vụ có thể vào các tab quản lý để thêm, sửa, xóa dữ liệu.
5. Giáo viên chọn lớp được phân công để xem học sinh và cập nhật điểm.
6. Học sinh xem hồ sơ và điểm số của chính mình.

## Kiểm tra nhanh

Kiểm tra kết nối server:

```text
http://localhost:3000/db-test
```

Kiểm tra cú pháp JavaScript:

```bash
node --check src/server.js
node --check public/dashboard.js
```

## Ghi chú phát triển

- Không commit file `.env` vì chứa thông tin nhạy cảm.
- Dữ liệu đăng nhập phụ thuộc vào database đang kết nối qua `DATABASE_URL`.
- Khi Supabase vừa khởi động lại, lần kết nối đầu tiên có thể mất vài giây.
- Nên kiểm tra từng vai trò sau khi sửa API hoặc giao diện dashboard.
