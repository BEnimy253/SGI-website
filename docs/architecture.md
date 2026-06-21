# Kiến trúc

```text
Browser → Express session/role middleware → Controller
        → Validation → pg transaction → PostgreSQL trigger/view
        → Presenter → JSON/HTML response
```

## Khởi tạo

`App` tạo `DB`, `Route`, `Http`, `Presenter`, `Values`, `AccountCredentials`, rồi truyền vào modules. Thứ tự chính: body/static middleware → session → page/system/user modules → error handler.

## Request API

1. Parse body và kiểm tra quyền.
2. Parse input bằng `Values`.
3. `DB.withAppContext` mở transaction.
4. Đặt `app.account_id` cho PostgreSQL.
5. Query table/view; trigger kiểm tra quyền và dữ liệu.
6. Commit/rollback; presenter tạo JSON.

## Session và quyền

- Login so sánh bcrypt hash.
- Session lưu `userId`, `role`.
- Cookie `httpOnly`, `sameSite=lax`, 30 phút, `secure` ở production.
- Gradebook kiểm tra thêm giáo viên được phân công.

## Database context

```sql
begin;
select set_config('app.account_id', <session-user-id>, true);
-- query
commit;
```

Trigger đọc context qua `current_account_id()` và `current_account_role()`.

QA đã xác minh transaction rollback khi tạo account với email sai.

## Frontend

`init()` gọi `/api/me`, sinh menu theo role, tải JSON bằng helper `api()`, dựng CRUD từ metadata và render gradebook.

## Lưu ý

- Session store mặc định, chưa thấy persistent store.
- SQL nằm trực tiếp trong controller.
- Không thấy CSRF, rate limiting hoặc security-header middleware.
- `/db-test` không có authentication.
