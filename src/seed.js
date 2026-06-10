import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

async function seed() {
    const students = [
        {
            username: "HS001",
            password: "123456",
            fullName: "Nguyễn Văn An",
            kttx: 8.5,
            ktdk: 7.0,
        },
        {
            username: "HS002",
            password: "123456",
            fullName: "Trần Thị Bình",
            kttx: 9.0,
            ktdk: 8.5,
        },
    ];

    try {
        await pool.query("begin");

        for (const student of students) {
        const passwordHash = await bcrypt.hash(student.password, 10);

        const accountResult = await pool.query(
            `
            insert into public.accounts (username, password_hash)
            values ($1, $2)
            on conflict (username)
            do update set password_hash = excluded.password_hash
            returning id
            `,
            [student.username, passwordHash],
        );

        const accountId = accountResult.rows[0].id;

        await pool.query(
            `
            insert into public.students (account_id, full_name, kttx, ktdk)
            values ($1, $2, $3, $4)
            on conflict (account_id)
            do update set
            full_name = excluded.full_name,
            kttx = excluded.kttx,
            ktdk = excluded.ktdk
            `,
            [accountId, student.fullName, student.kttx, student.ktdk],
        );
        }

        await pool.query("commit");

        console.log("Đã tạo dữ liệu giả thành công.");
        console.log("Tài khoản học sinh:");
        console.log("HS001 / 123456");
        console.log("HS002 / 123456");
    } catch (error) {
        await pool.query("rollback");
        console.error("Lỗi tạo dữ liệu giả:", error);
    } finally {
        await pool.end();
    }
}

seed();