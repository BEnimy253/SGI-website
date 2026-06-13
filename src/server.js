import express from "express";
import session from "express-session";
import path from "node:path";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { pool, testDatabaseConnection } from "./db.js";
import { processInfo } from './utils/calculateScore.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public", { index: false }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,  // Don't save session if unmodified
        saveUninitialized: false,  // Don't create session until something stored
        cookie: {
            httpOnly: true,  // Prevent client-side JavaScript from accessing the cookie
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 30,  // Session expires after 30 minutes of inactivity
      },
    }),
);

// If the user is not logged in, redirect to the "/login" page
function requireLogin(req, res, next) {
    if (req.session.accountId) {
        next();
        return;
    }

    res.redirect("/login");
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
    /**
     * Check the username and password from the request body against the database.
     */
    // catch username and password from the request body
    const { username, password } = req.body;

    try {
        const result = await pool.query(
            `
            select id, username, password_hash
            from public.accounts
            where username = $1
            limit 1
            `,
            [username],  // Use 'username' as a parameter to set the value of $1 in the query
        );

        const account = result.rows[0];

        if (!account) {
            res.redirect("/login?error=username");
            return;
        }

        const isValidPassword = await bcrypt.compare(
            password,
            account.password_hash
        );

        if (!isValidPassword) {
            res.redirect("/login?error=password");
            return;
        }

        // After successful login, store the account ID in the session and redirect to the dashboard
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
    /** Destroy the session and clear the cookie, then redirect to the login page */
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

app.get("/db-test", async (req, res) => {
    /** Just using to check if the database connection is working */
    try {
        const dbTime = await testDatabaseConnection();

        res.send(
            `
            <h1>Kết nối Database thành công</h1>
            <p>Thời gian database: ${dbTime.current_time}</p>
            `
        );
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
        await client.query(
            "select set_config('app.account_id', $1, true)", 
            [String(req.session.accountId)]
        );

        const studentResult = await client.query(
            `
            select
                s.id as student_id,
                s.student_code,
                s.full_name,
                to_char(s.date_of_birth, 'DD-MM-YYYY') as date_of_birth,
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
              s1.subject_id,
              s2.subject_code,
              s2.subject_name,
              s2.subject_order,
              s2.period,
              s1.kttx1,
              s1.kttx2,
              s1.ktdk1,
              s1.ktdk2,
              s1.ktm1,
              s1.ktm2
            from public.student_scores s1
            join public.subjects s2 on s2.id = s1.subject_id
            where s1.student_id = $1
            order by s2.subject_order ASC
            `,
            [studentRow.student_id],
        );

        await client.query("commit");  // Commit the transaction after all queries are successful

        // Server returns the student information and scores in JSON format
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
            scores: scoresResult.rows.map(processInfo),
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
