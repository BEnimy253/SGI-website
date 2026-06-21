# Kiểm thử

## Trạng thái hiện tại

Repo chưa có framework, test directory hoặc script `test`. QA hiện dựa trên kiểm tra cú pháp và kiểm thử HTTP/UI thủ công.

## Kiểm tra tĩnh an toàn

```powershell
node --check .\MVC\app.js
npm ls --depth=0
npm run
```

## Các tầng cần kiểm thử

1. Public routes và static assets.
2. Login, logout, cookie và session timeout.
3. Role matrix cho admin, giáo vụ, giáo viên, học sinh.
4. CRUD và validation.
5. Transaction rollback.
6. Trigger đồng bộ score/session/attendance.
7. Công thức điểm và trạng thái.
8. Responsive, accessibility cơ bản, console/network.

## Dữ liệu test

- Dùng prefix rõ ràng, ví dụ `QA-CDX-*`.
- Không dùng email hoặc số điện thoại thật.
- Ghi ID và quan hệ trong báo cáo.
- Chỉ thao tác production khi được cho phép.

## Trạng thái test case

- `Pass`: đúng kỳ vọng.
- `Fail`: có lỗi đã xác minh.
- `Blocked`: thiếu môi trường/công cụ/dữ liệu.
- `Not Run`: chưa thực hiện.

## Báo cáo hiện tại

Xem [test-plan.md](../qa/test-plan.md), [test-report.md](../qa/test-report.md) và [known-issues.md](../qa/known-issues.md).

## Ưu tiên tự động hóa

- Unit test cho `Values` và `Presenter`.
- Integration test cho auth/role middleware.
- API test với database test độc lập.
- Test trigger/công thức điểm.
- Browser E2E cho bốn vai trò.
