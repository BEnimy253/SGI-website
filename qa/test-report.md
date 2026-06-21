# Báo cáo kiểm thử SGI Portal

## Tóm tắt

| Mục | Kết quả |
|---|---|
| Môi trường | Production |
| URL | `https://sgi-website.onrender.com` |
| Ngày | 21/06/2026 |
| Vai trò | Admin, giáo vụ, giáo viên, học sinh |
| Tổng quan | Chức năng/API chính hoạt động; phát hiện 4 vấn đề |
| Source đã sửa | Không |

## Kết quả

| Nhóm | Pass | Fail | Blocked |
|---|---:|---:|---:|
| Public/session | 10 | 3 | 0 |
| Admin | 13 | 0 | 0 |
| Giáo vụ | 7 | 0 | 0 |
| Giáo viên | 12 | 0 | 0 |
| Học sinh | 4 | 0 | 0 |
| Data/transaction | 3 | 0 | 0 |
| UI trực quan | 0 | 0 | 5 |
| **Tổng** | **49** | **3** | **5** |

## Kết quả nổi bật

### Public và session

- `/login` và static assets trả `200`, UTF-8.
- Anonymous bị chuyển login; API trả `401`.
- Login đúng chuyển dashboard; logout làm API trả `401`.
- Ba nhánh sai username/password/account block chuyển URL riêng.
- Cookie có `HttpOnly`, `Secure`, `SameSite=Lax`.
- Lần đo login khoảng `0.45s`.

### Admin

- CRUD chương trình, môn, lớp, giáo vụ thành công.
- Curriculum tự đồng bộ lớp–môn.
- Duplicate `409`; missing ID `404`.
- Mở lớp–môn thiếu giáo viên `400`.
- Xóa chương trình đang dùng `400`.
- Sửa/xóa curriculum đã đồng bộ `400`.
- Xóa môn đang dùng `409`.

### Giáo vụ

- Overview không trả giáo vụ; account chỉ teacher/student.
- API admin trả `403`.
- CRUD giáo viên/học sinh và cập nhật assignment/session/attendance thành công.
- Xóa giáo viên đang phân công tự đóng lớp–môn và xóa `teacher_id`.

### Giáo viên

- Gradebook của mình `200`; lớp giáo viên khác `403`.
- API ngoài role `403`.
- Điểm >10 và `KTĐK2` không hợp lệ `400`.
- Môn đóng không cho ghi điểm.
- Bộ điểm `7.5, 8, 6.5, 8.5` tạo điểm quá trình `7.13`, điểm cuối `7.95`, trạng thái `passed`.
- Ngày học trùng `409`; attendance enum sai `400`.

### Học sinh và transaction

- Student API trả đúng hồ sơ và score.
- Mọi API ghi/ngoài role trả `403`.
- Email sai làm transaction rollback; số account không tăng.
- Attendance `absent` làm 1/4 buổi vắng và `repeat_course`; trả về `present` khôi phục `passed`.

## Dữ liệu QA

Credential không ghi trong báo cáo.

| Loại | Dấu hiệu/ID | Trạng thái cuối |
|---|---|---|
| Chương trình | `QA26C`, ID 4 | Giữ lại |
| Môn | `QA26S3`, ID 9 | Giữ lại |
| Curriculum | ID 10 | Giữ lại |
| Lớp chính | `QA26C-C1`, ID 3 | Giữ lại |
| Lớp–môn chính | ID 10 | `open`, teacher ID 3 |
| Giáo vụ | ID 2 | Giữ lại |
| Giáo viên chính | ID 3 | Giữ lại |
| Học sinh chính | `QA26ST003`, ID 5 | Giữ lại |
| Lớp phụ | `QA26C-C2`, ID 5 | `closed`, không giáo viên |
| Giáo viên phụ | ID 4 | Đã xóa |
| Học sinh phụ | `QA26ST004` | Đã tạo, sửa, xóa |
| Dữ liệu `QADEL` | Nhiều loại | Đã xóa |
| Account block tạm | Prefix `qa_blocked` | Đã xóa |

## Lỗi

Xem [known-issues.md](known-issues.md):

- `QA-001`: error box login không hiển thị.
- `QA-002`: login cho phép phân biệt username tồn tại.
- `QA-003`: `/db-test` public.
- `QA-004`: thiếu security headers cơ bản.

## Giới hạn

- Desktop/mobile rendering, keyboard và console browser bị `Blocked` do công cụ browser lỗi sandbox.
- Không stress/load test, brute force hoặc khai thác bảo mật.
- Không chờ đủ 30 phút để kiểm tra timeout.
- Không kiểm thử deploy, backup hoặc migration.
- Không chạy test tự động vì repo chưa có.

## Cam kết

- Chỉ thao tác dữ liệu qua API hợp lệ.
- Không chạy SQL ghi dữ liệu.
- Không sửa source, package, schema, migration, `.env` hoặc production config.
- Không sửa lỗi phát hiện.
