# SGI Portal

SGI Portal là hệ thống quản lý đào tạo dành cho trường SGI, gồm quản lý tài
khoản, hồ sơ, ngành học, chương trình theo học kỳ, lớp học, phân công giảng
dạy, điểm danh, điểm số, học phí và công nợ.

## Chức năng chính

### Tài khoản và phân quyền

Hệ thống có bốn vai trò:

- `admin`: quản trị toàn bộ dữ liệu.
- `academic_executor`: giáo vụ, quản lý giáo viên, học sinh, phân công và bảng
  điểm.
- `teacher`: xem các lớp - môn được phân công, điểm danh và cập nhật điểm.
- `student`: xem hồ sơ, tiến độ học, công nợ và kết quả từng môn.

Tài khoản chỉ có hai trạng thái:

- `active`: được phép đăng nhập.
- `block`: bị khóa đăng nhập.

Ngoại trừ admin, mọi tài khoản đều có hồ sơ gồm họ và tên lót, tên, ngày sinh,
giới tính, số điện thoại và email.

### Đào tạo

- Quản lý ngành bằng mã ngành và tên ngành.
- Mỗi ngành có tổng số học kỳ và học phí mặc định mỗi kỳ.
- Môn học có mã môn, tên môn, tổng số tiết và số tín chỉ.
- Chương trình học ánh xạ môn học vào từng ngành và từng học kỳ.
- Hỗ trợ học kỳ chính và học kỳ bổ sung.
- Lớp học gắn với ngành, khóa, năm bắt đầu, năm kết thúc và tổng số học kỳ.
- Giáo viên được phân công theo từng lớp - môn, không phải giáo viên chủ nhiệm.

### Học sinh và học phí

Hồ sơ học sinh lưu:

- Lớp và khóa.
- Năm bắt đầu, năm kết thúc.
- Học kỳ hiện tại, tổng số học kỳ.
- Học kỳ đã đóng học phí gần nhất.
- Học phí mỗi kỳ.
- Công nợ tự động.

Công thức:

```text
công nợ =
  max(học kỳ hiện tại - học kỳ đã đóng, 0)
  × học phí mỗi kỳ
```

### Điểm danh và điểm số

Mỗi lớp - môn được tự động tạo đủ số buổi học:

```text
ceil(tổng số tiết / 5)
```

Mỗi buổi tương ứng một cột và mặc định có 5 tiết. Ngày học ban đầu để trống;
admin, giáo vụ và giáo viên được phân công có thể cập nhật ngày trực tiếp trên
tiêu đề cột. Giao diện không cho thêm hoặc xóa cột thủ công.

- Để trống: không vắng.
- `K`: vắng không phép.
- `P`: vắng có phép.
- `M`: đi trễ.

`K` và `P` được tính vào tổng số buổi vắng; `M` không được tính là vắng.

Các cột điểm:

- `KTTX1`, `KTTX2`
- `KTĐK1`, `KTĐK2`
- `KTM1`, `KTM2`

Quy tắc khóa điểm:

- Môn dưới 4 tín chỉ: chỉ nhập `KTTX1`, `KTĐK1`, `KTM1`.
- Môn từ 4 tín chỉ: nhập `KTTX1`, `KTTX2`, `KTĐK1`, `KTM1`.
- `KTĐK2` được lưu trong schema để mở rộng nhưng hiện luôn khóa.
- `KTM2` được giữ theo biểu mẫu của trường nhưng hiện luôn khóa và không tham
  gia tính điểm.

Điểm quá trình:

```text
Môn dưới 4 tín chỉ:
(KTTX1 + KTĐK1 × 2) / 3

Môn từ 4 tín chỉ:
(KTTX1 + KTTX2 + KTĐK1 × 2) / 4
```

Điểm tổng:

```text
Điểm trung bình quá trình × 0.4 + KTM1 × 0.6
```

Trạng thái học tập:

- `studying`: đang học.
- `repeat_course`: học lại vì vắng quá 20% hoặc điểm quá trình dưới 5.
- `retake_exam`: điểm `KTM1` dưới 5 và còn một lần thi lại.
- `passed`: đã đạt môn.

Các quy tắc này được thực thi bằng trigger PostgreSQL, không chỉ bằng giao diện.

## Công nghệ

- Node.js
- Express
- PostgreSQL / Supabase
- `pg`
- `bcryptjs`
- `express-session`
- HTML, CSS và JavaScript thuần

## Cấu trúc dự án

```text
SGI-website/
├── MVC/
│   ├── app.js
│   ├── assets/
│   │   └── css/
│   │       └── input.css
│   ├── controllers/
│   │   ├── account/
│   │   ├── gradebook/
│   │   ├── management/
│   │   ├── page/
│   │   ├── student/
│   │   ├── system/
│   │   ├── teacher/
│   │   └── user/
│   ├── database/
│   │   ├── create-db.sql
│   │   └── update-gradebook-periods.sql
│   ├── middleware/
│   │   └── session.js
│   ├── models/
│   │   ├── account/
│   │   └── db/
│   ├── public/
│   │   ├── css/
│   │   ├── images/
│   │   └── js/
│   ├── routes/
│   │   └── route.js
│   ├── utils/
│   │   ├── http.js
│   │   ├── presenter.js
│   │   └── values.js
│   └── views/
│       ├── dashboard.html
│       └── login.html
├── package.json
└── README.md
```

## Cài đặt

```bash
npm install
```

Tạo `.env`:

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=your-session-secret
PORT=3000
```

Không commit `.env`.

## Khởi tạo database

> Cảnh báo: `MVC/database/create-db.sql` chạy
> `drop schema if exists public cascade`, toàn bộ dữ liệu cũ trong schema
> `public` sẽ bị xóa.

Có thể chạy bằng công cụ SQL của Supabase hoặc bằng Node/`pg`.

File SQL sẽ:

1. Xóa schema cũ.
2. Tạo enum, bảng, index, view, function và trigger.
3. Tạo dữ liệu giả.
4. Thu hồi quyền truy cập trực tiếp từ `anon` và `authenticated`.

## Chạy ứng dụng

```bash
npm start
```

Chế độ tự reload:

```bash
npm run dev
```

Truy cập:

```text
http://localhost:3000
```

Kiểm tra database:

```text
http://localhost:3000/db-test
```

## Tài khoản dữ liệu giả

Mật khẩu chung: `123456`

| Tài khoản | Vai trò | Trạng thái |
|---|---|---|
| `admin001` | Admin | Hoạt động |
| `academic001` | Giáo vụ | Hoạt động |
| `teacher001` | Giáo viên cơ hữu | Hoạt động |
| `teacher002` | Giáo viên thỉnh giảng | Hoạt động |
| `student001` | Học sinh | Hoạt động |
| `student002` | Học sinh | Hoạt động |
| `student003` | Học sinh | Hoạt động |
| `student004` | Học sinh | Bị khóa |

## API chính

### Chung

- `GET /api/me`
- `GET /api/student-info`
- `GET /api/teacher/classes`
- `GET /api/management/overview`

### Gradebook

- `GET /api/gradebook/:classSubjectId`
- `PUT /api/gradebook/:classSubjectId/students/:studentId`
- `POST /api/gradebook/:classSubjectId/sessions`
- `PUT /api/gradebook/:classSubjectId/sessions/:sessionId/students/:studentId`

### Quản lý

- Giáo vụ: `/api/admin/academic-executors`
- Giáo viên: `/api/management/teachers`
- Học sinh: `/api/management/students`
- Ngành: `/api/management/programs`
- Môn học: `/api/management/subjects`
- Chương trình học: `/api/management/program-subjects`
- Lớp: `/api/management/classes`
- Phân công: `/api/management/class-subjects/:classSubjectId`

## Kiểm tra nhanh

```bash
node --check MVC/app.js
node --check MVC/public/js/dashboard.js
npx eslint MVC MVC/public/js/dashboard.js --no-config-lookup --rule "no-unused-vars:error"
```

Các luồng cần kiểm tra sau mỗi thay đổi:

1. Tài khoản `block` không đăng nhập được.
2. Admin CRUD ngành, môn, chương trình, lớp và giáo vụ.
3. Giáo vụ CRUD giáo viên/học sinh, phân công và mở môn.
4. Giáo viên chỉ truy cập được lớp - môn được phân công.
5. Điểm danh cập nhật đúng số buổi vắng.
6. Cột điểm bị khóa đúng theo tín chỉ.
7. Vắng quá 20% chuyển sang học lại.
8. `KTM1 < 5` chuyển sang trạng thái thi lại; `KTM2` vẫn khóa và không tham gia
   công thức điểm hiện tại.
9. Công nợ thay đổi theo học kỳ đã đóng.
