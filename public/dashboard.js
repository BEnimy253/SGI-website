const app = document.getElementById("app");
const sidebar = document.getElementById("sidebar");
const toast = document.getElementById("toast");
const pageTitle = document.getElementById("pageTitle");
const roleLabel = document.getElementById("roleLabel");
const accountName = document.getElementById("accountName");

const missingText = "-";

const state = {
  me: null,
  studentData: null,
  teacherData: null,
  teacherDetail: null,
  activeTeacherClassId: null,
  managementData: null,
  managementView: "overview",
};

const roleTitles = {
  admin: "Quản trị hệ thống",
  academic_executor: "Quản lý đào tạo",
  teacher: "Lớp được phân công",
  student: "Bảng điểm học sinh",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function formatValue(value, fallback = missingText) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return escapeHtml(value);
}

function formatDate(value) {
  if (!value) {
    return missingText;
  }

  const [year, month, day] = String(value).slice(0, 10).split("-");

  if (!year || !month || !day) {
    return escapeHtml(value);
  }

  return `${day}/${month}/${year}`;
}

function formatScore(value, fallback = missingText) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback;
  }

  return Number(value).toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function scoreInputValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function showToast(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast ${type === "error" ? "error" : ""}`;

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

async function api(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  const fetchOptions = {
    ...options,
    headers,
  };

  if (options.body && !(options.body instanceof FormData)) {
    fetchOptions.headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, fetchOptions);

  if (response.status === 401) {
    window.location.href = "/login";
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Không thực hiện được thao tác.");
  }

  return payload;
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setSidebar(items, activeId, onClick) {
  sidebar.innerHTML = items
    .map(
      (item) => `
        <button
          type="button"
          class="nav-button ${item.id === activeId ? "active" : ""}"
          data-nav="${escapeAttr(item.id)}"
        >
          ${escapeHtml(item.label)}
        </button>
      `,
    )
    .join("");

  sidebar.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => onClick(button.dataset.nav));
  });
}

function setHeader() {
  const profile = state.me.profile || {};
  const displayName =
    profile.full_name ||
    profile.student_code ||
    profile.teacher_code ||
    profile.staff_code ||
    state.me.account.username;

  pageTitle.textContent = roleTitles[state.me.account.role] || "SGI Portal";
  roleLabel.textContent = state.me.account.roleLabel;
  accountName.textContent = displayName;
}

function statusBadge(status) {
  const label = status === "closed" ? "Đã đóng" : "Đang mở";
  const className = status === "closed" ? "badge-closed" : "badge-open";
  return `<span class="badge ${className}">${label}</span>`;
}

function profileItem(label, value) {
  return `
    <div class="profile-item">
      <span>${escapeHtml(label)}</span>
      <strong>${formatValue(value)}</strong>
    </div>
  `;
}

function detailItem(label, value, isScore = false) {
  return `
    <div class="profile-item">
      <span>${escapeHtml(label)}</span>
      <strong>${isScore ? formatScore(value) : formatValue(value)}</strong>
    </div>
  `;
}

function renderError(message) {
  app.innerHTML = `<div class="state-panel">${escapeHtml(message)}</div>`;
}

async function loadStudent() {
  state.studentData = await api("/api/student-info");
  renderStudent();
}

function renderStudent() {
  const { student, scores } = state.studentData;

  app.innerHTML = `
    <div class="stack">
      <section class="panel">
        <div class="panel-header">
          <h2>${formatValue(student.fullName)}</h2>
          ${statusBadge(student.classStatus)}
        </div>
        <div class="panel-body">
          <div class="profile-grid">
            ${profileItem("Ngày sinh", formatDate(student.dateOfBirth))}
            ${profileItem("Lớp", student.classCode)}
            ${profileItem("Ngành", student.major)}
            ${profileItem("Khóa học", student.course)}
            ${profileItem("Mã học sinh", student.studentCode)}
            ${profileItem("Bậc đào tạo", student.educationLevel)}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>Điểm các môn</h2>
          <span class="badge">${scores.length} môn</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Môn học</th>
                <th>Mã môn</th>
                <th>Số tiết</th>
                <th>Vắng</th>
                <th>Điểm tổng</th>
              </tr>
            </thead>
            <tbody>
              ${
                scores.length
                  ? scores.map((score, index) => renderStudentScoreRow(score, index)).join("")
                  : `<tr><td colspan="5" class="empty">Chưa có dữ liệu điểm.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  app.querySelectorAll(".score-row").forEach((row) => {
    row.addEventListener("click", () => toggleScoreDetail(row));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleScoreDetail(row);
      }
    });
  });
}

function renderStudentScoreRow(score, index) {
  const detailId = `student-score-${index}`;

  return `
    <tr class="score-row" tabindex="0" data-detail="${detailId}">
      <td><strong>${formatValue(score.subjectName)}</strong></td>
      <td>${formatValue(score.subjectCode)}</td>
      <td>${formatValue(score.period)}</td>
      <td>${formatValue(score.absentSessions)}</td>
      <td><strong>${formatScore(score.finalScore, "Chưa đủ điểm")}</strong></td>
    </tr>
    <tr class="score-detail" id="${detailId}">
      <td colspan="5">
        <div class="detail-grid">
          ${detailItem("KTTX 1", score.kttx1, true)}
          ${detailItem("KTTX 2", score.kttx2, true)}
          ${detailItem("KTĐK 1", score.ktdk1, true)}
          ${detailItem("KTĐK 2", score.ktdk2, true)}
          ${detailItem("ĐTB", score.processScoreAverage, true)}
          ${detailItem("KTM 1", score.ktm1, true)}
          ${detailItem("KTM 2", score.ktm2, true)}
          ${detailItem("Điểm tổng", score.finalScore, true)}
        </div>
      </td>
    </tr>
  `;
}

function toggleScoreDetail(row) {
  const detail = document.getElementById(row.dataset.detail);
  detail?.classList.toggle("open");
}

async function loadTeacher() {
  state.teacherData = await api("/api/teacher/classes");
  state.activeTeacherClassId =
    state.activeTeacherClassId || state.teacherData.classes[0]?.class_id || null;
  await loadTeacherDetail();
}

async function loadTeacherDetail() {
  if (!state.activeTeacherClassId) {
    state.teacherDetail = null;
    renderTeacher();
    return;
  }

  state.teacherDetail = await api(`/api/teacher/classes/${state.activeTeacherClassId}`);
  renderTeacher();
}

function renderTeacher() {
  const classes = state.teacherData.classes || [];

  app.innerHTML = `
    <div class="stack">
      <section class="panel">
        <div class="panel-header">
          <h2>Lớp được phân công</h2>
          <span class="badge">${classes.length} lớp</span>
        </div>
        <div class="panel-body">
          ${
            classes.length
              ? `<div class="class-list">${classes.map(renderClassButton).join("")}</div>`
              : `<div class="empty">Chưa có lớp được phân công.</div>`
          }
        </div>
      </section>

      <div id="teacherDetail">
        ${state.teacherDetail ? renderTeacherDetail(state.teacherDetail) : ""}
      </div>
    </div>
  `;

  app.querySelectorAll("[data-class-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.activeTeacherClassId = Number(button.dataset.classId);
      await loadTeacherDetail();
    });
  });

  app.querySelectorAll("[data-action='save-score']").forEach((button) => {
    button.addEventListener("click", () => saveScore(button));
  });
}

function renderClassButton(item) {
  const activeClass = item.class_id === state.activeTeacherClassId ? "active" : "";

  return `
    <button type="button" class="class-button ${activeClass}" data-class-id="${item.class_id}">
      <strong>${formatValue(item.class_code)}</strong>
      <span>${formatValue(item.major)}</span>
      <span>${formatValue(item.course)}</span>
      <span>${item.student_count} học sinh, ${item.subject_count} môn</span>
    </button>
  `;
}

function renderTeacherDetail(detail) {
  const classInfo = detail.classInfo;

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>${formatValue(classInfo.class_code)}</h2>
        ${statusBadge(classInfo.status)}
      </div>
      <div class="panel-body">
        <div class="profile-grid">
          ${profileItem("Ngành", classInfo.major)}
          ${profileItem("Bậc đào tạo", classInfo.education_level)}
          ${profileItem("Khóa học", classInfo.course)}
          ${profileItem("Giáo viên phụ trách", classInfo.homeroom_teacher_name)}
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Học sinh trong lớp</h3>
        <span class="badge">${detail.students.length} học sinh</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã học sinh</th>
              <th>Họ tên</th>
              <th>Ngày sinh</th>
            </tr>
          </thead>
          <tbody>
            ${
              detail.students.length
                ? detail.students
                    .map(
                      (student) => `
                        <tr>
                          <td>${formatValue(student.student_code)}</td>
                          <td><strong>${formatValue(student.full_name)}</strong></td>
                          <td>${formatDate(student.date_of_birth)}</td>
                        </tr>
                      `,
                    )
                    .join("")
                : `<tr><td colspan="3" class="empty">Chưa có học sinh trong lớp.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Điểm học sinh</h3>
        <span class="badge">${detail.scores.length} dòng điểm</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Học sinh</th>
              <th>Môn</th>
              <th>KTTX 1</th>
              <th>KTTX 2</th>
              <th>KTĐK 1</th>
              <th>KTĐK 2</th>
              <th>KTM 1</th>
              <th>KTM 2</th>
              <th>Tổng</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${
              detail.scores.length
                ? detail.scores.map(renderTeacherScoreRow).join("")
                : `<tr><td colspan="10" class="empty">Chưa có dữ liệu điểm.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTeacherScoreRow(score) {
  const scoreCells = ["kttx1", "kttx2", "ktdk1", "ktdk2", "ktm1", "ktm2"]
    .map((field) => {
      if (!score.canUpdate) {
        return `<td>${formatScore(score[field])}</td>`;
      }

      return `
        <td>
          <input
            class="score-input"
            type="number"
            min="0"
            max="10"
            step="0.1"
            data-field="${field}"
            value="${escapeAttr(scoreInputValue(score[field]))}"
          />
        </td>
      `;
    })
    .join("");

  return `
    <tr data-student-id="${score.studentId}" data-subject-id="${score.subjectId}">
      <td>
        <strong>${formatValue(score.studentName)}</strong><br />
        ${formatValue(score.studentCode)}
      </td>
      <td>
        <strong>${formatValue(score.subjectName)}</strong><br />
        ${formatValue(score.subjectCode)}
      </td>
      ${scoreCells}
      <td><strong>${formatScore(score.finalScore)}</strong></td>
      <td>
        <button
          type="button"
          class="button button-primary"
          data-action="save-score"
          ${score.canUpdate ? "" : "disabled"}
        >
          Lưu
        </button>
      </td>
    </tr>
  `;
}

async function saveScore(button) {
  const row = button.closest("tr");
  const body = {};

  row.querySelectorAll("[data-field]").forEach((input) => {
    body[input.dataset.field] = input.value;
  });

  try {
    button.disabled = true;
    await api(`/api/teacher/scores/${row.dataset.studentId}/${row.dataset.subjectId}`, {
      method: "PUT",
      body,
    });
    showToast("Đã cập nhật điểm.");
    await loadTeacherDetail();
  } catch (error) {
    showToast(error.message, "error");
    button.disabled = false;
  }
}

async function loadManagement(view = state.managementView) {
  state.managementData = await api("/api/management/overview");
  state.managementView = view;
  renderManagement();
}

function managementNavItems() {
  const items = [
    { id: "overview", label: "Tổng quan" },
    { id: "classes", label: "Lớp học" },
    { id: "students", label: "Học sinh" },
    { id: "teachers", label: "Giáo viên" },
    { id: "accounts", label: "Tài khoản" },
  ];

  if (state.me.account.role === "admin") {
    items.splice(1, 0, { id: "academic", label: "Giáo vụ" });
  }

  return items;
}

function renderManagement() {
  const data = state.managementData;

  setSidebar(managementNavItems(), state.managementView, async (view) => {
    state.managementView = view;
    renderManagement();
  });

  app.innerHTML = `
    <div class="stack">
      ${renderSummary(data.counts)}
      ${renderManagementContent()}
    </div>
  `;

  attachManagementEvents();
}

function renderSummary(counts) {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Tổng quan dữ liệu</h2>
      </div>
      <div class="panel-body">
        <div class="summary-grid">
          ${summaryItem("Tài khoản", counts.accounts)}
          ${summaryItem("Giáo vụ", counts.academic_executors)}
          ${summaryItem("Giáo viên", counts.teachers)}
          ${summaryItem("Học sinh", counts.students)}
          ${summaryItem("Lớp học", counts.classes)}
          ${summaryItem("Môn học", counts.subjects)}
        </div>
      </div>
    </section>
  `;
}

function summaryItem(label, value) {
  return `
    <div class="summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${formatValue(value)}</strong>
    </div>
  `;
}

function renderManagementContent() {
  if (state.managementView === "academic") {
    return renderAcademicManagement();
  }

  if (state.managementView === "classes") {
    return renderClassManagement();
  }

  if (state.managementView === "students") {
    return renderStudentManagement();
  }

  if (state.managementView === "teachers") {
    return renderTeacherManagement();
  }

  if (state.managementView === "accounts") {
    return renderAccountsTable();
  }

  return renderOverviewTables();
}

function renderOverviewTables() {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Môn học</h2>
        <span class="badge">${state.managementData.subjects.length} môn</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thứ tự</th>
              <th>Mã môn</th>
              <th>Tên môn</th>
              <th>Số tiết</th>
            </tr>
          </thead>
          <tbody>
            ${state.managementData.subjects
              .map(
                (subject) => `
                  <tr>
                    <td>${formatValue(subject.subject_order)}</td>
                    <td>${formatValue(subject.subject_code)}</td>
                    <td><strong>${formatValue(subject.subject_name)}</strong></td>
                    <td>${formatValue(subject.period)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAcademicManagement() {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Tạo tài khoản giáo vụ</h2>
      </div>
      <div class="panel-body">
        <form class="form-grid" id="createAcademicForm">
          ${field("username", "Tài khoản", "academic003")}
          ${field("password", "Mật khẩu", "123456", "password")}
          ${field("staffCode", "Mã giáo vụ", "GVU003")}
          ${field("fullName", "Họ tên", "Nguyen Van A")}
          ${field("phone", "Số điện thoại", "0912000003", "tel", false)}
          ${field("email", "Email", "academic003@example.com", "email", false)}
          <div class="form-actions">
            <button type="submit" class="button button-primary">Tạo</button>
          </div>
        </form>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Danh sách giáo vụ</h2>
        <span class="badge">${state.managementData.academicExecutors.length} dòng</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã giáo vụ</th>
              <th>Họ tên</th>
              <th>Tài khoản</th>
              <th>Trạng thái</th>
              <th>Mật khẩu mới</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.managementData.academicExecutors.map(renderAcademicEditRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAcademicEditRow(item) {
  return `
    <tr data-id="${item.id}">
      <td><input class="table-input" data-field="staffCode" value="${escapeAttr(item.staff_code)}" /></td>
      <td><input class="table-input" data-field="fullName" value="${escapeAttr(item.full_name)}" /></td>
      <td><input class="table-input" data-field="username" value="${escapeAttr(item.username)}" /></td>
      <td>
        <select class="table-input" data-field="status">
          ${accountStatusOptions(item.status)}
        </select>
      </td>
      <td><input class="table-input" type="password" data-field="password" placeholder="Để trống" /></td>
      <td><input class="table-input" data-field="email" value="${escapeAttr(item.email || "")}" /></td>
      <td><input class="table-input" data-field="phone" value="${escapeAttr(item.phone || "")}" /></td>
      <td>
        <div class="row-actions">
          <button type="button" class="button button-muted" data-action="save-academic">Lưu</button>
          <button type="button" class="button button-danger" data-action="delete-academic">Xóa</button>
        </div>
      </td>
    </tr>
  `;
}

function renderTeacherManagement() {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Tạo tài khoản giáo viên</h2>
      </div>
      <div class="panel-body">
        <form class="form-grid" id="createTeacherForm">
          ${field("username", "Tài khoản", "teacher005")}
          ${field("password", "Mật khẩu", "123456", "password")}
          ${field("teacherCode", "Mã giáo viên", "GV005")}
          ${field("fullName", "Họ tên", "Tran Van B")}
          ${field("phone", "Số điện thoại", "0901000005", "tel", false)}
          ${field("email", "Email", "teacher005@example.com", "email", false)}
          ${field("dateOfBirth", "Ngày sinh", "", "date", false)}
          <div class="form-actions">
            <button type="submit" class="button button-primary">Tạo</button>
          </div>
        </form>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Danh sách giáo viên</h2>
        <span class="badge">${state.managementData.teachers.length} dòng</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Họ tên</th>
              <th>Tài khoản</th>
              <th>Trạng thái</th>
              <th>Mật khẩu mới</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>Ngày sinh</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.managementData.teachers.map(renderTeacherEditRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTeacherEditRow(teacher) {
  return `
    <tr data-id="${teacher.id}">
      <td><input class="table-input" data-field="teacherCode" value="${escapeAttr(teacher.teacher_code)}" /></td>
      <td><input class="table-input" data-field="fullName" value="${escapeAttr(teacher.full_name)}" /></td>
      <td><input class="table-input" data-field="username" value="${escapeAttr(teacher.username || "")}" /></td>
      <td>
        <select class="table-input" data-field="status">
          ${accountStatusOptions(teacher.status)}
        </select>
      </td>
      <td><input class="table-input" type="password" data-field="password" placeholder="Để trống" /></td>
      <td><input class="table-input" data-field="email" value="${escapeAttr(teacher.email || "")}" /></td>
      <td><input class="table-input" data-field="phone" value="${escapeAttr(teacher.phone || "")}" /></td>
      <td><input class="table-input" type="date" data-field="dateOfBirth" value="${escapeAttr(teacher.date_of_birth || "")}" /></td>
      <td>
        <div class="row-actions">
          <button type="button" class="button button-muted" data-action="save-teacher">Lưu</button>
          <button type="button" class="button button-danger" data-action="delete-teacher">Xóa</button>
        </div>
      </td>
    </tr>
  `;
}

function renderStudentManagement() {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Thêm học sinh</h2>
      </div>
      <div class="panel-body">
        <form class="form-grid" id="createStudentForm">
          ${field("username", "Tài khoản", "student007")}
          ${field("password", "Mật khẩu", "123456", "password")}
          ${field("studentCode", "Mã học sinh", "SV007")}
          ${field("fullName", "Họ tên", "Le Van C")}
          ${field("dateOfBirth", "Ngày sinh", "", "date", false)}
          ${selectField("classId", "Lớp", classOptions())}
          <div class="form-actions">
            <button type="submit" class="button button-primary">Thêm</button>
          </div>
        </form>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Danh sách học sinh</h2>
        <span class="badge">${state.managementData.students.length} dòng</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Họ tên</th>
              <th>Tài khoản</th>
              <th>Trạng thái</th>
              <th>Mật khẩu mới</th>
              <th>Ngày sinh</th>
              <th>Lớp</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.managementData.students.map(renderStudentEditRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderStudentEditRow(student) {
  return `
    <tr data-id="${student.id}">
      <td><input class="table-input" data-field="studentCode" value="${escapeAttr(student.student_code)}" /></td>
      <td><input class="table-input" data-field="fullName" value="${escapeAttr(student.full_name)}" /></td>
      <td><input class="table-input" data-field="username" value="${escapeAttr(student.username)}" /></td>
      <td>
        <select class="table-input" data-field="status">
          ${accountStatusOptions(student.status)}
        </select>
      </td>
      <td><input class="table-input" type="password" data-field="password" placeholder="Để trống" /></td>
      <td><input class="table-input" type="date" data-field="dateOfBirth" value="${escapeAttr(student.date_of_birth || "")}" /></td>
      <td>
        <select class="table-input" data-field="classId">
          ${classOptions(student.class_id)}
        </select>
      </td>
      <td>
        <div class="row-actions">
          <button type="button" class="button button-muted" data-action="save-student">Lưu</button>
          <button type="button" class="button button-danger" data-action="delete-student">Xóa</button>
        </div>
      </td>
    </tr>
  `;
}

function renderClassManagement() {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Thêm lớp</h2>
      </div>
      <div class="panel-body">
        <form class="form-grid" id="createClassForm">
          ${field("classCode", "Mã lớp", "CNTT-K49")}
          ${field("schoolYearStart", "Năm bắt đầu", "2027", "number")}
          ${field("schoolYearEnd", "Năm kết thúc", "2029", "number")}
          ${field("major", "Ngành", "Cong nghe thong tin")}
          ${field("educationLevel", "Bậc đào tạo", "Trung cap")}
          ${selectField("status", "Trạng thái", statusOptions())}
          ${selectField("homeroomTeacherId", "Giáo viên phụ trách", teacherOptions())}
          <div class="form-actions">
            <button type="submit" class="button button-primary">Thêm</button>
          </div>
        </form>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Danh sách lớp</h2>
        <span class="badge">${state.managementData.classes.length} dòng</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã lớp</th>
              <th>Năm bắt đầu</th>
              <th>Năm kết thúc</th>
              <th>Ngành</th>
              <th>Bậc</th>
              <th>Trạng thái</th>
              <th>GVCN</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.managementData.classes.map(renderClassEditRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderClassEditRow(item) {
  return `
    <tr data-id="${item.id}">
      <td><input class="table-input" data-field="classCode" value="${escapeAttr(item.class_code)}" /></td>
      <td><input class="table-input" type="number" data-field="schoolYearStart" value="${escapeAttr(item.school_year_start)}" /></td>
      <td><input class="table-input" type="number" data-field="schoolYearEnd" value="${escapeAttr(item.school_year_end)}" /></td>
      <td><input class="table-input" data-field="major" value="${escapeAttr(item.major)}" /></td>
      <td><input class="table-input" data-field="educationLevel" value="${escapeAttr(item.education_level)}" /></td>
      <td>
        <select class="table-input" data-field="status">
          ${statusOptions(item.status)}
        </select>
      </td>
      <td>
        <select class="table-input" data-field="homeroomTeacherId">
          ${teacherOptions(item.homeroom_teacher_id)}
        </select>
      </td>
      <td>
        <div class="row-actions">
          <button type="button" class="button button-muted" data-action="save-class">Lưu</button>
          <button type="button" class="button button-danger" data-action="delete-class">Xóa</button>
        </div>
      </td>
    </tr>
  `;
}

function renderAccountsTable() {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Tài khoản</h2>
        <span class="badge">${state.managementData.accounts.length} dòng</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            ${state.managementData.accounts
              .map(
                (account) => `
                  <tr>
                    <td><strong>${formatValue(account.username)}</strong></td>
                    <td>${formatValue(account.roleLabel)}</td>
                    <td>${formatValue(account.status)}</td>
                    <td>${formatDate(account.createdAt)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function field(name, label, placeholder = "", type = "text", required = true) {
  return `
    <div class="field">
      <label for="${escapeAttr(name)}">${escapeHtml(label)}</label>
      <input
        id="${escapeAttr(name)}"
        name="${escapeAttr(name)}"
        type="${escapeAttr(type)}"
        placeholder="${escapeAttr(placeholder)}"
        ${required ? "required" : ""}
      />
    </div>
  `;
}

function selectField(name, label, options) {
  return `
    <div class="field">
      <label for="${escapeAttr(name)}">${escapeHtml(label)}</label>
      <select id="${escapeAttr(name)}" name="${escapeAttr(name)}">
        ${options}
      </select>
    </div>
  `;
}

function classOptions(selected = "") {
  return `
    <option value="">Chưa xếp lớp</option>
    ${state.managementData.classes
      .map(
        (item) => `
          <option value="${item.id}" ${String(item.id) === String(selected) ? "selected" : ""}>
            ${formatValue(item.class_code)}
          </option>
        `,
      )
      .join("")}
  `;
}

function teacherOptions(selected = "") {
  return `
    <option value="">Chưa phân công</option>
    ${state.managementData.teachers
      .map(
        (item) => `
          <option value="${item.id}" ${String(item.id) === String(selected) ? "selected" : ""}>
            ${formatValue(item.teacher_code)} - ${formatValue(item.full_name)}
          </option>
        `,
      )
      .join("")}
  `;
}

function statusOptions(selected = "open") {
  return `
    <option value="open" ${selected === "open" ? "selected" : ""}>Đang mở</option>
    <option value="closed" ${selected === "closed" ? "selected" : ""}>Đã đóng</option>
  `;
}

function accountStatusOptions(selected = "active") {
  const status = selected || "active";

  return `
    <option value="active" ${status === "active" ? "selected" : ""}>Đang hoạt động</option>
    <option value="inactive" ${status === "inactive" ? "selected" : ""}>Ngừng hoạt động</option>
    <option value="locked" ${status === "locked" ? "selected" : ""}>Đã khóa</option>
  `;
}

function collectRowPayload(button) {
  const row = button.closest("tr");
  const payload = {};

  row.querySelectorAll("[data-field]").forEach((input) => {
    payload[input.dataset.field] = input.value;
  });

  return {
    id: row.dataset.id,
    payload,
  };
}

function bindForm(id, handler) {
  const form = document.getElementById(id);

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type='submit']");

    try {
      button.disabled = true;
      await handler(form);
      form.reset();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}

function attachManagementEvents() {
  bindForm("createAcademicForm", async (form) => {
    await api("/api/admin/academic-executors", {
      method: "POST",
      body: formToObject(form),
    });
    showToast("Đã tạo tài khoản giáo vụ.");
    await loadManagement("academic");
  });

  bindForm("createTeacherForm", async (form) => {
    await api("/api/management/teachers", {
      method: "POST",
      body: formToObject(form),
    });
    showToast("Đã tạo tài khoản giáo viên.");
    await loadManagement("teachers");
  });

  bindForm("createStudentForm", async (form) => {
    await api("/api/management/students", {
      method: "POST",
      body: formToObject(form),
    });
    showToast("Đã thêm học sinh.");
    await loadManagement("students");
  });

  bindForm("createClassForm", async (form) => {
    await api("/api/management/classes", {
      method: "POST",
      body: formToObject(form),
    });
    showToast("Đã thêm lớp.");
    await loadManagement("classes");
  });

  app.querySelectorAll("[data-action='save-academic']").forEach((button) => {
    button.addEventListener("click", async () => {
      const { id, payload } = collectRowPayload(button);
      await runManagementAction(
        button,
        `/api/admin/academic-executors/${id}`,
        "PUT",
        payload,
        "Đã lưu giáo vụ.",
      );
    });
  });

  app.querySelectorAll("[data-action='delete-academic']").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Xóa tài khoản giáo vụ này?")) {
        return;
      }

      const { id } = collectRowPayload(button);
      await runManagementAction(
        button,
        `/api/admin/academic-executors/${id}`,
        "DELETE",
        null,
        "Đã xóa giáo vụ.",
      );
    });
  });

  app.querySelectorAll("[data-action='save-teacher']").forEach((button) => {
    button.addEventListener("click", async () => {
      const { id, payload } = collectRowPayload(button);
      await runManagementAction(button, `/api/management/teachers/${id}`, "PUT", payload, "Đã lưu giáo viên.");
    });
  });

  app.querySelectorAll("[data-action='delete-teacher']").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Xóa tài khoản giáo viên này?")) {
        return;
      }

      const { id } = collectRowPayload(button);
      await runManagementAction(
        button,
        `/api/management/teachers/${id}`,
        "DELETE",
        null,
        "Đã xóa giáo viên.",
      );
    });
  });

  app.querySelectorAll("[data-action='save-student']").forEach((button) => {
    button.addEventListener("click", async () => {
      const { id, payload } = collectRowPayload(button);
      await runManagementAction(button, `/api/management/students/${id}`, "PUT", payload, "Đã lưu học sinh.");
    });
  });

  app.querySelectorAll("[data-action='delete-student']").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Xóa học sinh này?")) {
        return;
      }

      const { id } = collectRowPayload(button);
      await runManagementAction(button, `/api/management/students/${id}`, "DELETE", null, "Đã xóa học sinh.");
    });
  });

  app.querySelectorAll("[data-action='save-class']").forEach((button) => {
    button.addEventListener("click", async () => {
      const { id, payload } = collectRowPayload(button);
      await runManagementAction(button, `/api/management/classes/${id}`, "PUT", payload, "Đã lưu lớp.");
    });
  });

  app.querySelectorAll("[data-action='delete-class']").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Xóa lớp này?")) {
        return;
      }

      const { id } = collectRowPayload(button);
      await runManagementAction(button, `/api/management/classes/${id}`, "DELETE", null, "Đã xóa lớp.");
    });
  });
}

async function runManagementAction(button, path, method, body, successMessage) {
  try {
    button.disabled = true;
    await api(path, { method, body });
    showToast(successMessage);
    await loadManagement(state.managementView);
  } catch (error) {
    showToast(error.message, "error");
    button.disabled = false;
  }
}

async function init() {
  try {
    state.me = await api("/api/me");
    setHeader();

    if (state.me.account.role === "student") {
      setSidebar([{ id: "student", label: "Hồ sơ và điểm" }], "student", () => renderStudent());
      await loadStudent();
      return;
    }

    if (state.me.account.role === "teacher") {
      setSidebar([{ id: "teacher", label: "Lớp được phân công" }], "teacher", () => renderTeacher());
      await loadTeacher();
      return;
    }

    if (state.me.account.role === "admin" || state.me.account.role === "academic_executor") {
      setSidebar(managementNavItems(), state.managementView, (view) => {
        state.managementView = view;
        renderManagement();
      });
      await loadManagement("overview");
      return;
    }

    renderError("Vai trò tài khoản chưa được hỗ trợ.");
  } catch (error) {
    renderError(error.message);
  }
}

init();
