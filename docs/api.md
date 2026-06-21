# API

## Quy ước

- API trả JSON.
- Chưa đăng nhập: `401`.
- Sai vai trò: `403`.
- Input sai: `400`.
- Không tìm thấy: `404`.
- Vi phạm unique/foreign key: thường `409`.
- Lỗi không dự kiến: `500` với thông báo tổng quát.

## Trang và session

| Method | Route | Quyền | Mô tả |
|---|---|---|---|
| GET | `/` | Public | Chuyển login/dashboard |
| GET | `/login` | Public | Login page |
| POST | `/login` | Public | Tạo session |
| GET | `/dashboard` | Login | Dashboard shell |
| POST | `/logout` | Login | Hủy session |
| GET | `/db-test` | Public | Query thời gian DB |
| GET | `/api/me` | Login | Account/person/profile |

## Học sinh và giáo viên

| Method | Route | Vai trò |
|---|---|---|
| GET | `/api/student-info` | student |
| GET | `/api/teacher/classes` | teacher |

## Gradebook

| Method | Route | Vai trò |
|---|---|---|
| GET | `/api/gradebook/:classSubjectId` | admin, academic_executor, teacher được phân công |
| PUT | `/api/gradebook/:classSubjectId/students/:studentId` | như trên |
| PUT | `/api/gradebook/:classSubjectId/sessions/:sessionId` | như trên |
| PUT | `/api/gradebook/:classSubjectId/sessions/:sessionId/students/:studentId` | như trên |

Body score gồm `kttx1`, `kttx2`, `ktdk1`, `ktdk2`, `ktm1`, `ktm2`, `note`. Điểm rỗng thành `null`; điểm hợp lệ từ 0 đến 10.

Body session:

```json
{ "studyDate": "2026-06-21" }
```

Body attendance:

```json
{ "status": "present", "note": "..." }
```

## Management overview

`GET /api/management/overview`: admin và giáo vụ. Giáo vụ không nhận danh sách giáo vụ và chỉ nhận account teacher/student.

## CRUD người dùng

| Method | Route | Vai trò |
|---|---|---|
| POST | `/api/admin/academic-executors` | admin |
| PUT/DELETE | `/api/admin/academic-executors/:executorId` | admin |
| POST | `/api/management/teachers` | admin, academic_executor |
| PUT/DELETE | `/api/management/teachers/:teacherId` | admin, academic_executor |
| POST | `/api/management/students` | admin, academic_executor |
| PUT/DELETE | `/api/management/students/:studentId` | admin, academic_executor |

Account/person body dùng: `username`, `password`, `status`, `familyName`, `givenName`, `dateOfBirth`, `gender`, `phone`, `email`.

Teacher thêm `contractType`. Student thêm `studentCode`, `classId`, `currentSemester`, `tuitionPaidThroughSemester`, `tuitionPerSemester`.

## CRUD cấu trúc đào tạo

| Method | Route | Vai trò |
|---|---|---|
| POST | `/api/management/programs` | admin |
| PUT/DELETE | `/api/management/programs/:programId` | admin |
| POST | `/api/management/subjects` | admin |
| PUT/DELETE | `/api/management/subjects/:subjectId` | admin |
| POST | `/api/management/program-subjects` | admin |
| PUT/DELETE | `/api/management/program-subjects/:programSubjectId` | admin |
| POST | `/api/management/classes` | admin |
| PUT/DELETE | `/api/management/classes/:classId` | admin |
| PUT | `/api/management/class-subjects/:classSubjectId` | admin, academic_executor |

## Side effects

- Tạo/xóa account kéo theo person/profile qua cascade.
- Xóa giáo viên đóng và bỏ phân công các lớp–môn của giáo viên đó.
- Tạo/sửa curriculum có thể đồng bộ lớp.
- Tạo lớp sinh lớp–môn.
- Tạo học sinh sinh score và attendance liên quan.
- Thay đổi điểm/điểm danh tính lại kết quả.

## Ràng buộc đáng chú ý

- Lớp mở phải có giáo viên.
- Curriculum đã đồng bộ vào lớp không được sửa/xóa.
- Chương trình đang có lớp/môn không được xóa.
- Môn đang được tham chiếu trả lỗi foreign key.
- Teacher truy cập gradebook không được phân công trả `403`.
