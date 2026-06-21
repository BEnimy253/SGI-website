# Ghi chú triển khai

## Production đã xác minh

- URL: `https://sgi-website.onrender.com`.
- Nền tảng được người dùng xác nhận là Render.
- HTTPS hoạt động.
- Static CSS, JavaScript và ảnh trả `200`.
- Cookie đăng nhập có `HttpOnly`, `Secure`, `SameSite=Lax`.

## Lệnh khởi động suy ra từ repo

```powershell
npm start
```

Build CSS:

```powershell
npm run build
```

## Biến môi trường

`DATABASE_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`.

Không ghi giá trị thật trong tài liệu hoặc log.

## Chưa xác định trong repo hiện tại

- Render service configuration.
- Build/start command cấu hình trên dashboard Render.
- CI/CD.
- Health check.
- Database backup/restore.
- Migration strategy.
- Log retention và monitoring.
- Persistent session store.

## Cảnh báo

- Không deploy nếu chưa backup và xác định database target.
- Nên thêm security headers và bảo vệ `/db-test`.
- Session MemoryStore không phù hợp production nhiều instance.
