# Debugging

## Server không chạy

- Kiểm tra Node/npm và `npm ls --depth=0`.
- Chạy `node --check .\MVC\app.js`.
- Kiểm tra `PORT` có bị chiếm.
- Không in giá trị `.env` vào log.

## Database

- Xác nhận `DATABASE_URL` trỏ đúng môi trường.
- `/db-test` có thể xác minh kết nối nhưng hiện public; không dùng như health endpoint production lâu dài.
- `500` được log phía server; API chỉ trả thông báo tổng quát.
- Kiểm tra PostgreSQL code: unique/FK thường thành `409`; data/constraint thành `400`.

## Session

- `401`: cookie thiếu/hết hạn hoặc account không còn hợp lệ.
- Production yêu cầu HTTPS vì cookie `secure`.
- Session 30 phút.
- Store mặc định mất dữ liệu khi process restart và không phù hợp nhiều instance.

## Authorization

- `403` trước hết kiểm tra `req.session.role`.
- Với teacher gradebook, kiểm tra thêm `teacher_id` của assignment.
- Trigger DB còn kiểm tra actor qua `app.account_id`.

## Gradebook

- Môn phải `open`.
- Số field được sửa phụ thuộc tín chỉ.
- Ngày học trong cùng lớp–môn phải unique.
- Vắng/có phép trên 20% số buổi đổi trạng thái thành `repeat_course`.

## Frontend

- Mở Network để xem JSON/status.
- Kiểm tra `showToast`, loading và lỗi từ helper `api()`.
- Dashboard breakpoint chính: `1100px`, `800px`; bảng có overflow.
- Nếu lỗi tiếng Việt, xác nhận file UTF-8 và response `charset=utf-8`.

## Lỗi login đã biết

Server dùng query values `wrong_username`, `wrong_password`, `blocked`, nhưng frontend tra `username`, `password`, `status`; vì vậy error box không hiện. Chỉ ghi nhận tại QA, chưa sửa source.
