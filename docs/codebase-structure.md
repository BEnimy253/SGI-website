# Cấu trúc codebase

```text
MVC/
├── app.js
├── assets/css/input.css
├── controllers/
├── database/
├── middleware/
├── models/
├── public/
├── routes/
├── utils/
└── views/
```

## Trách nhiệm

- `app.js`: entrypoint, dependency, middleware và modules.
- `controllers/page`: phục vụ HTML.
- `controllers/system`: kiểm tra DB.
- `controllers/user`: login/logout và ghép module role.
- `controllers/management`: CRUD đào tạo và con người.
- `controllers/gradebook`: điểm, session, attendance.
- `models/db`: pool, transaction, DB context.
- `models/account`: account/person credential.
- `routes/route.js`: URL constants và middleware quyền.
- `utils/values.js`: parse/validation.
- `utils/http.js`: error/status.
- `utils/presenter.js`: JSON mapping.
- `views`: login và dashboard shell.
- `public/js/dashboard.js`: render, navigation, CRUD và gradebook.
- `database`: schema đầy đủ và script cập nhật.

Controller nhận dependency qua constructor. Frontend chỉ gọi API, không truy cập DB trực tiếp.
