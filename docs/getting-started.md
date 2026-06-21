# Bắt đầu phát triển

## Yêu cầu

- Node.js, npm và PostgreSQL.
- Database development riêng.

Repo đã được kiểm tra với Node.js `v24.16.0`, npm `11.13.0`; đây không phải version được project khai báo chính thức.

## Cài đặt

```powershell
npm install
```

Tạo `.env` cục bộ, không commit:

```env
DATABASE_URL=<PostgreSQL connection string>
SESSION_SECRET=<random secret>
PORT=3000
NODE_ENV=development
```

| Biến | Mục đích |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối `pg.Pool` |
| `SESSION_SECRET` | Ký cookie session |
| `PORT` | Mặc định `3000` |
| `NODE_ENV` | Bật cookie `secure` ở production |

Repo chưa có `.env.example`.

## Database

`create-db.sql` xóa schema `public` trước khi dựng lại. Chỉ dùng trên DB development rỗng sau khi review. `update-gradebook-periods.sql` thay đổi type, column, trigger, view và dữ liệu. Project chưa có command migration/seed chính thức.

## Chạy

```powershell
npm run dev
npm start
```

Build/watch CSS:

```powershell
npm run css
npm run build
```

Hai lệnh CSS ghi vào `MVC/public/css/output.css`.

## Kiểm tra nhanh

```powershell
node --check .\MVC\app.js
npm ls --depth=0
```

- `/login`: trang đăng nhập.
- `/dashboard`: yêu cầu session.
- `/db-test`: kiểm tra DB, hiện đang public.

## Lỗi thường gặp

- `DATABASE_URL` sai: truy vấn trả `500`.
- Cookie local không hoạt động: kiểm tra `NODE_ENV` và HTTP/HTTPS.
- `401`: chưa có hoặc hết session.
- `403`: sai vai trò.
