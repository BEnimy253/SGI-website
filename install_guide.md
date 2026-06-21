# Hướng dẫn cài đặt và chạy SGI Website trên máy local

Tài liệu này dành cho người chưa từng cài hoặc chạy dự án Node.js. Thực hiện lần lượt từ đầu đến cuối để chạy được hai lệnh:

```powershell
npm run css
npm run dev
```

> Tài liệu không bao gồm các tệp và cấu hình được người phụ trách dự án cung cấp riêng.

## 1. Những phần mềm cần cài

### 1.1. Cài Git

Git được dùng để tải source code và chuyển sang đúng branch của dự án.

1. Truy cập <https://git-scm.com/download/win>.
2. Tải bản Git dành cho Windows.
3. Mở file vừa tải và tiếp tục cài với các lựa chọn mặc định.
4. Sau khi cài xong, đóng rồi mở lại terminal.
5. Kiểm tra bằng lệnh:

```powershell
git --version
```

Nếu kết quả hiển thị tương tự `git version 2.x.x` thì Git đã được cài thành công.

### 1.2. Cài Node.js và npm

Node.js dùng để chạy website. npm được cài tự động cùng Node.js và dùng để tải các package của dự án.

1. Truy cập <https://nodejs.org/>.
2. Tải bản có nhãn **LTS** dành cho Windows. Không cần chọn bản Current.
3. Mở file cài đặt.
4. Giữ các lựa chọn mặc định và hoàn tất quá trình cài.
5. Đóng rồi mở lại terminal.
6. Kiểm tra:

```powershell
node --version
npm --version
```

Hai lệnh phải trả về số phiên bản. Repo hiện tại không quy định một phiên bản Node.js cụ thể, vì vậy nên dùng bản LTS còn được hỗ trợ.

### 1.3. Cài Visual Studio Code

1. Truy cập <https://code.visualstudio.com/>.
2. Tải bản dành cho Windows.
3. Khi cài đặt, nên đánh dấu:
   - **Add "Open with Code" action**
   - **Add to PATH**
4. Hoàn tất cài đặt và mở Visual Studio Code.

## 2. Cài extension cho Visual Studio Code

Trong Visual Studio Code:

1. Nhấn biểu tượng **Extensions** ở thanh bên trái, hoặc nhấn `Ctrl + Shift + X`.
2. Tìm tên extension.
3. Kiểm tra đúng nhà phát hành rồi nhấn **Install**.

Các extension nên cài:

| Extension | Nhà phát hành | Mục đích |
|---|---|---|
| ESLint | Microsoft | Phát hiện vấn đề trong code JavaScript |
| Tailwind CSS IntelliSense | Tailwind Labs | Gợi ý class Tailwind CSS |
| Prettier - Code formatter | Prettier | Hỗ trợ định dạng code dễ đọc |
| GitLens — Git supercharged | GitKraken | Xem lịch sử thay đổi Git; không bắt buộc |

Không cần cài **Live Server** để chạy dự án này. Website được khởi động bằng `npm run dev`.

Nếu lệnh `code` đã hoạt động trong terminal, có thể cài ba extension chính bằng:

```powershell
code --install-extension dbaeumer.vscode-eslint
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
```

## 3. Tải project từ GitHub

### Cách dành cho người chưa có project trên máy

1. Tạo hoặc chọn một thư mục dùng để lưu project, ví dụ `D:\projects`.
2. Mở thư mục đó trong File Explorer.
3. Nhấp chuột phải vào vùng trống và chọn **Open in Terminal**.
4. Chạy lệnh:

```powershell
git clone --branch dev --single-branch https://github.com/BEnimy253/SGI-website.git
cd SGI-website
```

Lệnh trên tải trực tiếp branch `dev`. Không làm việc trên branch `main`.

Kiểm tra branch hiện tại:

```powershell
git branch --show-current
```

Kết quả bắt buộc phải là:

```text
dev
```

### Cách dành cho người đã có project trên máy

Mở terminal tại thư mục `SGI-website`, sau đó chạy:

```powershell
git fetch origin
git switch dev
git pull --ff-only origin dev
git branch --show-current
```

Chỉ tiếp tục khi lệnh cuối hiển thị `dev`.

## 4. Mở project bằng Visual Studio Code

Khi terminal đang đứng tại thư mục `SGI-website`, chạy:

```powershell
code .
```

Nếu lệnh `code .` không hoạt động:

1. Mở Visual Studio Code.
2. Chọn **File > Open Folder**.
3. Chọn thư mục `SGI-website`.
4. Nhấn **Select Folder**.

Mở terminal trong Visual Studio Code bằng **Terminal > New Terminal** hoặc nhấn ``Ctrl + ` ``.

Đường dẫn terminal phải kết thúc bằng `SGI-website`, ví dụ:

```text
PS D:\projects\SGI-website>
```

## 5. Cài package của project

Tại terminal trong thư mục gốc `SGI-website`, chạy:

```powershell
npm ci
```

Lệnh này đọc `package-lock.json` và cài đúng các phiên bản package đã được khóa trong repo. Quá trình có thể mất vài phút tùy tốc độ mạng.

Sau khi hoàn tất, thư mục `node_modules` sẽ xuất hiện. Không chỉnh sửa và không commit thư mục này.

## 6. Chạy CSS

Dự án cần một terminal chạy Tailwind CSS ở chế độ theo dõi thay đổi.

Trong terminal đầu tiên, chạy:

```powershell
npm run css
```

Lệnh này tạo/cập nhật file CSS đầu ra và tiếp tục chạy để theo dõi thay đổi. Terminal không tự quay lại dấu nhắc lệnh là hành vi bình thường.

Giữ nguyên terminal này trong suốt thời gian làm việc.

## 7. Chạy website

1. Trong Visual Studio Code, chọn **Terminal > New Terminal** hoặc nhấn nút dấu cộng trong khu vực terminal.
2. Đảm bảo terminal mới vẫn đang ở thư mục `SGI-website`.
3. Chạy:

```powershell
npm run dev
```

Script sử dụng chế độ theo dõi của Node.js, vì vậy server sẽ tự khởi động lại khi source code thay đổi.

Khi terminal thông báo server đang chạy, mở trình duyệt và truy cập:

```text
http://localhost:3000
```

Trong lúc phát triển phải giữ hai terminal cùng hoạt động:

| Terminal | Lệnh | Vai trò |
|---|---|---|
| Terminal 1 | `npm run css` | Theo dõi và biên dịch Tailwind CSS |
| Terminal 2 | `npm run dev` | Chạy web server local |

## 8. Dừng project

Tại từng terminal đang chạy, nhấn:

```text
Ctrl + C
```

Nếu terminal hỏi có muốn kết thúc tiến trình hay không, nhập `Y` rồi nhấn Enter.

## 9. Cách chạy lại vào lần sau

Không cần clone hoặc chạy `npm ci` lại mỗi lần mở project nếu package không thay đổi.

1. Mở thư mục `SGI-website` bằng Visual Studio Code.
2. Kiểm tra branch:

```powershell
git branch --show-current
```

3. Nếu kết quả không phải `dev`, chuyển branch:

```powershell
git switch dev
```

4. Mở hai terminal và lần lượt chạy:

```powershell
npm run css
```

```powershell
npm run dev
```

5. Truy cập <http://localhost:3000>.

## 10. Xử lý lỗi thường gặp

### `git`, `node`, `npm` hoặc `code` is not recognized

- Đóng toàn bộ terminal và Visual Studio Code rồi mở lại.
- Nếu vẫn lỗi, khởi động lại Windows.
- Kiểm tra phần mềm đã được cài đúng và tùy chọn thêm vào `PATH` đã được bật.

### PowerShell báo không thể chạy `npm.ps1`

Không cần thay đổi chính sách bảo mật của máy. Trong Visual Studio Code:

1. Nhấn mũi tên cạnh nút dấu cộng của terminal.
2. Chọn **Command Prompt**.
3. Chạy lại lệnh npm trong terminal Command Prompt.

### `npm ci` báo lỗi mạng

- Kiểm tra kết nối Internet.
- Tắt VPN hoặc proxy nếu chúng đang chặn npm.
- Chạy lại `npm ci`.

### Không nhập được lệnh khác sau `npm run css`

Đây không phải lỗi. `npm run css` là tiến trình chạy liên tục. Hãy mở một terminal mới để chạy `npm run dev`.

### Trình duyệt không mở được `localhost:3000`

- Kiểm tra terminal chạy `npm run dev` có thông báo lỗi hay không.
- Đảm bảo chưa dừng terminal bằng `Ctrl + C`.
- Kiểm tra đang truy cập đúng địa chỉ `http://localhost:3000`.
- Nếu cổng `3000` đang được chương trình khác sử dụng, hãy đóng chương trình đó rồi chạy lại `npm run dev`.

### Giao diện không cập nhật CSS

- Đảm bảo terminal `npm run css` vẫn đang chạy.
- Lưu file vừa chỉnh sửa bằng `Ctrl + S`.
- Tải lại trang bằng `Ctrl + F5`.

### Đang ở nhầm branch `main`

Không chỉnh sửa hoặc commit trên `main`. Chuyển về `dev`:

```powershell
git switch dev
git branch --show-current
```

Kết quả phải là `dev`.

## 11. Checklist hoàn thành

- [ ] Đã cài Git.
- [ ] Đã cài Node.js LTS và npm.
- [ ] Đã cài Visual Studio Code.
- [ ] Đã cài các extension cần thiết.
- [ ] Đã clone đúng branch `dev`.
- [ ] `git branch --show-current` hiển thị `dev`.
- [ ] Đã chạy thành công `npm ci`.
- [ ] Terminal 1 đang chạy `npm run css`.
- [ ] Terminal 2 đang chạy `npm run dev`.
- [ ] Đã mở được `http://localhost:3000` trên trình duyệt.
