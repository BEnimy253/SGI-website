export class Programs {
    #db;
    #http;
    #route;
    #values;

    constructor({ db, http, route, values }) {
        this.#db = db;
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
            this.#route.managementPrograms,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const result = await client.query(
                        `
                        insert into public.academic_programs (
                            program_code,
                            program_name,
                            total_semesters,
                            tuition_per_semester
                        )
                        values ($1, $2, $3, $4)
                        returning id
                        `,
                        [
                            this.#values.requiredText(
                                body.programCode,
                                "Mã ngành",
                            ),
                            this.#values.requiredText(
                                body.programName,
                                "Tên ngành",
                            ),
                            this.#values.parseInteger(
                                body.totalSemesters,
                                "Tổng số học kỳ",
                                1,
                                20,
                            ),
                            this.#values.parseNumber(
                                body.tuitionPerSemester,
                                "Học phí mỗi kỳ",
                            ),
                        ],
                    );

                    return result.rows[0];
                });

                res.status(201).json(data);
            }),
        );
    }

    #registerUpdate(app) {
        app.put(
            this.#route.managementProgram,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const programId = this.#values.parseId(
                    req.params.programId,
                    "Mã ngành học",
                );
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const result = await client.query(
                        `
                        update public.academic_programs
                        set
                            program_code = $1,
                            program_name = $2,
                            total_semesters = $3,
                            tuition_per_semester = $4
                        where id = $5
                        returning id
                        `,
                        [
                            this.#values.requiredText(
                                body.programCode,
                                "Mã ngành",
                            ),
                            this.#values.requiredText(
                                body.programName,
                                "Tên ngành",
                            ),
                            this.#values.parseInteger(
                                body.totalSemesters,
                                "Tổng số học kỳ",
                                1,
                                20,
                            ),
                            this.#values.parseNumber(
                                body.tuitionPerSemester,
                                "Học phí mỗi kỳ",
                            ),
                            programId,
                        ],
                    );

                    if (!result.rows[0]) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy ngành học.",
                        );
                    }

                    return result.rows[0];
                });

                res.json(data);
            }),
        );
    }

    #registerDelete(app) {
        app.delete(
            this.#route.managementProgram,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const programId = this.#values.parseId(
                    req.params.programId,
                    "Mã ngành học",
                );
                const data = await this.#db.withAppContext(req, async (client) => {
                    const usageResult = await client.query(
                        `
                        select
                            (select count(*)::int from public.classes where program_id = $1) as classes,
                            (select count(*)::int from public.program_subjects where program_id = $1) as subjects
                        `,
                        [programId],
                    );
                    const usage = usageResult.rows[0];

                    if (usage.classes > 0 || usage.subjects > 0) {
                        throw this.#http.createError(
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
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy ngành học.",
                        );
                    }

                    return result.rows[0];
                });

                res.json(data);
            }),
        );
    }
}
