import express from "express";
import session from "express-session";
import path from "node:path";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { pool, testDatabaseConnection } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public", { index: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
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

function requireLogin(req, res, next) {
  if (req.session.accountId) {
    next();
    return;
  }

  res.redirect("/login");
}

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function ceilToOneDecimal(value) {
  return Number((Math.ceil((value - 1e-9) * 10) / 10).toFixed(1));
}

function calculateFinalScore(score) {
  const processScores = [
    { value: toNumber(score.kttx1), weight: 1 },
    { value: toNumber(score.kttx2), weight: 1 },
    { value: toNumber(score.ktdk1), weight: 2 },
    { value: toNumber(score.ktdk2), weight: 2 },
  ].filter((item) => item.value !== null);

  const examScores = [toNumber(score.ktm1), toNumber(score.ktm2)].filter(
    (value) => value !== null,
  );

  if (processScores.length === 0 || examScores.length === 0) {
    return null;
  }

  const processWeight = processScores.reduce(
    (total, item) => total + item.weight,
    0,
  );
  const processTotal = processScores.reduce(
    (total, item) => total + item.value * item.weight,
    0,
  );
  const examTotal = examScores.reduce((total, value) => total + value, 0);

  const processAverage = processTotal / processWeight;
  const examAverage = examTotal / examScores.length;

  return ceilToOneDecimal(processAverage * 0.4 + examAverage * 0.6);
}

function normalizeScore(row) {
  const score = {
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    subjectOrder: row.subject_order,
    period: row.period,
    kttx1: toNumber(row.kttx1),
    kttx2: toNumber(row.kttx2),
    ktdk1: toNumber(row.ktdk1),
    ktdk2: toNumber(row.ktdk2),
    ktm1: toNumber(row.ktm1),
    ktm2: toNumber(row.ktm2),
  };

  return {
    ...score,
    finalScore: calculateFinalScore(score),
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

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      `
      select id, username, password_hash
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

    const isValidPassword = await bcrypt.compare(
      password,
      account.password_hash,
    );

    if (!isValidPassword) {
      res.redirect("/login?error=password");
      return;
    }

    req.session.accountId = account.id;
    res.redirect("/dashboard");
  } catch (error) {
    console.error(error);
    res.status(500).send("Có lỗi khi đăng nhập.");
  }
});

app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(process.cwd(), "views", "dashboard.html"));
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.get("/db-test", async (req, res) => {
  try {
    const dbTime = await testDatabaseConnection();

    res.send(`
      <h1>Kết nối Database thành công</h1>
      <p>Thời gian database: ${dbTime.current_time}</p>
    `);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send("Kết nối database thất bại. Kiểm tra DATABASE_URL trong file .env.");
  }
});

app.get("/api/student-info", requireLogin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("select set_config('app.account_id', $1, true)", [
      String(req.session.accountId),
    ]);

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
      left join public.classes c on c.id = s.class_id
      where s.user_id = $1
      limit 1
      `,
      [req.session.accountId],
    );

    const studentRow = studentResult.rows[0];

    if (!studentRow) {
      await client.query("commit");
      res.status(404).json({
        message: "Không tìm thấy thông tin học sinh.",
      });
      return;
    }

    const scoresResult = await client.query(
      `
      select
        ss.subject_id,
        sub.subject_code,
        sub.subject_name,
        sub.subject_order,
        sub.period,
        ss.kttx1,
        ss.kttx2,
        ss.ktdk1,
        ss.ktdk2,
        ss.ktm1,
        ss.ktm2
      from public.student_scores ss
      join public.subjects sub on sub.id = ss.subject_id
      where ss.student_id = $1
      order by sub.subject_order, sub.subject_name
      `,
      [studentRow.student_id],
    );

    await client.query("commit");

    res.json({
      student: {
        id: studentRow.student_id,
        studentCode: studentRow.student_code,
        fullName: studentRow.full_name,
        dateOfBirth: studentRow.date_of_birth,
        classCode: studentRow.class_code,
        major: studentRow.major,
        educationLevel: studentRow.education_level,
        course:
          studentRow.school_year_start && studentRow.school_year_end
            ? `${studentRow.school_year_start} - ${studentRow.school_year_end}`
            : null,
      },
      scores: scoresResult.rows.map(normalizeScore),
    });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error(error);
    res.status(500).json({
      message: "Không thể lấy thông tin học sinh.",
    });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
