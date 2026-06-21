# Quy trình phát triển

## Trước khi thay đổi

- Đọc `AGENTS.md`.
- Xác định module, route, bảng và trigger liên quan.
- Kiểm tra `git status`; không ghi đè thay đổi của người khác.
- Dùng database development, không dùng production nếu không được phép.

## Chu trình đề xuất

1. Tạo branch riêng.
2. Chạy project và tái hiện hành vi hiện tại.
3. Thay đổi nhỏ, đúng phạm vi.
4. Chạy kiểm tra cú pháp và kiểm thử liên quan.
5. Kiểm tra API theo cả role được phép và bị cấm.
6. Review diff, secret và file sinh tự động.
7. Cập nhật tài liệu/QA khi interface thay đổi.

## Lệnh hiện có

```powershell
npm run dev
npm start
npm run css
npm run build
```

Repo chưa có script `test` hoặc `lint`. `eslint` có trong dev dependency nhưng chưa có script/config được xác minh.

## Khi thay đổi database

- Không sửa schema production trực tiếp.
- Viết migration có forward/rollback rõ ràng.
- Đánh giá trigger, view và dữ liệu đồng bộ.
- Test transaction rollback và foreign keys.
- Backup trước khi triển khai.

## Checklist review

- Không lộ secret.
- Validation và HTTP status nhất quán.
- Role middleware có trên route mới.
- Query parameterized.
- Transaction bao quanh thao tác nhiều bước.
- Frontend xử lý loading/error.
- Tài liệu API/database được cập nhật.
