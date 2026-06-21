# Tổng quan project

## Mục tiêu

SGI Portal quản lý chương trình đào tạo, lớp, người dùng, bảng điểm và điểm danh trong giao diện phân quyền. Server phục vụ hai trang HTML; dashboard tải và ghi dữ liệu qua JSON API.

## Vai trò

| Vai trò | Trách nhiệm |
|---|---|
| `admin` | Quản trị cấu trúc đào tạo và tài khoản quản lý |
| `academic_executor` | Vận hành giáo viên, học sinh, phân công và bảng điểm |
| `teacher` | Cập nhật lớp–môn được phân công |
| `student` | Xem thông tin và kết quả cá nhân |

## Phạm vi chức năng

- Đăng nhập, đăng xuất và session 30 phút.
- Quản lý hồ sơ theo vai trò.
- Chương trình, môn, lớp và curriculum.
- Phân công giáo viên, mở/đóng lớp–môn.
- Tự tạo bảng điểm, buổi học và điểm danh.
- Tính điểm và trạng thái học tập.
- Hiển thị học phí và công nợ.

## Trạng thái xác minh

- Production phản hồi tại `https://sgi-website.onrender.com`.
- API bốn vai trò được kiểm thử ngày 21/06/2026.
- Kiểm thử trực quan đa trình duyệt/viewport chưa hoàn tất do công cụ trình duyệt QA không khả dụng.

## Chưa xác định

- Quy trình thu học phí qua UI.
- Email, thông báo và khôi phục mật khẩu.
- CI/CD và cấu hình Render.
- Test tự động và phiên bản Node.js hỗ trợ chính thức.
