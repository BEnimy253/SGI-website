import express from "express";
import session from "express-session";
import path from "node:path";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { pool, testDatabaseConnection } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3000;

const ROLE_LABELS = {
  admin: "Admin",
  academic_executor: "Giáo vụ",
  teacher: "Giáo viên",
  student: "Học sinh",
};

const ACCOUNT_STATUSES = new Set(["active", "inactive", "locked"]);
const CLASS_SUBJECT_STATUSES = new Set(["open", "closed"]);
const SCORE_FIELDS = ["kttx1", "kttx2", "ktdk1", "ktdk2", "ktm1", "ktm2"];

app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public", { index: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "sgi-development-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 30,
    },
  }),
);

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireLogin(req, res, next) {
  if (req.session.accountId) {
    next();
    return;
  }

  res.redirect("/login");
}

function requireApiLogin(req, res, next) {
  if (req.session.accountId) {
    next();
    return;
  }

  res.status(401).json({ message: "Vui lòng đăng nhập." });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.accountId) {
      res.status(401).json({ message: "Vui lòng đăng nhập." });
      return;
    }

    if (!roles.includes(req.session.role)) {
      res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này." });
      return;
    }

    next();
  };
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function withAppContext(req, handler) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("select set_config('app.account_id', $1, true)", [
      String(req.session.accountId ?? ""),
    ]);

    const result = await handler(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function parseId(value, fieldName = "id") {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw createHttpError(400, `${fieldName} không hợp lệ.`);
  }

  return number;
}

function parseOptionalId(value, fieldName = "id") {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return parseId(value, fieldName);
}

function requiredText(value, fieldName) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw createHttpError(400, `${fieldName} không được để trống.`);
  }

  return text;
}

function optionalText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalDate(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseSchoolYear(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1900 || number > 2200) {
    throw createHttpError(400, `${fieldName} không hợp lệ.`);
  }

  return number;
}

function parseSubjectOrder(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1 || number > 26) {
    throw createHttpError(400, "Thứ tự môn học phải từ 1 đến 26.");
  }

  return number;
}

function parsePeriod(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw createHttpError(400, "Số tiết phải lớn hơn 0.");
  }

  return number;
}

function parseScore(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0 || number > 10) {
    throw createHttpError(400, `${fieldName} phải từ 0 đến 10.`);
  }

  return Number(number.toFixed(1));
}

function parseClassSubjectStatus(value) {
  const status = String(value ?? "closed").trim();

  if (!CLASS_SUBJECT_STATUSES.has(status)) {
    throw createHttpError(400, "Trạng thái phân công không hợp lệ.");
  }

  return status;
}

function parseAccountStatus(value) {
  const status = String(value ?? "active").trim();

  if (!ACCOUNT_STATUSES.has(status)) {
    throw createHttpError(400, "Trạng thái tài khoản không hợp lệ.");
  }

  return status;
}

async function hashPasswordIfPresent(password) {
  const text = String(password ?? "").trim();

  if (!text) {
    return null;
  }

  return bcrypt.hash(text, 12);
}

async function updateAccountCredentials(client, accountId, body) {
  if (!accountId) {
    return null;
  }

  const username = requiredText(body.username, "Tên tài khoản");
  const status = parseAccountStatus(body.status);
  const passwordHash = await hashPasswordIfPresent(body.password);

  if (passwordHash) {
    const result = await client.query(
      `
      update public.accounts
      set
        username = $1,
        status = $2,
        password_hash = $3,
        updated_at = now()
      where id = $4
      returning id
      `,
      [username, status, passwordHash, accountId],
    );

    return result.rows[0] ?? null;
  }

  const result = await client.query(
    `
    update public.accounts
    set
      username = $1,
      status = $2,
      updated_at = now()
    where id = $3
    returning id
    `,
    [username, status, accountId],
  );

  return result.rows[0] ?? null;
}

async function createTeacherAccountForExistingProfile(client, teacherId, body) {
  const username = optionalText(body.username);
  const password = optionalText(body.password);

  if (!username && !password) {
    return null;
  }

  if (!username || !password) {
    throw createHttpError(
      400,
      "Giáo viên chưa có tài khoản, cần nhập cả username và mật khẩu.",
    );
  }

  const result = await client.query(
    `
    insert into public.accounts (username, password_hash, role, status)
    values ($1, $2, 'teacher', $3)
    returning id
    `,
    [username, await bcrypt.hash(password, 12), parseAccountStatus(body.status)],
  );

  await client.query(
    `
    update public.teachers
    set account_id = $1,
        updated_at = now()
    where id = $2
    `,
    [result.rows[0].id, teacherId],
  );

  return result.rows[0];
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function formatCourse(row) {
  if (!row.school_year_start || !row.school_year_end) {
    return null;
  }

  return `${row.school_year_start} - ${row.school_year_end}`;
}

function mapAccount(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role] ?? row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapScore(row) {
  return {
    studentId: row.student_id,
    studentCode: row.student_code,
    studentName: row.student_name,
    dateOfBirth: row.date_of_birth,
    classId: row.class_id,
    classCode: row.class_code,
    classSubjectStatus: row.class_subject_status,
    programId: row.program_id,
    major: row.major,
    educationLevel: row.education_level,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    subjectOrder: row.subject_order,
    period: row.period,
    kttx1: toNumber(row.kttx1),
    kttx2: toNumber(row.kttx2),
    ktdk1: toNumber(row.ktdk1),
    ktdk2: toNumber(row.ktdk2),
    processScoreAverage: toNumber(row.dtb),
    ktm1: toNumber(row.ktm1),
    ktm2: toNumber(row.ktm2),
    finalScore: toNumber(row.final_score),
    absentSessions: row.absent_sessions,
    canUpdate: Boolean(row.can_update),
  };
}

async function getCurrentUser(client, accountId) {
  const accountResult = await client.query(
    `
    select id, username, role, status, to_char(created_at, 'YYYY-MM-DD') as created_at
    from public.accounts
    where id = $1
    limit 1
    `,
    [accountId],
  );
  const account = accountResult.rows[0];

  if (!account) {
    throw createHttpError(401, "Phiên đăng nhập không còn hợp lệ.");
  }

  let profile = null;

  if (account.role === "student") {
    const profileResult = await client.query(
      `
      select
        s.id,
        s.student_code,
        s.full_name,
        to_char(s.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
        c.id as class_id,
        c.class_code,
        c.major,
        c.education_level,
        c.school_year_start,
        c.school_year_end
      from public.students s
      left join public.classes c
        on c.id = s.class_id
      where s.user_id = $1
      limit 1
      `,
      [accountId],
    );
    profile = profileResult.rows[0] ?? null;
  }

  if (account.role === "teacher") {
    const profileResult = await client.query(
      `
      select
        id,
        contract_type,
        full_name,
        phone,
        email,
        to_char(date_of_birth, 'YYYY-MM-DD') as date_of_birth
      from public.teachers
      where account_id = $1
      limit 1
      `,
      [accountId],
    );
    profile = profileResult.rows[0] ?? null;
  }

  if (account.role === "academic_executor") {
    const profileResult = await client.query(
      `
      select id, full_name, phone, email
      from public.academic_executors
      where account_id = $1
      limit 1
      `,
      [accountId],
    );
    profile = profileResult.rows[0] ?? null;
  }

  return {
    account: mapAccount(account),
    profile,
  };
}

async function getManagementOverview(client, role = "admin") {
  const countsResult = await client.query(
    `
    select
      (select count(*)::int from public.accounts) as accounts,
      (select count(*)::int from public.academic_executors) as academic_executors,
      (select count(*)::int from public.teachers) as teachers,
      (select count(*)::int from public.students) as students,
      (select count(*)::int from public.classes) as classes,
      (select count(*)::int from public.subjects) as subjects,
      (select count(*)::int from public.academic_programs) as programs
    `,
  );

  const accountsResult = await client.query(
    `
    select id, username, role, status, to_char(created_at, 'YYYY-MM-DD') as created_at
    from public.accounts
    order by
      case role
        when 'admin' then 1
        when 'academic_executor' then 2
        when 'teacher' then 3
        when 'student' then 4
        else 5
      end,
      username
    `,
  );

  const academicsResult = await client.query(
    `
    select
      ae.id,
      ae.full_name,
      ae.phone,
      ae.email,
      ae.account_id,
      a.username,
      a.status
    from public.academic_executors ae
    join public.accounts a
      on a.id = ae.account_id
    order by ae.full_name
    `,
  );

  const teachersResult = await client.query(
    `
    select
      t.id,
      t.contract_type,
      t.full_name,
      t.phone,
      t.email,
      to_char(t.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
      t.account_id,
      a.username,
      a.status
    from public.teachers t
    left join public.accounts a
      on a.id = t.account_id
    order by t.full_name
    `,
  );

  const classesResult = await client.query(
    `
    select
      c.id,
      c.class_code,
      c.school_year_start,
      c.school_year_end,
      c.major,
      c.education_level,
      c.program_id,
      p.major as program_major,
      p.education_level as program_education_level
    from public.classes c
    join public.academic_programs p
      on p.id = c.program_id
    order by c.class_code
    `,
  );

  const studentsResult = await client.query(
    `
    select
      s.id,
      s.student_code,
      s.full_name,
      to_char(s.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
      s.user_id,
      a.username,
      a.status,
      s.class_id,
      c.class_code,
      c.major
    from public.students s
    join public.accounts a
      on a.id = s.user_id
    left join public.classes c
      on c.id = s.class_id
    order by s.student_code
    `,
  );

  const subjectsResult = await client.query(
    `
    select
      s.id,
      s.subject_code,
      s.subject_name,
      s.subject_order,
      s.period,
      s.program_id,
      p.major,
      p.education_level
    from public.subjects s
    join public.academic_programs p
      on p.id = s.program_id
    order by p.major, p.education_level, s.subject_order
    `,
  );

  const classSubjectsResult = await client.query(
    `
    select
      cs.class_id,
      c.class_code,
      c.school_year_start,
      c.school_year_end,
      c.major,
      c.education_level,
      cs.subject_id,
      s.subject_code,
      s.subject_name,
      s.subject_order,
      s.period,
      cs.status,
      cs.opened_at,
      cs.teacher_id,
      t.full_name as teacher_name,
      t.contract_type as teacher_contract_type
    from public.class_subjects cs
    join public.classes c
      on c.id = cs.class_id
    join public.subjects s
      on s.id = cs.subject_id
    left join public.teachers t
      on t.id = cs.teacher_id
    order by c.class_code, s.subject_order
    `,
  );

  const programsResult = await client.query(
    `
    select
      p.id,
      p.major,
      p.education_level,
      count(distinct c.id)::int as classes_count,
      count(distinct s.id)::int as subjects_count
    from public.academic_programs p
    left join public.classes c
      on c.program_id = p.id
    left join public.subjects s
      on s.program_id = p.id
    group by p.id, p.major, p.education_level
    order by p.major, p.education_level
    `,
  );

  const canManageAll = role === "admin";
  const canManagePeople = canManageAll || role === "academic_executor";

  return {
    counts: countsResult.rows[0],
    accounts: canManageAll
      ? accountsResult.rows.map(mapAccount)
      : accountsResult.rows
          .filter((account) => account.role === "teacher" || account.role === "student")
          .map(mapAccount),
    academicExecutors: canManageAll ? academicsResult.rows : [],
    teachers: teachersResult.rows,
    classes: classesResult.rows,
    students: canManagePeople ? studentsResult.rows : [],
    subjects: subjectsResult.rows,
    classSubjects: classSubjectsResult.rows,
    programs: canManageAll ? programsResult.rows : [],
  };
}

async function getTeacherProfile(client, accountId) {
  const result = await client.query(
    `
    select id, full_name, contract_type
    from public.teachers
    where account_id = $1
    limit 1
    `,
    [accountId],
  );

  if (!result.rows[0]) {
    throw createHttpError(404, "Không tìm thấy hồ sơ giáo viên.");
  }

  return result.rows[0];
}

async function getTeacherAssignmentDetail(client, teacherId, classId, subjectId) {
  const assignmentResult = await client.query(
    `
    select
      teacher_id,
      teacher_name,
      contract_type,
      class_id,
      class_code,
      school_year_start,
      school_year_end,
      program_id,
      major,
      education_level,
      subject_id,
      subject_code,
      subject_name,
      subject_order,
      class_subject_status,
      opened_at
    from public.teacher_assigned_classes_view
    where teacher_id = $1
      and class_id = $2
      and subject_id = $3
    limit 1
    `,
    [teacherId, classId, subjectId],
  );

  const assignment = assignmentResult.rows[0];

  if (!assignment) {
    throw createHttpError(404, "Không tìm thấy lớp - môn được phân công.");
  }

  const scoresResult = await client.query(
    `
    select
      d.*,
      (
        d.class_subject_status = 'open'
        and cs.teacher_id = $3::bigint
      ) as can_update
    from public.class_student_scores_view d
    join public.class_subjects cs
      on cs.class_id = d.class_id
     and cs.subject_id = d.subject_id
    where d.class_id = $1
      and d.subject_id = $2
    order by d.student_code
    `,
    [classId, subjectId, teacherId],
  );

  return {
    assignment: {
      ...assignment,
      course: formatCourse(assignment),
    },
    scores: scoresResult.rows.map(mapScore),
  };
}

app.get("/", (req, res) => {
  if (req.session.accountId) {
    res.redirect("/dashboard");
    return;
  }

  res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.session.accountId) {
    res.redirect("/dashboard");
    return;
  }

  res.sendFile(path.join(process.cwd(), "views", "login.html"));
});

app.post(
  "/login",
  asyncRoute(async (req, res) => {
    const { username, password } = req.body;

    const result = await pool.query(
      `
      select id, username, password_hash, role, status
      from public.accounts
      where username = $1
      limit 1
      `,
      [username],
    );

    const account = result.rows[0];

    if (!account) {
      res.redirect("/login?error=username");
      return;
    }

    if (account.status !== "active") {
      res.redirect("/login?error=status");
      return;
    }

    const isValidPassword = await bcrypt.compare(password, account.password_hash);

    if (!isValidPassword) {
      res.redirect("/login?error=password");
      return;
    }

    req.session.accountId = account.id;
    req.session.username = account.username;
    req.session.role = account.role;
    res.redirect("/dashboard");
  }),
);

app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(process.cwd(), "views", "dashboard.html"));
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.get(
  "/db-test",
  asyncRoute(async (req, res) => {
    const dbTime = await testDatabaseConnection();

    res.send(`
      <h1>Kết nối Database thành công</h1>
      <p>Thời gian database: ${dbTime.current_time}</p>
    `);
  }),
);

app.get(
  "/api/me",
  requireApiLogin,
  asyncRoute(async (req, res) => {
    const data = await withAppContext(req, (client) =>
      getCurrentUser(client, req.session.accountId),
    );

    res.json(data);
  }),
);

app.get(
  "/api/student-info",
  requireRole("student"),
  asyncRoute(async (req, res) => {
    const data = await withAppContext(req, async (client) => {
      const studentResult = await client.query(
        `
        select
          s.id as student_id,
          s.student_code,
          s.full_name,
          to_char(s.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
          c.class_code,
          c.major,
          c.education_level,
          c.school_year_start,
          c.school_year_end
        from public.students s
        left join public.classes c
          on c.id = s.class_id
        where s.user_id = $1
        limit 1
        `,
        [req.session.accountId],
      );

      const studentRow = studentResult.rows[0];

      if (!studentRow) {
        throw createHttpError(404, "Không tìm thấy thông tin học sinh.");
      }

      const scoresResult = await client.query(
        `
        select *
        from public.student_score_details_view
        where student_id = $1
        order by subject_order
        `,
        [studentRow.student_id],
      );

      return {
        student: {
          id: studentRow.student_id,
          studentCode: studentRow.student_code,
          fullName: studentRow.full_name,
          dateOfBirth: studentRow.date_of_birth,
          classCode: studentRow.class_code,
          major: studentRow.major,
          educationLevel: studentRow.education_level,
          course: formatCourse(studentRow),
        },
        scores: scoresResult.rows.map(mapScore),
      };
    });

    res.json(data);
  }),
);

app.get(
  "/api/teacher/classes",
  requireRole("teacher"),
  asyncRoute(async (req, res) => {
    const data = await withAppContext(req, async (client) => {
      const teacher = await getTeacherProfile(client, req.session.accountId);
      const assignmentsResult = await client.query(
        `
        select
          tac.class_id,
          tac.class_code,
          tac.school_year_start,
          tac.school_year_end,
          tac.program_id,
          tac.major,
          tac.education_level,
          tac.subject_id,
          tac.subject_code,
          tac.subject_name,
          tac.subject_order,
          tac.class_subject_status,
          tac.opened_at,
          count(distinct st.id)::int as student_count
        from public.teacher_assigned_classes_view tac
        left join public.students st
          on st.class_id = tac.class_id
        where tac.teacher_id = $1
        group by
          tac.class_id,
          tac.class_code,
          tac.school_year_start,
          tac.school_year_end,
          tac.program_id,
          tac.major,
          tac.education_level,
          tac.subject_id,
          tac.subject_code,
          tac.subject_name,
          tac.subject_order,
          tac.class_subject_status,
          tac.opened_at
        order by tac.class_code, tac.subject_order
        `,
        [teacher.id],
      );

      return {
        teacher,
        assignments: assignmentsResult.rows.map((row) => ({
          ...row,
          course: formatCourse(row),
        })),
      };
    });

    res.json(data);
  }),
);

app.get(
  "/api/teacher/classes/:classId/subjects/:subjectId",
  requireRole("teacher"),
  asyncRoute(async (req, res) => {
    const classId = parseId(req.params.classId, "Mã lớp");
    const subjectId = parseId(req.params.subjectId, "Mã môn");
    const data = await withAppContext(req, async (client) => {
      const teacher = await getTeacherProfile(client, req.session.accountId);
      const detail = await getTeacherAssignmentDetail(
        client,
        teacher.id,
        classId,
        subjectId,
      );
      return { teacher, ...detail };
    });

    res.json(data);
  }),
);

app.put(
  "/api/teacher/scores/:studentId/:subjectId",
  requireRole("teacher"),
  asyncRoute(async (req, res) => {
    const studentId = parseId(req.params.studentId, "Mã học sinh");
    const subjectId = parseId(req.params.subjectId, "Mã môn");
    const values = SCORE_FIELDS.map((field) => parseScore(req.body[field], field.toUpperCase()));

    const data = await withAppContext(req, async (client) => {
      const teacher = await getTeacherProfile(client, req.session.accountId);
      const updateResult = await client.query(
        `
        update public.student_scores
        set
          kttx1 = $1,
          kttx2 = $2,
          ktdk1 = $3,
          ktdk2 = $4,
          ktm1 = $5,
          ktm2 = $6
        where student_id = $7
          and subject_id = $8
        returning student_id, subject_id
        `,
        [...values, studentId, subjectId],
      );

      if (!updateResult.rows[0]) {
        throw createHttpError(404, "Không tìm thấy dòng điểm cần cập nhật.");
      }

      const scoreResult = await client.query(
        `
        select
          d.*,
          (
            d.class_subject_status = 'open'
            and cs.teacher_id = $3::bigint
          ) as can_update
        from public.student_score_details_view d
        join public.class_subjects cs
          on cs.class_id = d.class_id
         and cs.subject_id = d.subject_id
        where d.student_id = $1
          and d.subject_id = $2
        limit 1
        `,
        [studentId, subjectId, teacher.id],
      );

      return mapScore(scoreResult.rows[0]);
    });

    res.json({ score: data });
  }),
);

app.get(
  "/api/management/overview",
  requireRole("admin", "academic_executor"),
  asyncRoute(async (req, res) => {
    const data = await withAppContext(req, (client) =>
      getManagementOverview(client, req.session.role),
    );
    res.json(data);
  }),
);

app.post(
  "/api/admin/academic-executors",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        select public.create_academic_executor_account($1, $2, $3, $4, $5) as account_id
        `,
        [
          requiredText(body.username, "Tên tài khoản"),
          requiredText(body.password, "Mật khẩu"),
          requiredText(body.fullName, "Họ tên"),
          optionalText(body.phone),
          optionalText(body.email),
        ],
      );

      return result.rows[0];
    });

    res.status(201).json(data);
  }),
);

app.put(
  "/api/admin/academic-executors/:executorId",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const executorId = parseId(req.params.executorId, "Mã giáo vụ");
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const executorResult = await client.query(
        `
        select account_id
        from public.academic_executors
        where id = $1
        limit 1
        `,
        [executorId],
      );

      const executor = executorResult.rows[0];

      if (!executor) {
        throw createHttpError(404, "Không tìm thấy giáo vụ.");
      }

      await updateAccountCredentials(client, executor.account_id, body);

      const result = await client.query(
        `
        update public.academic_executors
        set
          full_name = $1,
          phone = $2,
          email = $3,
          updated_at = now()
        where id = $4
        returning id
        `,
        [
          requiredText(body.fullName, "Họ tên"),
          optionalText(body.phone),
          optionalText(body.email),
          executorId,
        ],
      );

      return result.rows[0];
    });

    res.json(data);
  }),
);

app.delete(
  "/api/admin/academic-executors/:executorId",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const executorId = parseId(req.params.executorId, "Mã giáo vụ");
    const data = await withAppContext(req, async (client) => {
      const executorResult = await client.query(
        `
        select account_id
        from public.academic_executors
        where id = $1
        limit 1
        `,
        [executorId],
      );

      const executor = executorResult.rows[0];

      if (!executor) {
        throw createHttpError(404, "Không tìm thấy giáo vụ.");
      }

      await client.query("delete from public.accounts where id = $1", [
        executor.account_id,
      ]);

      return { id: executorId };
    });

    res.json(data);
  }),
);

app.post(
  "/api/management/teachers",
  requireRole("admin", "academic_executor"),
  asyncRoute(async (req, res) => {
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        select public.create_teacher_account($1, $2, $3, $4, $5, $6, $7) as account_id
        `,
        [
          requiredText(body.username, "Tên tài khoản"),
          requiredText(body.password, "Mật khẩu"),
          requiredText(body.contractType, "Loại hợp đồng"),
          requiredText(body.fullName, "Họ tên"),
          optionalText(body.phone),
          optionalText(body.email),
          optionalDate(body.dateOfBirth),
        ],
      );

      return result.rows[0];
    });

    res.status(201).json(data);
  }),
);

app.put(
  "/api/management/teachers/:teacherId",
  requireRole("admin", "academic_executor"),
  asyncRoute(async (req, res) => {
    const teacherId = parseId(req.params.teacherId, "Mã giáo viên");
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const teacherResult = await client.query(
        `
        select account_id
        from public.teachers
        where id = $1
        limit 1
        `,
        [teacherId],
      );

      const teacher = teacherResult.rows[0];

      if (!teacher) {
        throw createHttpError(404, "Không tìm thấy giáo viên.");
      }

      if (teacher.account_id) {
        await updateAccountCredentials(client, teacher.account_id, body);
      } else {
        await createTeacherAccountForExistingProfile(client, teacherId, body);
      }

      const result = await client.query(
        `
        update public.teachers
        set
          contract_type = $1,
          full_name = $2,
          phone = $3,
          email = $4,
          date_of_birth = $5,
          updated_at = now()
        where id = $6
        returning id
        `,
        [
          requiredText(body.contractType, "Loại hợp đồng"),
          requiredText(body.fullName, "Họ tên"),
          optionalText(body.phone),
          optionalText(body.email),
          optionalDate(body.dateOfBirth),
          teacherId,
        ],
      );

      return result.rows[0];
    });

    res.json(data);
  }),
);

app.delete(
  "/api/management/teachers/:teacherId",
  requireRole("admin", "academic_executor"),
  asyncRoute(async (req, res) => {
    const teacherId = parseId(req.params.teacherId, "Mã giáo viên");
    const data = await withAppContext(req, async (client) => {
      const teacherResult = await client.query(
        `
        select account_id
        from public.teachers
        where id = $1
        limit 1
        `,
        [teacherId],
      );

      const teacher = teacherResult.rows[0];

      if (!teacher) {
        throw createHttpError(404, "Không tìm thấy giáo viên.");
      }

      await client.query(
        `
        update public.class_subjects
        set status = 'closed',
            teacher_id = null,
            opened_at = null
        where teacher_id = $1
        `,
        [teacherId],
      );

      if (teacher.account_id) {
        await client.query("delete from public.accounts where id = $1", [
          teacher.account_id,
        ]);
      } else {
        await client.query("delete from public.teachers where id = $1", [teacherId]);
      }

      return { id: teacherId };
    });

    res.json(data);
  }),
);

app.post(
  "/api/management/students",
  requireRole("admin", "academic_executor"),
  asyncRoute(async (req, res) => {
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        select public.create_student_account($1, $2, $3, $4, $5, $6) as account_id
        `,
        [
          requiredText(body.username, "Tên tài khoản"),
          requiredText(body.password, "Mật khẩu"),
          requiredText(body.studentCode, "Mã học sinh"),
          requiredText(body.fullName, "Họ tên"),
          optionalDate(body.dateOfBirth),
          parseOptionalId(body.classId, "Mã lớp"),
        ],
      );

      const account = result.rows[0];
      const studentResult = await client.query(
        `
        select id
        from public.students
        where user_id = $1
        limit 1
        `,
        [account.account_id],
      );
      const student = studentResult.rows[0];

      if (!student) {
        throw createHttpError(500, "Không thể khởi tạo hồ sơ học sinh.");
      }

      await client.query("select public.sync_student_scores($1)", [student.id]);

      return account;
    });

    res.status(201).json(data);
  }),
);

app.put(
  "/api/management/students/:studentId",
  requireRole("admin", "academic_executor"),
  asyncRoute(async (req, res) => {
    const studentId = parseId(req.params.studentId, "Mã học sinh");
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const studentResult = await client.query(
        `
        select user_id
        from public.students
        where id = $1
        limit 1
        `,
        [studentId],
      );

      const student = studentResult.rows[0];

      if (!student) {
        throw createHttpError(404, "Không tìm thấy học sinh.");
      }

      await updateAccountCredentials(client, student.user_id, body);

      const result = await client.query(
        `
        update public.students
        set
          student_code = $1,
          full_name = $2,
          date_of_birth = $3,
          class_id = $4,
          updated_at = now()
        where id = $5
        returning id
        `,
        [
          requiredText(body.studentCode, "Mã học sinh"),
          requiredText(body.fullName, "Họ tên"),
          optionalDate(body.dateOfBirth),
          parseOptionalId(body.classId, "Mã lớp"),
          studentId,
        ],
      );

      const updatedStudent = result.rows[0];
      await client.query("select public.sync_student_scores($1)", [updatedStudent.id]);

      return updatedStudent;
    });

    res.json(data);
  }),
);

app.delete(
  "/api/management/students/:studentId",
  requireRole("admin", "academic_executor"),
  asyncRoute(async (req, res) => {
    const studentId = parseId(req.params.studentId, "Mã học sinh");
    const data = await withAppContext(req, async (client) => {
      const studentResult = await client.query(
        `
        select user_id
        from public.students
        where id = $1
        limit 1
        `,
        [studentId],
      );

      if (!studentResult.rows[0]) {
        throw createHttpError(404, "Không tìm thấy học sinh.");
      }

      await client.query("delete from public.accounts where id = $1", [
        studentResult.rows[0].user_id,
      ]);

      return { id: studentId };
    });

    res.json(data);
  }),
);

app.post(
  "/api/management/programs",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        insert into public.academic_programs (
          major,
          education_level
        )
        values ($1, $2)
        returning id
        `,
        [
          requiredText(body.major, "Ngành học"),
          requiredText(body.educationLevel, "Bậc đào tạo"),
        ],
      );

      return result.rows[0];
    });

    res.status(201).json(data);
  }),
);

app.put(
  "/api/management/programs/:programId",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const programId = parseId(req.params.programId, "Mã ngành học");
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        update public.academic_programs
        set
          major = $1,
          education_level = $2,
          updated_at = now()
        where id = $3
        returning id
        `,
        [
          requiredText(body.major, "Ngành học"),
          requiredText(body.educationLevel, "Bậc đào tạo"),
          programId,
        ],
      );

      if (!result.rows[0]) {
        throw createHttpError(404, "Không tìm thấy ngành học.");
      }

      return result.rows[0];
    });

    res.json(data);
  }),
);

app.delete(
  "/api/management/programs/:programId",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const programId = parseId(req.params.programId, "Mã ngành học");
    const data = await withAppContext(req, async (client) => {
      const usageResult = await client.query(
        `
        select
          (select count(*)::int from public.classes where program_id = $1) as classes,
          (select count(*)::int from public.subjects where program_id = $1) as subjects
        `,
        [programId],
      );
      const usage = usageResult.rows[0];

      if (usage.classes > 0 || usage.subjects > 0) {
        throw createHttpError(
          400,
          "Không thể xóa ngành học đang được dùng bởi lớp hoặc môn học.",
        );
      }

      const result = await client.query(
        `
        delete from public.academic_programs
        where id = $1
        returning id
        `,
        [programId],
      );

      if (!result.rows[0]) {
        throw createHttpError(404, "Không tìm thấy ngành học.");
      }

      return result.rows[0];
    });

    res.json(data);
  }),
);

app.post(
  "/api/management/subjects",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        with new_subject as (
          insert into public.subjects (
            program_id,
            subject_code,
            subject_order,
            subject_name,
            period
          )
          values ($1, $2, $3, $4, $5)
          returning id, program_id
        ),
        inserted_class_subjects as (
          insert into public.class_subjects (
            class_id,
            subject_id,
            status
          )
          select
            c.id,
            ns.id,
            'closed'
          from new_subject ns
          join public.classes c
            on c.program_id = ns.program_id
          on conflict (class_id, subject_id) do nothing
          returning class_id
        ),
        inserted_scores as (
          insert into public.student_scores (
            student_id,
            subject_id
          )
          select
            st.id,
            ns.id
          from new_subject ns
          join public.classes c
            on c.program_id = ns.program_id
          join public.students st
            on st.class_id = c.id
          on conflict (student_id, subject_id) do nothing
          returning student_id
        )
        select id
        from new_subject
        `,
        [
          parseId(body.programId, "Chương trình đào tạo"),
          requiredText(body.subjectCode, "Mã môn học"),
          parseSubjectOrder(body.subjectOrder),
          requiredText(body.subjectName, "Tên môn học"),
          parsePeriod(body.period),
        ],
      );

      return result.rows[0];
    });

    res.status(201).json(data);
  }),
);

app.put(
  "/api/management/subjects/:subjectId",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const subjectId = parseId(req.params.subjectId, "Mã môn học");
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const currentResult = await client.query(
        `
        select program_id
        from public.subjects
        where id = $1
        limit 1
        `,
        [subjectId],
      );
      const current = currentResult.rows[0];

      if (!current) {
        throw createHttpError(404, "Không tìm thấy môn học.");
      }

      const nextProgramId = parseId(body.programId, "Chương trình đào tạo");

      if (Number(current.program_id) !== nextProgramId) {
        const usageResult = await client.query(
          `
          select
            (select count(*)::int from public.class_subjects where subject_id = $1) as class_subjects,
            (select count(*)::int from public.student_scores where subject_id = $1) as scores
          `,
          [subjectId],
        );
        const usage = usageResult.rows[0];

        if (usage.class_subjects > 0 || usage.scores > 0) {
          throw createHttpError(
            400,
            "Không thể chuyển chương trình của môn học đang được dùng trong lớp hoặc bảng điểm.",
          );
        }
      }

      const result = await client.query(
        `
        update public.subjects
        set
          program_id = $1,
          subject_code = $2,
          subject_order = $3,
          subject_name = $4,
          period = $5
        where id = $6
        returning id, program_id
        `,
        [
          nextProgramId,
          requiredText(body.subjectCode, "Mã môn học"),
          parseSubjectOrder(body.subjectOrder),
          requiredText(body.subjectName, "Tên môn học"),
          parsePeriod(body.period),
          subjectId,
        ],
      );

      const subject = result.rows[0];

      await client.query(
        `
        insert into public.class_subjects (
          class_id,
          subject_id,
          status
        )
        select
          c.id,
          $1,
          'closed'
        from public.classes c
        where c.program_id = $2
        on conflict (class_id, subject_id) do nothing
        `,
        [subject.id, subject.program_id],
      );

      await client.query(
        `
        insert into public.student_scores (
          student_id,
          subject_id
        )
        select
          st.id,
          $1
        from public.students st
        join public.classes c
          on c.id = st.class_id
        where c.program_id = $2
        on conflict (student_id, subject_id) do nothing
        `,
        [subject.id, subject.program_id],
      );

      return { id: subject.id };
    });

    res.json(data);
  }),
);

app.delete(
  "/api/management/subjects/:subjectId",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const subjectId = parseId(req.params.subjectId, "Mã môn học");
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        delete from public.subjects
        where id = $1
        returning id
        `,
        [subjectId],
      );

      if (!result.rows[0]) {
        throw createHttpError(404, "Không tìm thấy môn học.");
      }

      return result.rows[0];
    });

    res.json(data);
  }),
);

app.put(
  "/api/management/class-subjects/:classId/:subjectId",
  requireRole("admin", "academic_executor"),
  asyncRoute(async (req, res) => {
    const classId = parseId(req.params.classId, "Mã lớp");
    const subjectId = parseId(req.params.subjectId, "Mã môn học");
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const teacherId = parseOptionalId(body.teacherId, "Mã giáo viên");
      const status = parseClassSubjectStatus(body.status);

      if (status === "open" && !teacherId) {
        throw createHttpError(400, "Cần chọn giáo viên khi mở lớp-môn.");
      }

      const openedAt =
        status === "open"
          ? optionalDate(body.openedAt) ?? new Date().toISOString().slice(0, 10)
          : null;

      const result = await client.query(
        `
        update public.class_subjects
        set
          teacher_id = $1,
          status = $2,
          opened_at = $3
        where class_id = $4
          and subject_id = $5
        returning class_id, subject_id
        `,
        [teacherId, status, openedAt, classId, subjectId],
      );

      if (!result.rows[0]) {
        throw createHttpError(404, "Không tìm thấy lớp-môn cần phân công.");
      }

      return result.rows[0];
    });

    res.json(data);
  }),
);

app.post(
  "/api/management/classes",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        with new_class as (
          insert into public.classes (
            class_code,
            school_year_start,
            school_year_end,
            major,
            education_level,
            program_id
          )
          select
            $1,
            $2,
            $3,
            p.major,
            p.education_level,
            p.id
          from public.academic_programs p
          where p.id = $4
          returning id, program_id
        ),
        inserted_subjects as (
          insert into public.class_subjects (
            class_id,
            subject_id,
            status
          )
          select
            nc.id,
            s.id,
            'closed'
          from new_class nc
          join public.subjects s
            on s.program_id = nc.program_id
          on conflict (class_id, subject_id) do nothing
          returning class_id
        )
        select id
        from new_class
        `,
        [
          requiredText(body.classCode, "Mã lớp"),
          parseSchoolYear(body.schoolYearStart, "Năm bắt đầu"),
          parseSchoolYear(body.schoolYearEnd, "Năm kết thúc"),
          parseId(body.programId, "Chương trình đào tạo"),
        ],
      );

      if (!result.rows[0]) {
        throw createHttpError(404, "Không tìm thấy chương trình đào tạo.");
      }

      return result.rows[0];
    });

    res.status(201).json(data);
  }),
);

app.put(
  "/api/management/classes/:classId",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const classId = parseId(req.params.classId, "Mã lớp");
    const body = req.body;
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        update public.classes
        set
          class_code = $1,
          school_year_start = $2,
          school_year_end = $3,
          major = p.major,
          education_level = p.education_level,
          program_id = p.id,
          updated_at = now()
        from public.academic_programs p
        where public.classes.id = $5
          and p.id = $4
        returning public.classes.id
        `,
        [
          requiredText(body.classCode, "Mã lớp"),
          parseSchoolYear(body.schoolYearStart, "Năm bắt đầu"),
          parseSchoolYear(body.schoolYearEnd, "Năm kết thúc"),
          parseId(body.programId, "Chương trình đào tạo"),
          classId,
        ],
      );

      if (!result.rows[0]) {
        throw createHttpError(404, "Không tìm thấy lớp.");
      }

      return result.rows[0];
    });

    res.json(data);
  }),
);

app.delete(
  "/api/management/classes/:classId",
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const classId = parseId(req.params.classId, "Mã lớp");
    const data = await withAppContext(req, async (client) => {
      const result = await client.query(
        `
        delete from public.classes
        where id = $1
        returning id
        `,
        [classId],
      );

      if (!result.rows[0]) {
        throw createHttpError(404, "Không tìm thấy lớp.");
      }

      return result.rows[0];
    });

    res.json(data);
  }),
);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = error.status || 500;
  const message =
    status === 500 ? "Có lỗi xảy ra trong hệ thống." : error.message;

  console.error(error);

  if (req.path.startsWith("/api/")) {
    res.status(status).json({ message });
    return;
  }

  res.status(status).send(message);
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
