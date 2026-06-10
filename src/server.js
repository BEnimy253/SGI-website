import express from "express";
import session from "express-session";
import path from "node:path";
import { testDatabaseConnection } from "./db.js";
import { pool } from "./db.js";
import bcrypt from "bcryptjs";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use(express.urlencoded({extended: true}));

app.use(express.static("public", {index: false}));

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

// Navigate to Homepage
app.get("/", (req, res) => {
    if (req.session.accountId) {
        res.redirect("/dashboard");
        return;
    }

    res.redirect("/homepage");
});

// Navigate to Dashboard if logged in
app.get("/homepage", (req, res) => {
    if (req.session.accountId) {
        res.redirect("/dashboard");
        return;
    }

    res.sendFile(path.join(process.cwd(), "public", "index.html"));
});


app.get("/login", (req, res) => {
    if (req.session.accountId) {
        res.redirect("/dashboard");
        return;
    }

    res.sendFile(path.join(process.cwd(), "views", "login.html"));
});

// Login handler
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
      res.redirect("/login?error=1");
      return;
    }

    const isValidPassword = await bcrypt.compare(
      password,
      account.password_hash,
    );

    if (!isValidPassword) {
      res.redirect("/login?error=1");
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
      <h1>Kết nối Supabase thành công</h1>
      <p>Thời gian database: ${dbTime.current_time}</p>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Kết nối database thất bại. Kiểm tra DATABASE_URL trong file .env.");
  }
});

app.get("/api/student-info", requireLogin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      select
        a.username,
        s.full_name,
        s.kttx,
        s.ktdk
      from public.accounts a
      left join public.students s on s.account_id = a.id
      where a.id = $1
      limit 1
      `,
      [req.session.accountId],
    );

    const student = result.rows[0];

    if (!student) {
      res.status(404).json({
        message: "Không tìm thấy thông tin học sinh.",
      });
      return;
    }

    res.json({
      student,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Không thể lấy thông tin học sinh.",
    });
  }
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
})