const appElement = document.getElementById("app");
const sidebarElement = document.getElementById("sidebar");
const pageTitleElement = document.getElementById("pageTitle");
const roleLabelElement = document.getElementById("roleLabel");
const accountNameElement = document.getElementById("accountName");
const accountMetaElement = document.getElementById("accountMeta");
const toastElement = document.getElementById("toast");

const state = {
  me: null,
  activeView: null,
  student: null,
  teacher: null,
  management: null,
  gradebook: null,
  editing: {},
};

const roleLabels = {
  admin: "Admin",
  academic_executor: "Giáo vụ",
  teacher: "Giáo viên",
  student: "Học sinh",
};

const statusLabels = {
  active: "Hoạt động",
  block: "Khóa",
  planned: "Dự kiến",
  open: "Đang mở",
  closed: "Đã đóng",
  studying: "Đang học",
  repeat_course: "Học lại",
  retake_exam: "Thi lại",
  passed: "Đạt",
  permanent: "Cơ hữu",
  visiting: "Thỉnh giảng",
  regular: "Chính",
  supplementary: "Bổ sung",
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function formatValue(value, fallback = "—") {
  return value === null || value === undefined || value === ""
    ? fallback
    : escapeHtml(value);
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatScore(value) {
  return value === null || value === undefined
    ? "—"
    : Number(value).toFixed(1);
}

function showToast(message, type = "success") {
  toastElement.textContent = message;
  toastElement.className = `toast${type === "error" ? " error" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastElement.classList.add("hidden");
  }, 3200);
}

async function api(path, options = {}) {
  const request = {
    method: options.method || "GET",
    headers: {},
  };
  if (options.body !== undefined) {
    request.headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, request);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    throw new Error(data?.message || data || "Có lỗi xảy ra.");
  }
  return data;
}

function panel(title, body, actions = "") {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>${escapeHtml(title)}</h2>
        ${actions}
      </div>
      <div class="panel-body">${body}</div>
    </section>
  `;
}

function badge(value) {
  const danger = ["block", "closed", "repeat_course"].includes(value);
  const warning = ["planned", "retake_exam", "supplementary"].includes(value);
  const success = ["active", "open", "passed"].includes(value);
  const className = danger
    ? "badge-danger"
    : warning
      ? "badge-warning"
      : success
        ? "badge-success"
        : "";
  return `<span class="badge ${className}">${escapeHtml(statusLabels[value] || value)}</span>`;
}

function setHeader() {
  const role = state.me.account.role;
  roleLabelElement.textContent = roleLabels[role] || role;
  accountNameElement.textContent =
    state.me.person?.fullName || state.me.account.username;
  accountMetaElement.textContent = state.me.account.username;
}

function navigationForRole(role) {
  if (role === "student") {
    return [{ id: "student", label: "Hồ sơ & kết quả" }];
  }
  if (role === "teacher") {
    return [{ id: "teacher", label: "Lớp được phân công" }];
  }

  const items = [
    { id: "overview", label: "Tổng quan" },
    { id: "gradebooks", label: "Bảng điểm lớp" },
    { id: "teachers", label: "Giáo viên" },
    { id: "students", label: "Học sinh" },
    { id: "assignments", label: "Phân công giảng dạy" },
  ];

  if (role === "admin") {
    items.splice(
      2,
      0,
      { id: "programs", label: "Ngành đào tạo" },
      { id: "subjects", label: "Môn học" },
      { id: "curriculum", label: "Chương trình học" },
      { id: "classes", label: "Lớp học" },
      { id: "academics", label: "Giáo vụ" },
    );
    items.push({ id: "accounts", label: "Tài khoản" });
  }
  return items;
}

function renderSidebar() {
  const items = navigationForRole(state.me.account.role);
  sidebarElement.innerHTML = items
    .map(
      (item) => `
        <button class="nav-button ${item.id === state.activeView ? "active" : ""}"
                data-view="${item.id}">
          ${escapeHtml(item.label)}
        </button>
      `,
    )
    .join("");
  sidebarElement.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.view));
  });
}

async function navigate(view) {
  state.activeView = view;
  state.gradebook = null;
  renderSidebar();
  try {
    if (view === "student") await renderStudent();
    else if (view === "teacher") await renderTeacher();
    else {
      await loadManagement();
      renderManagementView(view);
    }
  } catch (error) {
    appElement.innerHTML = `<div class="state-panel">${escapeHtml(error.message)}</div>`;
    showToast(error.message, "error");
  }
}

async function renderStudent() {
  pageTitleElement.textContent = "Hồ sơ học sinh";
  state.student ??= await api("/api/student-info");
  const { student, scores } = state.student;
  const profile = [
    ["Mã học sinh", student.studentCode],
    ["Họ tên", student.fullName],
    ["Ngày sinh", formatDate(student.dateOfBirth)],
    ["Giới tính", statusLabels[student.gender]],
    ["Lớp", student.classCode],
    ["Khóa", student.cohortCode],
    ["Ngành", `${student.programCode} — ${student.programName}`],
    ["Học kỳ", `${student.currentSemester}/${student.totalSemesters}`],
    ["Đã đóng học phí", `Tới kỳ ${student.tuitionPaidThroughSemester}`],
    ["Công nợ", formatMoney(student.outstandingDebt)],
  ];
  const rows = scores
    .map(
      (score) => `
      <tr>
        <td>${score.semesterNo}</td>
        <td>${formatValue(statusLabels[score.termType])}</td>
        <td>${formatValue(score.subjectCode)}</td>
        <td>${formatValue(score.subjectName)}</td>
        <td>${score.credits}</td>
        <td>${formatScore(score.processAverage)}</td>
        <td>${formatScore(score.ktm1)}</td>
        <td>${formatScore(score.ktm2)}</td>
        <td>${formatScore(score.finalScore)}</td>
        <td>${score.absentSessions}/${score.plannedSessions}</td>
        <td>${badge(score.learningStatus)}</td>
      </tr>
    `,
    )
    .join("");
  appElement.innerHTML = `
    <div class="stack">
      ${panel(
        "Thông tin học sinh",
        `<div class="profile-grid">${profile
          .map(
            ([label, value]) =>
              `<div class="profile-card"><span>${label}</span><strong>${value}</strong></div>`,
          )
          .join("")}</div>`,
      )}
      ${panel(
        "Kết quả học tập",
        `<div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Học kỳ</th><th>Loại kỳ</th><th>Mã môn</th><th>Môn học</th><th>TC</th>
              <th>TB quá trình</th><th>KTM1</th><th>KTM2</th>
              <th>Điểm tổng</th><th>Vắng</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>${rows || `<tr><td colspan="11" class="empty">Chưa có môn học.</td></tr>`}</tbody>
          </table>
        </div>`,
      )}
    </div>
  `;
}

async function renderTeacher() {
  pageTitleElement.textContent = "Lớp được phân công";
  state.teacher = await api("/api/teacher/classes");
  const cards = state.teacher.assignments
    .map(
      (item) => `
        <button class="course-card" data-gradebook="${item.class_subject_id}">
          <strong>${escapeHtml(item.class_code)} · ${escapeHtml(item.subject_name)}</strong>
          <span>${escapeHtml(item.subject_code)} · ${item.credits} tín chỉ · ${item.total_periods} tiết</span>
          <span>Học kỳ ${item.semester_no} · ${statusLabels[item.term_type]}</span>
          <span>${item.student_count} học sinh · ${item.planned_sessions} buổi</span>
          <span>${badge(item.class_subject_status)}</span>
        </button>
      `,
    )
    .join("");
  appElement.innerHTML = panel(
    "Danh sách lớp - môn",
    `<div class="card-grid">${cards || `<div class="empty">Chưa có phân công.</div>`}</div>`,
  );
  bindGradebookButtons();
}

async function loadManagement(force = false) {
  if (!state.management || force) {
    state.management = await api("/api/management/overview");
  }
}

function renderManagementView(view) {
  const titles = {
    overview: "Tổng quan vận hành",
    gradebooks: "Bảng điểm lớp",
    programs: "Ngành đào tạo",
    subjects: "Môn học",
    curriculum: "Chương trình học",
    classes: "Lớp học",
    academics: "Giáo vụ",
    teachers: "Giáo viên",
    students: "Học sinh",
    assignments: "Phân công giảng dạy",
    accounts: "Tài khoản",
  };
  pageTitleElement.textContent = titles[view] || "Quản lý";
  if (view === "overview") renderOverview();
  else if (view === "gradebooks") renderGradebookList();
  else if (view === "assignments") renderAssignments();
  else if (view === "accounts") renderAccounts();
  else renderCrud(view);
}

function renderOverview() {
  const counts = state.management.counts;
  const cards = [
    ["Tài khoản", counts.accounts],
    ["Giáo vụ", counts.academic_executors],
    ["Giáo viên", counts.teachers],
    ["Học sinh", counts.students],
    ["Lớp", counts.classes],
    ["Môn học", counts.subjects],
    ["Ngành", counts.programs],
    ["Môn đang mở", counts.open_courses],
  ];
  appElement.innerHTML = `
    <div class="stack">
      ${panel(
        "Số liệu tổng quan",
        `<div class="summary-grid">${cards
          .map(
            ([label, value]) =>
              `<div class="summary-card"><span>${label}</span><strong>${value}</strong></div>`,
          )
          .join("")}</div>`,
      )}
      ${panel(
        "Lớp - môn đang mở",
        courseCards(
          state.management.classSubjects.filter(
            (item) => item.class_subject_status === "open",
          ),
        ),
      )}
    </div>
  `;
  bindGradebookButtons();
}

function courseCards(items) {
  return `<div class="card-grid">${items
    .map(
      (item) => `
        <button class="course-card" data-gradebook="${item.class_subject_id}">
          <strong>${escapeHtml(item.class_code)} · ${escapeHtml(item.subject_name)}</strong>
          <span>${escapeHtml(item.program_code)} · Học kỳ ${item.semester_no}</span>
          <span>${formatValue(item.teacher_name, "Chưa phân công")}</span>
          <span>${item.student_count} học sinh · ${item.planned_sessions} buổi</span>
          <span>${badge(item.class_subject_status)}</span>
        </button>`,
    )
    .join("")}</div>`;
}

function renderGradebookList() {
  appElement.innerHTML = panel(
    "Chọn lớp - môn",
    courseCards(state.management.classSubjects),
  );
  bindGradebookButtons();
}

function bindGradebookButtons() {
  document.querySelectorAll("[data-gradebook]").forEach((button) => {
    button.addEventListener("click", () =>
      openGradebook(button.dataset.gradebook),
    );
  });
}

async function openGradebook(classSubjectId) {
  appElement.innerHTML = `<div class="state-panel">Đang tải bảng điểm...</div>`;
  state.gradebook = await api(`/api/gradebook/${classSubjectId}`);
  renderGradebook();
}

function renderGradebook() {
  const { assignment, sessions, students } = state.gradebook;
  pageTitleElement.textContent = `${assignment.class_code} · ${assignment.subject_name}`;
  const editable = assignment.class_subject_status === "open";
  const attendanceHeaders = sessions
    .map(
      (session) => `
        <th class="date-cell attendance-cell">
          <span class="session-number">Buổi ${session.session_no} · ${session.lesson_periods} tiết</span>
          <input class="session-date-input"
                 type="date"
                 value="${escapeAttr(session.study_date || "")}"
                 data-session-date
                 data-session-id="${session.id}"
                 aria-label="Ngày học buổi ${session.session_no}">
        </th>`,
    )
    .join("");
  const rows = students
    .map((student, index) =>
      renderGradebookRow(student, sessions, index, editable),
    )
    .join("");

  appElement.innerHTML = `
    <div class="stack">
      ${panel(
        "Thông tin lớp - môn",
        `<div class="gradebook-meta">
          <span class="badge">${escapeHtml(assignment.program_code)}</span>
          <span class="badge">Học kỳ ${assignment.semester_no}</span>
          <span class="badge">${assignment.credits} tín chỉ</span>
          <span class="badge">${assignment.total_periods} tiết / ${assignment.planned_sessions} buổi</span>
          ${badge(assignment.class_subject_status)}
          <span class="badge">${formatValue(assignment.teacher_name, "Chưa phân công")}</span>
        </div>`,
        `<button class="button button-muted" id="backFromGradebook">Quay lại</button>`,
      )}
      <section class="panel">
        <div class="gradebook-wrap">
          <table class="gradebook">
            <thead>
              <tr>
                <th class="student-group" colspan="5">THÔNG TIN HỌC SINH</th>
                <th class="attendance-group" colspan="${Math.max(sessions.length, 1)}">BẢNG ĐIỂM DANH</th>
                <th class="score-group" colspan="11">BẢNG GHI ĐIỂM</th>
              </tr>
              <tr>
                <th class="student-cell">STT</th>
                <th class="student-cell student-name">HỌ VÀ TÊN LÓT</th>
                <th class="student-cell given-name">TÊN</th>
                <th class="student-cell">NGÀY SINH</th>
                <th class="student-cell">MÃ SV</th>
                ${attendanceHeaders || `<th class="attendance-cell">Chưa có buổi học</th>`}
                <th class="score-cell">KTTX1</th>
                <th class="score-cell">KTTX2</th>
                <th class="score-cell">KTĐK1</th>
                <th class="score-cell">KTĐK2</th>
                <th class="score-cell">TB ĐKT</th>
                <th class="score-cell">KTM1</th>
                <th class="score-cell">KTM2</th>
                <th class="score-cell">Điểm tổng</th>
                <th class="score-cell">Ghi chú</th>
                <th class="score-cell">Vắng</th>
                <th class="score-cell"></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  document.getElementById("backFromGradebook").addEventListener("click", () => {
    if (state.me.account.role === "teacher") renderTeacher();
    else renderGradebookList();
  });
  document.querySelectorAll("[data-session-date]").forEach((input) => {
    input.addEventListener("change", () => saveSessionDate(input));
  });
  document.querySelectorAll("[data-save-score]").forEach((button) => {
    button.addEventListener("click", () => saveGradebookRow(button));
  });
  document.querySelectorAll("[data-attendance]").forEach((select) => {
    select.addEventListener("change", () => saveAttendance(select));
  });
}

function renderGradebookRow(student, sessions, index, editable) {
  const attendanceCells = sessions
    .map((session) => {
      const attendance = student.attendance[session.id] || {
        status: "present",
      };
      return `
        <td class="attendance-cell">
          <select class="attendance-select"
                  data-attendance
                  data-student-id="${student.studentId}"
                  data-session-id="${session.id}"
                  ${editable ? "" : "disabled"}>
            ${option("present", "", attendance.status)}
            ${option("absent", "K", attendance.status)}
            ${option("excused", "P", attendance.status)}
            ${option("late", "M", attendance.status)}
          </select>
        </td>`;
    })
    .join("");
  return `
    <tr data-student-row="${student.studentId}">
      <td class="student-cell">${index + 1}</td>
      <td class="student-cell student-name">${formatValue(student.familyName)}</td>
      <td class="student-cell given-name">${formatValue(student.givenName)}</td>
      <td class="student-cell">${formatDate(student.dateOfBirth)}</td>
      <td class="student-cell">${formatValue(student.studentCode)}</td>
      ${attendanceCells || `<td class="attendance-cell">—</td>`}
      ${scoreCell("kttx1", student, editable)}
      ${scoreCell("kttx2", student, editable)}
      ${scoreCell("ktdk1", student, editable)}
      ${scoreCell("ktdk2", student, editable)}
      <td class="score-cell">${formatScore(student.processAverage)}</td>
      ${scoreCell("ktm1", student, editable)}
      ${scoreCell("ktm2", student, editable)}
      <td class="score-cell">${formatScore(student.finalScore)}<br>${badge(student.learningStatus)}</td>
      <td class="score-cell"><input class="table-input note-input" data-field="note" value="${escapeAttr(student.note || "")}" ${editable ? "" : "disabled"}></td>
      <td class="score-cell">${student.absentSessions}/${student.plannedSessions}</td>
      <td class="score-cell"><button class="button button-primary" data-save-score="${student.studentId}" ${editable ? "" : "disabled"}>Lưu</button></td>
    </tr>
  `;
}

function scoreCell(fieldName, student, courseEditable) {
  const fieldEditable = Boolean(student.editable[fieldName]);
  const disabled = !courseEditable || !fieldEditable;
  return `
    <td class="score-cell ${fieldEditable ? "" : "locked-cell"}">
      <input class="score-input"
             type="number"
             min="0"
             max="10"
             step="0.1"
             data-field="${fieldName}"
             value="${student[fieldName] ?? ""}"
             ${disabled ? "disabled" : ""}>
    </td>`;
}

async function saveGradebookRow(button) {
  const row = button.closest("tr");
  const body = {};
  row.querySelectorAll("[data-field]").forEach((input) => {
    body[input.dataset.field] = input.value;
  });
  try {
    button.disabled = true;
    await api(
      `/api/gradebook/${state.gradebook.assignment.class_subject_id}/students/${button.dataset.saveScore}`,
      { method: "PUT", body },
    );
    showToast("Đã lưu điểm.");
    await openGradebook(state.gradebook.assignment.class_subject_id);
  } catch (error) {
    showToast(error.message, "error");
    button.disabled = false;
  }
}

async function saveAttendance(select) {
  try {
    await api(
      `/api/gradebook/${state.gradebook.assignment.class_subject_id}/sessions/${select.dataset.sessionId}/students/${select.dataset.studentId}`,
      { method: "PUT", body: { status: select.value } },
    );
    showToast("Đã cập nhật điểm danh.");
  } catch (error) {
    showToast(error.message, "error");
    await openGradebook(state.gradebook.assignment.class_subject_id);
  }
}

async function saveSessionDate(input) {
  try {
    await api(
      `/api/gradebook/${state.gradebook.assignment.class_subject_id}/sessions/${input.dataset.sessionId}`,
      { method: "PUT", body: { studyDate: input.value } },
    );
    showToast("Đã cập nhật ngày học.");
  } catch (error) {
    showToast(error.message, "error");
    await openGradebook(state.gradebook.assignment.class_subject_id);
  }
}

const crudConfigs = {
  academics: {
    title: "Giáo vụ",
    list: "academicExecutors",
    base: "/api/admin/academic-executors",
    fields: personAccountFields(),
    columns: [
      ["username", "Tài khoản"],
      ["full_name", "Họ tên"],
      ["phone", "Điện thoại"],
      ["email", "Email"],
      ["status", "Trạng thái"],
    ],
  },
  teachers: {
    title: "Giáo viên",
    list: "teachers",
    base: "/api/management/teachers",
    fields: [
      ...personAccountFields(),
      selectDefinition("contractType", "Hợp đồng", [
        ["permanent", "Cơ hữu"],
        ["visiting", "Thỉnh giảng"],
      ], "contract_type"),
    ],
    columns: [
      ["username", "Tài khoản"],
      ["full_name", "Họ tên"],
      ["contract_type", "Hợp đồng"],
      ["phone", "Điện thoại"],
      ["status", "Trạng thái"],
    ],
  },
  students: {
    title: "Học sinh",
    list: "students",
    base: "/api/management/students",
    fields: [
      ...personAccountFields(),
      inputDefinition("studentCode", "Mã học sinh", "text", "student_code"),
      selectDefinition(
        "classId",
        "Lớp",
        () =>
          state.management.classes.map((item) => [
            item.id,
            item.class_code,
          ]),
        "class_id",
      ),
      inputDefinition("currentSemester", "Học kỳ hiện tại", "number", "current_semester", 'min="1" max="20"'),
      inputDefinition("tuitionPaidThroughSemester", "Đã đóng tới kỳ", "number", "tuition_paid_through_semester", 'min="0" max="20"'),
      inputDefinition("tuitionPerSemester", "Học phí/kỳ", "number", "tuition_per_semester", 'min="0"'),
    ],
    columns: [
      ["student_code", "Mã SV"],
      ["full_name", "Họ tên"],
      ["class_code", "Lớp"],
      ["current_semester", "Học kỳ"],
      ["tuition_paid_through_semester", "Đã đóng"],
      ["outstanding_debt", "Công nợ"],
    ],
  },
  programs: {
    title: "Ngành đào tạo",
    list: "programs",
    base: "/api/management/programs",
    fields: [
      inputDefinition("programCode", "Mã ngành", "text", "program_code"),
      inputDefinition("programName", "Tên ngành", "text", "program_name"),
      inputDefinition("totalSemesters", "Tổng học kỳ", "number", "total_semesters", 'min="1" max="20"'),
      inputDefinition("tuitionPerSemester", "Học phí/kỳ", "number", "tuition_per_semester", 'min="0"'),
    ],
    columns: [
      ["program_code", "Mã ngành"],
      ["program_name", "Tên ngành"],
      ["total_semesters", "Học kỳ"],
      ["tuition_per_semester", "Học phí/kỳ"],
      ["curriculum_subjects_count", "Số môn CT"],
    ],
  },
  subjects: {
    title: "Môn học",
    list: "subjects",
    base: "/api/management/subjects",
    fields: [
      inputDefinition("subjectCode", "Mã môn", "text", "subject_code"),
      inputDefinition("subjectName", "Tên môn", "text", "subject_name"),
      inputDefinition("totalPeriods", "Tổng số tiết", "number", "total_periods", 'min="1"'),
      inputDefinition("credits", "Tín chỉ", "number", "credits", 'min="1" max="12"'),
    ],
    columns: [
      ["subject_code", "Mã môn"],
      ["subject_name", "Tên môn"],
      ["total_periods", "Số tiết"],
      ["credits", "Tín chỉ"],
      ["planned_sessions", "Số buổi"],
    ],
  },
  classes: {
    title: "Lớp học",
    list: "classes",
    base: "/api/management/classes",
    fields: [
      inputDefinition("classCode", "Mã lớp", "text", "class_code"),
      selectDefinition(
        "programId",
        "Ngành",
        () =>
          state.management.programs.map((item) => [
            item.id,
            `${item.program_code} — ${item.program_name}`,
          ]),
        "program_id",
      ),
      inputDefinition("cohortCode", "Khóa", "text", "cohort_code"),
      inputDefinition("startYear", "Năm bắt đầu", "number", "start_year"),
      inputDefinition("endYear", "Năm kết thúc", "number", "end_year"),
      inputDefinition("totalSemesters", "Tổng học kỳ", "number", "total_semesters"),
    ],
    columns: [
      ["class_code", "Mã lớp"],
      ["program_code", "Ngành"],
      ["cohort_code", "Khóa"],
      ["start_year", "Bắt đầu"],
      ["end_year", "Kết thúc"],
      ["total_semesters", "Học kỳ"],
    ],
  },
  curriculum: {
    title: "Chương trình học",
    list: "programSubjects",
    base: "/api/management/program-subjects",
    fields: [
      selectDefinition(
        "programId",
        "Ngành",
        () =>
          state.management.programs.map((item) => [
            item.id,
            item.program_code,
          ]),
        "program_id",
      ),
      selectDefinition(
        "subjectId",
        "Môn học",
        () =>
          state.management.subjects.map((item) => [
            item.id,
            `${item.subject_code} — ${item.subject_name}`,
          ]),
        "subject_id",
      ),
      inputDefinition("semesterNo", "Học kỳ", "number", "semester_no", 'min="1" max="20"'),
      selectDefinition("termType", "Loại kỳ", [
        ["regular", "Chính"],
        ["supplementary", "Bổ sung"],
      ], "term_type"),
      inputDefinition("referenceSemesterNo", "Bổ sung cho kỳ", "number", "reference_semester_no", 'min="1" max="20"', false),
    ],
    columns: [
      ["program_code", "Ngành"],
      ["semester_no", "Học kỳ"],
      ["term_type", "Loại kỳ"],
      ["subject_code", "Mã môn"],
      ["subject_name", "Môn học"],
      ["credits", "Tín chỉ"],
    ],
  },
};

function personAccountFields() {
  return [
    inputDefinition("username", "Tài khoản", "text", "username"),
    inputDefinition("password", "Mật khẩu", "password", null, "", false),
    selectDefinition("status", "Trạng thái", [
      ["active", "Hoạt động"],
      ["block", "Khóa"],
    ], "status"),
    inputDefinition("familyName", "Họ và tên lót", "text", "family_name"),
    inputDefinition("givenName", "Tên", "text", "given_name"),
    inputDefinition("dateOfBirth", "Ngày sinh", "date", "date_of_birth"),
    selectDefinition("gender", "Giới tính", [
      ["male", "Nam"],
      ["female", "Nữ"],
      ["other", "Khác"],
    ], "gender"),
    inputDefinition("phone", "Điện thoại", "text", "phone", "", false),
    inputDefinition("email", "Email", "email", "email", "", false),
  ];
}

function inputDefinition(name, label, type, source, extra = "", required = true) {
  return { name, label, type, source, extra, required };
}

function selectDefinition(name, label, options, source) {
  return { name, label, type: "select", options, source, required: true };
}

function renderCrud(view) {
  const config = crudConfigs[view];
  const items = state.management[config.list] || [];
  const editing = state.editing[view] || null;
  const formFields = config.fields.map((definition) =>
    renderDefinition(definition, editing),
  ).join("");
  const header = config.columns
    .map(([, label]) => `<th>${escapeHtml(label)}</th>`)
    .join("");
  const rows = items
    .map((item) => {
      const cells = config.columns
        .map(([key]) => {
          let value = item[key];
          if (key.includes("tuition") || key === "outstanding_debt") {
            value = formatMoney(value);
          } else if (statusLabels[value]) {
            value = statusLabels[value];
          }
          return `<td>${formatValue(value)}</td>`;
        })
        .join("");
      return `<tr>
        ${cells}
        <td><div class="row-actions">
          <button class="button button-muted" data-edit="${item.id}">Sửa</button>
          <button class="button button-danger" data-delete="${item.id}">Xóa</button>
        </div></td>
      </tr>`;
    })
    .join("");
  appElement.innerHTML = `
    <div class="stack">
      ${panel(
        editing ? `Sửa ${config.title.toLowerCase()}` : `Thêm ${config.title.toLowerCase()}`,
        `<form id="crudForm" class="form-grid">
          ${formFields}
          <div class="field">
            <label>&nbsp;</label>
            <div class="row-actions">
              <button class="button button-primary" type="submit">${editing ? "Lưu" : "Thêm"}</button>
              ${editing ? `<button class="button button-muted" type="button" id="cancelEdit">Hủy</button>` : ""}
            </div>
          </div>
        </form>`,
      )}
      ${panel(
        `Danh sách ${config.title.toLowerCase()}`,
        `<div class="table-wrap"><table class="data-table">
          <thead><tr>${header}<th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="${config.columns.length + 1}" class="empty">Chưa có dữ liệu.</td></tr>`}</tbody>
        </table></div>`,
      )}
    </div>
  `;
  document.getElementById("crudForm").addEventListener("submit", (event) =>
    submitCrud(event, view),
  );
  document.getElementById("cancelEdit")?.addEventListener("click", () => {
    state.editing[view] = null;
    renderCrud(view);
  });
  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editing[view] = items.find(
        (item) => String(item.id) === button.dataset.edit,
      );
      renderCrud(view);
    });
  });
  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () =>
      deleteCrud(view, button.dataset.delete),
    );
  });
}

function renderDefinition(definition, item) {
  const value = item && definition.source ? item[definition.source] ?? "" : "";
  if (definition.type === "select") {
    const options =
      typeof definition.options === "function"
        ? definition.options()
        : definition.options;
    return `
      <div class="field">
        <label>${escapeHtml(definition.label)}</label>
        <select name="${definition.name}" ${definition.required ? "required" : ""}>
          <option value="">-- Chọn --</option>
          ${options.map(([optionValue, label]) => option(optionValue, label, value)).join("")}
        </select>
      </div>`;
  }
  return field(
    definition.name,
    definition.label,
    definition.type,
    value,
    definition.required && !(definition.name === "password" && item),
    definition.extra,
  );
}

function field(name, label, type = "text", value = "", required = true, extra = "") {
  return `
    <div class="field">
      <label>${escapeHtml(label)}</label>
      <input name="${name}" type="${type}" value="${escapeAttr(value)}"
             ${required ? "required" : ""} ${extra}>
    </div>`;
}

function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

async function submitCrud(event, view) {
  event.preventDefault();
  const config = crudConfigs[view];
  const editing = state.editing[view];
  const body = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await api(
      editing ? `${config.base}/${editing.id}` : config.base,
      { method: editing ? "PUT" : "POST", body },
    );
    showToast("Đã lưu dữ liệu.");
    state.editing[view] = null;
    await loadManagement(true);
    renderCrud(view);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteCrud(view, id) {
  const config = crudConfigs[view];
  if (!window.confirm("Bạn có chắc muốn xóa dữ liệu này?")) return;
  try {
    await api(`${config.base}/${id}`, { method: "DELETE" });
    showToast("Đã xóa dữ liệu.");
    await loadManagement(true);
    renderCrud(view);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderAssignments() {
  const rows = state.management.classSubjects
    .map(
      (item) => `
      <tr data-assignment="${item.class_subject_id}">
        <td>${formatValue(item.class_code)}</td>
        <td>${formatValue(item.subject_code)} — ${formatValue(item.subject_name)}</td>
        <td>${item.semester_no} / ${statusLabels[item.term_type]}</td>
        <td>
          <select class="table-input" data-field="teacherId">
            <option value="">Chưa phân công</option>
            ${state.management.teachers
              .map((teacher) =>
                option(teacher.id, teacher.full_name, item.teacher_id),
              )
              .join("")}
          </select>
        </td>
        <td>
          <select class="table-input" data-field="status">
            ${option("planned", "Dự kiến", item.class_subject_status)}
            ${option("open", "Đang mở", item.class_subject_status)}
            ${option("closed", "Đã đóng", item.class_subject_status)}
          </select>
        </td>
        <td><input class="table-input" type="date" data-field="openedAt" value="${escapeAttr(item.opened_at || "")}"></td>
        <td><div class="row-actions">
          <button class="button button-primary" data-save-assignment>Lưu</button>
          <button class="button button-muted" data-gradebook="${item.class_subject_id}">Bảng điểm</button>
        </div></td>
      </tr>`,
    )
    .join("");
  appElement.innerHTML = panel(
    "Phân công giáo viên và mở môn",
    `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Lớp</th><th>Môn</th><th>Học kỳ</th><th>Giáo viên</th><th>Trạng thái</th><th>Ngày mở</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
  );
  document.querySelectorAll("[data-save-assignment]").forEach((button) => {
    button.addEventListener("click", () => saveAssignment(button));
  });
  bindGradebookButtons();
}

async function saveAssignment(button) {
  const row = button.closest("tr");
  const body = {};
  row.querySelectorAll("[data-field]").forEach((input) => {
    body[input.dataset.field] = input.value;
  });
  try {
    await api(
      `/api/management/class-subjects/${row.dataset.assignment}`,
      { method: "PUT", body },
    );
    showToast("Đã lưu phân công.");
    await loadManagement(true);
    renderAssignments();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderAccounts() {
  const rows = state.management.accounts
    .map(
      (account) => `<tr>
        <td>${formatValue(account.username)}</td>
        <td>${formatValue(account.fullName, "Admin")}</td>
        <td>${formatValue(roleLabels[account.role])}</td>
        <td>${badge(account.status)}</td>
        <td>${formatDate(account.createdAt)}</td>
      </tr>`,
    )
    .join("");
  appElement.innerHTML = panel(
    "Danh sách tài khoản",
    `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
  );
}

async function init() {
  try {
    state.me = await api("/api/me");
    setHeader();
    const role = state.me.account.role;
    state.activeView =
      role === "student" ? "student" : role === "teacher" ? "teacher" : "overview";
    renderSidebar();
    await navigate(state.activeView);
  } catch (error) {
    appElement.innerHTML = `<div class="state-panel">${escapeHtml(error.message)}</div>`;
  }
}

init();
