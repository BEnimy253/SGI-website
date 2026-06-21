export class Students {
    #db;
    #credentials;
    #http;
    #route;
    #values;

    constructor({ credentials, db, http, route, values }) {
        this.#db = db;
        this.#credentials = credentials;
        this.#http = http;
        this.#route = route;
        this.#values = values;
    }

    register(app) {
        this.#registerCreate(app);
        this.#registerUpdate(app);
        this.#registerDelete(app);
    }

    #registerCreate(app) {
        app.post(
            this.#route.managementStudents,
            this.#route.requireRole("admin", "academic_executor"),
            this.#route.asyncRoute(async (req, res) => {
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const accountId = await this.#credentials.create(
                        client,
                        "student",
                        body,
                    );
                    await this.#credentials.createPerson(
                        client,
                        accountId,
                        body,
                    );
                    const result = await client.query(
                        `
                        insert into public.students (
                            user_id,
                            student_code,
                            class_id,
                            cohort_code,
                            start_year,
                            end_year,
                            current_semester,
                            total_semesters,
                            tuition_paid_through_semester,
                            tuition_per_semester
                        )
                        select
                            $1,
                            $2,
                            c.id,
                            c.cohort_code,
                            c.start_year,
                            c.end_year,
                            $4,
                            c.total_semesters,
                            $5,
                            coalesce($6, ap.tuition_per_semester)
                        from public.classes c
                        join public.academic_programs ap
                            on ap.id = c.program_id
                        where c.id = $3
                        returning id
                        `,
                        [
                            accountId,
                            this.#values.requiredText(
                                body.studentCode,
                                "Mã học sinh",
                            ),
                            this.#values.parseId(
                                body.classId,
                                "Lớp",
                            ),
                            this.#values.parseInteger(
                                body.currentSemester ?? 1,
                                "Học kỳ hiện tại",
                                1,
                                20,
                            ),
                            this.#values.parseInteger(
                                body.tuitionPaidThroughSemester ?? 0,
                                "Học kỳ đã đóng học phí",
                                0,
                                20,
                            ),
                            body.tuitionPerSemester === "" ||
                            body.tuitionPerSemester === undefined
                                ? null
                                : this.#values.parseNumber(
                                      body.tuitionPerSemester,
                                      "Học phí mỗi kỳ",
                                  ),
                        ],
                    );

                    if (!result.rows[0]) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy lớp.",
                        );
                    }
                    return {
                        id: result.rows[0].id,
                        accountId,
                    };
                });

                res.status(201).json(data);
            }),
        );
    }

    #registerUpdate(app) {
        app.put(
            this.#route.managementStudent,
            this.#route.requireRole("admin", "academic_executor"),
            this.#route.asyncRoute(async (req, res) => {
                const studentId = this.#values.parseId(
                    req.params.studentId,
                    "Mã học sinh",
                );
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
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
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy học sinh.",
                        );
                    }

                    await this.#credentials.update(
                        client,
                        student.user_id,
                        body,
                    );
                    await this.#credentials.updatePerson(
                        client,
                        student.user_id,
                        body,
                    );

                    const result = await client.query(
                        `
                        update public.students
                        set
                            student_code = $1,
                            class_id = $2,
                            current_semester = $3,
                            tuition_paid_through_semester = $4,
                            tuition_per_semester = $5
                        where id = $6
                        returning id
                        `,
                        [
                            this.#values.requiredText(
                                body.studentCode,
                                "Mã học sinh",
                            ),
                            this.#values.parseId(
                                body.classId,
                                "Lớp",
                            ),
                            this.#values.parseInteger(
                                body.currentSemester,
                                "Học kỳ hiện tại",
                                1,
                                20,
                            ),
                            this.#values.parseInteger(
                                body.tuitionPaidThroughSemester,
                                "Học kỳ đã đóng học phí",
                                0,
                                20,
                            ),
                            this.#values.parseNumber(
                                body.tuitionPerSemester,
                                "Học phí mỗi kỳ",
                            ),
                            studentId,
                        ],
                    );

                    return result.rows[0];
                });

                res.json(data);
            }),
        );
    }

    #registerDelete(app) {
        app.delete(
            this.#route.managementStudent,
            this.#route.requireRole("admin", "academic_executor"),
            this.#route.asyncRoute(async (req, res) => {
                const studentId = this.#values.parseId(
                    req.params.studentId,
                    "Mã học sinh",
                );
                const data = await this.#db.withAppContext(req, async (client) => {
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
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy học sinh.",
                        );
                    }

                    await client.query(
                        "delete from public.accounts where id = $1",
                        [studentResult.rows[0].user_id],
                    );

                    return { id: studentId };
                });

                res.json(data);
            }),
        );
    }
}
