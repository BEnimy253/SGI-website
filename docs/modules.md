# Modules

## Authentication

`GET /login`, `POST /login`, `POST /logout`, `GET /api/me`. Mật khẩu dùng bcrypt; chỉ account `active` đăng nhập được.

## Admin

Quản lý giáo vụ, chương trình, môn, curriculum, lớp và có toàn bộ quyền người dùng/phân công/gradebook.

## Giáo vụ

CRUD giáo viên và học sinh; phân công, trạng thái lớp–môn, bảng điểm, ngày học và điểm danh. Không thay đổi cấu trúc cấp admin.

## Giáo viên

Xem lớp–môn được phân công; cập nhật điểm khi môn `open`; cập nhật ngày học và điểm danh.

## Học sinh

Xem hồ sơ, lớp, chương trình, học kỳ, học phí, công nợ và kết quả. Không có API ghi dữ liệu.

## Gradebook

- Dưới 4 tín chỉ: `KTTX1`, `KTĐK1`, `KTM1`.
- Từ 4 tín chỉ: `KTTX1`, `KTTX2`, `KTĐK1`, `KTM1`.
- `KTĐK2`, `KTM2` hiện không cho cập nhật.
- Trigger tính điểm và trạng thái.
- Vắng/có phép trên 20% số buổi → `repeat_course`.

## Đồng bộ

Curriculum → lớp–môn; học sinh/lớp–môn → score; score/session → attendance; điểm/attendance → kết quả.
