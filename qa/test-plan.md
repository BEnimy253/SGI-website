# Kế hoạch kiểm thử SGI Portal

## Mục tiêu

Xác minh production `https://sgi-website.onrender.com` theo bốn vai trò, gồm chức năng, API, phân quyền, validation, transaction, toàn vẹn dữ liệu và giao diện.

Không stress test, brute force, phá hoại database, deploy, migration hoặc sửa source.

## Môi trường

| Thành phần | Giá trị |
|---|---|
| Production | `https://sgi-website.onrender.com` |
| Ngày | 21/06/2026 |
| Client API | HTTPS/curl |
| Browser trực quan | Blocked do công cụ browser QA lỗi sandbox |
| Database | Được người dùng xác nhận chỉ chứa dữ liệu test |

Credential không ghi trong repo. Dữ liệu dùng prefix `QA`.

## Ma trận quyền

| Chức năng | Admin | Giáo vụ | Giáo viên | Học sinh |
|---|:---:|:---:|:---:|:---:|
| Cấu trúc đào tạo | CRUD | Không | Không | Không |
| Giáo vụ | CRUD | Không | Không | Không |
| Giáo viên/học sinh | CRUD | CRUD | Không | Không |
| Phân công | Có | Có | Không | Không |
| Gradebook | Có | Có | Chỉ lớp mình | Không |
| Kết quả cá nhân | Overview | Overview | Profile | Có |

## Test case

### Public và session

| ID | Test |
|---|---|
| PUB-01 | `/login` trả 200 và UTF-8 |
| PUB-02 | `/` chuyển `/login` khi anonymous |
| PUB-03 | `/dashboard` yêu cầu login |
| PUB-04 | CSS, JavaScript, logo trả 200 |
| PUB-05 | Security headers |
| AUTH-01 | Login đúng |
| AUTH-02 | Sai username |
| AUTH-03 | Sai password |
| AUTH-04 | Account block |
| AUTH-05 | API anonymous trả 401 |
| AUTH-06 | Logout hủy session |
| AUTH-07 | Cookie security flags |
| AUTH-08 | Thông báo lỗi login |

### Admin

| ID | Test |
|---|---|
| ADM-01 | Overview đầy đủ |
| ADM-02 | CRUD giáo vụ |
| ADM-03 | CRUD chương trình |
| ADM-04 | CRUD môn |
| ADM-05 | CRUD curriculum |
| ADM-06 | CRUD lớp |
| ADM-07 | CRUD giáo viên/học sinh |
| ADM-08 | Phân công và mở/đóng lớp–môn |
| ADM-09 | Mở thiếu giáo viên |
| ADM-10 | Xóa chương trình đang dùng |
| ADM-11 | Sửa/xóa curriculum đã đồng bộ |
| ADM-12 | Duplicate trả 409 |
| ADM-13 | ID hợp lệ không tồn tại trả 404 |

### Giáo vụ

| ID | Test |
|---|---|
| AE-01 | Overview lọc dữ liệu |
| AE-02 | CRUD giáo viên |
| AE-03 | CRUD học sinh |
| AE-04 | Cập nhật phân công |
| AE-05 | Cập nhật gradebook/session/attendance |
| AE-06 | API admin trả 403 |
| AE-07 | Xóa giáo viên đóng/bỏ phân công |

### Giáo viên

| ID | Test |
|---|---|
| TCH-01 | Xem assignment của mình |
| TCH-02 | Gradebook của mình |
| TCH-03 | Gradebook giáo viên khác trả 403 |
| TCH-04 | API ngoài role trả 403 |
| TCH-05 | Cập nhật điểm hợp lệ |
| TCH-06 | Điểm >10 |
| TCH-07 | Field bị cấm theo tín chỉ |
| TCH-08 | Không ghi điểm khi môn đóng |
| TCH-09 | Cập nhật ngày học |
| TCH-10 | Ngày học trùng |
| TCH-11 | Attendance và enum sai |
| TCH-12 | Công thức điểm/trạng thái |

### Học sinh và dữ liệu

| ID | Test |
|---|---|
| STU-01 | Hồ sơ cá nhân |
| STU-02 | Score/status/công nợ |
| STU-03 | API ngoài role trả 403 |
| STU-04 | Ghi score trả 403 |
| DAT-01 | Transaction rollback |
| DAT-02 | Cascade/side effect xóa |
| DAT-03 | Attendance làm mới trạng thái |

### Giao diện

| ID | Test |
|---|---|
| UI-01 | Desktop |
| UI-02 | Mobile ≤800px |
| UI-03 | Gradebook overflow |
| UI-04 | Keyboard/focus/label |
| UI-05 | Console/network runtime |

Trạng thái: `Pass`, `Fail`, `Blocked`, `Not Run`. Severity: `Critical`, `High`, `Medium`, `Low`.
