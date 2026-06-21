const SCORE_FIELDS = [
    "kttx1",
    "kttx2",
    "ktdk1",
    "ktdk2",
    "ktm1",
    "ktm2",
];

export class GradebookApi {
    #db;
    #http;
    #presenter;
    #route;
    #values;

    constructor({ db, http, presenter, route, values }) {
        this.#db = db;
        this.#http = http;
        this.#presenter = presenter;
        this.#route = route;
        this.#values = values;
    }

    register(app) {
        app.get(
            this.#route.gradebook,
            this.#route.requireRole(
                "admin",
                "academic_executor",
                "teacher",
            ),
            this.#route.asyncRoute((req, res) =>
                this.#getGradebook(req, res),
            ),
        );

        app.put(
            this.#route.gradebookStudent,
            this.#route.requireRole(
                "admin",
                "academic_executor",
                "teacher",
            ),
            this.#route.asyncRoute((req, res) =>
                this.#updateScore(req, res),
            ),
        );

        app.put(
            this.#route.gradebookSession,
            this.#route.requireRole(
                "admin",
                "academic_executor",
                "teacher",
            ),
            this.#route.asyncRoute((req, res) =>
                this.#updateSessionDate(req, res),
            ),
        );

        app.put(
            this.#route.gradebookAttendance,
            this.#route.requireRole(
                "admin",
                "academic_executor",
                "teacher",
            ),
            this.#route.asyncRoute((req, res) =>
                this.#updateAttendance(req, res),
            ),
        );
    }

    async #getGradebook(req, res) {
        const classSubjectId = this.#values.parseId(
            req.params.classSubjectId,
            "Lớp - môn",
        );

        const data = await this.#db.withAppContext(req, async (client) => {
            const assignment = await this.#requireAccess(
                client,
                req,
                classSubjectId,
            );
            const sessions = await client.query(
                `
                select
                    id,
                    session_no,
                    to_char(study_date, 'YYYY-MM-DD') as study_date,
                    lesson_periods
                from public.course_sessions
                where class_subject_id = $1
                order by session_no
                `,
                [classSubjectId],
            );
            const scoreResult = await client.query(
                `
                select *
                from public.student_score_details_view
                where class_subject_id = $1
                order by student_code
                `,
                [classSubjectId],
            );
            const attendanceResult = await client.query(
                `
                select
                    session_id,
                    student_id,
                    status,
                    note
                from public.gradebook_attendance_view
                where class_subject_id = $1
                `,
                [classSubjectId],
            );

            const attendanceByStudent = {};
            for (const row of attendanceResult.rows) {
                attendanceByStudent[row.student_id] ??= {};
                attendanceByStudent[row.student_id][row.session_id] = {
                    status: row.status,
                    note: row.note,
                };
            }

            return {
                assignment,
                sessions: sessions.rows,
                students: scoreResult.rows.map((row) => ({
                    ...this.#presenter.mapScore(row),
                    attendance: attendanceByStudent[row.student_id] ?? {},
                })),
            };
        });

        res.json(data);
    }

    async #updateScore(req, res) {
        const classSubjectId = this.#values.parseId(
            req.params.classSubjectId,
            "Lớp - môn",
        );
        const studentId = this.#values.parseId(
            req.params.studentId,
            "Học sinh",
        );

        const data = await this.#db.withAppContext(req, async (client) => {
            await this.#requireAccess(client, req, classSubjectId);
            const scores = SCORE_FIELDS.map((field) =>
                this.#values.parseScore(
                    req.body[field],
                    field.toUpperCase(),
                ),
            );
            const result = await client.query(
                `
                update public.student_scores
                set
                    kttx1 = $1,
                    kttx2 = $2,
                    ktdk1 = $3,
                    ktdk2 = $4,
                    ktm1 = $5,
                    ktm2 = $6,
                    note = $7
                where student_id = $8
                  and class_subject_id = $9
                returning id
                `,
                [
                    ...scores,
                    this.#values.optionalText(req.body.note),
                    studentId,
                    classSubjectId,
                ],
            );

            if (!result.rows[0]) {
                throw this.#http.createError(
                    404,
                    "Không tìm thấy bảng điểm học sinh.",
                );
            }

            const refreshed = await client.query(
                `
                select *
                from public.student_score_details_view
                where student_id = $1
                  and class_subject_id = $2
                `,
                [studentId, classSubjectId],
            );
            return this.#presenter.mapScore(refreshed.rows[0]);
        });

        res.json({ score: data });
    }

    async #updateSessionDate(req, res) {
        const classSubjectId = this.#values.parseId(
            req.params.classSubjectId,
            "Lớp - môn",
        );
        const sessionId = this.#values.parseId(
            req.params.sessionId,
            "Buổi học",
        );

        const data = await this.#db.withAppContext(req, async (client) => {
            await this.#requireAccess(client, req, classSubjectId);
            const result = await client.query(
                `
                update public.course_sessions
                set study_date = $1
                where id = $2
                  and class_subject_id = $3
                returning
                    id,
                    session_no,
                    to_char(study_date, 'YYYY-MM-DD') as study_date,
                    lesson_periods
                `,
                [
                    this.#values.optionalDate(req.body.studyDate),
                    sessionId,
                    classSubjectId,
                ],
            );

            if (!result.rows[0]) {
                throw this.#http.createError(
                    404,
                    "Không tìm thấy buổi học.",
                );
            }

            return result.rows[0];
        });

        res.json({ session: data });
    }

    async #updateAttendance(req, res) {
        const classSubjectId = this.#values.parseId(
            req.params.classSubjectId,
            "Lớp - môn",
        );
        const sessionId = this.#values.parseId(
            req.params.sessionId,
            "Buổi học",
        );
        const studentId = this.#values.parseId(
            req.params.studentId,
            "Học sinh",
        );

        const data = await this.#db.withAppContext(req, async (client) => {
            await this.#requireAccess(client, req, classSubjectId);
            const result = await client.query(
                `
                update public.attendance a
                set
                    status = $1,
                    note = $2
                from public.student_scores ss,
                     public.course_sessions ses
                where a.student_score_id = ss.id
                  and a.session_id = ses.id
                  and ss.student_id = $3
                  and ss.class_subject_id = $4
                  and ses.id = $5
                  and ses.class_subject_id = $4
                returning a.id, a.status, a.note
                `,
                [
                    this.#values.parseAttendanceStatus(req.body.status),
                    this.#values.optionalText(req.body.note),
                    studentId,
                    classSubjectId,
                    sessionId,
                ],
            );

            if (!result.rows[0]) {
                throw this.#http.createError(
                    404,
                    "Không tìm thấy dữ liệu điểm danh.",
                );
            }
            return result.rows[0];
        });

        res.json({ attendance: data });
    }

    async #requireAccess(client, req, classSubjectId) {
        const result = await client.query(
            `
            select *
            from public.teacher_assigned_classes_view
            where class_subject_id = $1
            limit 1
            `,
            [classSubjectId],
        );
        const assignment = result.rows[0];

        if (!assignment) {
            throw this.#http.createError(
                404,
                "Không tìm thấy lớp - môn.",
            );
        }

        if (req.session.role === "teacher") {
            const teacher = await client.query(
                `
                select id
                from public.teachers
                where account_id = $1
                `,
                [req.session.userId],
            );
            if (
                !teacher.rows[0] ||
                teacher.rows[0].id !== assignment.teacher_id
            ) {
                throw this.#http.createError(
                    403,
                    "Giáo viên không được phân công lớp - môn này.",
                );
            }
        }

        return assignment;
    }
}
