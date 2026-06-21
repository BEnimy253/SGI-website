export class Classes {
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
            this.#route.managementClasses,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const result = await client.query(
                        `
                        insert into public.classes (
                            class_code,
                            program_id,
                            cohort_code,
                            start_year,
                            end_year,
                            total_semesters
                        )
                        select
                            $1,
                            ap.id,
                            $3,
                            $4,
                            $5,
                            coalesce($6, ap.total_semesters)
                        from public.academic_programs ap
                        where ap.id = $2
                        returning id
                        `,
                        [
                            this.#values.requiredText(
                                body.classCode,
                                "Mã lớp",
                            ),
                            this.#values.parseId(
                                body.programId,
                                "Ngành",
                            ),
                            this.#values.requiredText(
                                body.cohortCode,
                                "Khóa",
                            ),
                            this.#values.parseInteger(
                                body.startYear,
                                "Năm bắt đầu",
                                2000,
                                2200,
                            ),
                            this.#values.parseInteger(
                                body.endYear,
                                "Năm kết thúc",
                                2000,
                                2200,
                            ),
                            body.totalSemesters
                                ? this.#values.parseInteger(
                                      body.totalSemesters,
                                      "Tổng số học kỳ",
                                      1,
                                      20,
                                  )
                                : null,
                        ],
                    );

                    if (!result.rows[0]) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy chương trình đào tạo.",
                        );
                    }

                    await client.query(
                        "select public.sync_class_curriculum($1)",
                        [result.rows[0].id],
                    );

                    return result.rows[0];
                });

                res.status(201).json(data);
            }),
        );
    }

    #registerUpdate(app) {
        app.put(
            this.#route.managementClass,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const classId = this.#values.parseId(
                    req.params.classId,
                    "Mã lớp",
                );
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const current = await client.query(
                        "select program_id from public.classes where id = $1",
                        [classId],
                    );
                    if (!current.rows[0]) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy lớp.",
                        );
                    }
                    const programId = this.#values.parseId(
                        body.programId,
                        "Ngành",
                    );

                    if (Number(current.rows[0].program_id) !== programId) {
                        await client.query(
                            "delete from public.class_subjects where class_id = $1",
                            [classId],
                        );
                    }

                    const result = await client.query(
                        `
                        update public.classes
                        set
                            class_code = $1,
                            program_id = $2,
                            cohort_code = $3,
                            start_year = $4,
                            end_year = $5,
                            total_semesters = $6
                        where id = $7
                        returning id
                        `,
                        [
                            this.#values.requiredText(
                                body.classCode,
                                "Mã lớp",
                            ),
                            programId,
                            this.#values.requiredText(
                                body.cohortCode,
                                "Khóa",
                            ),
                            this.#values.parseInteger(
                                body.startYear,
                                "Năm bắt đầu",
                                2000,
                                2200,
                            ),
                            this.#values.parseInteger(
                                body.endYear,
                                "Năm kết thúc",
                                2000,
                                2200,
                            ),
                            this.#values.parseInteger(
                                body.totalSemesters,
                                "Tổng số học kỳ",
                                1,
                                20,
                            ),
                            classId,
                        ],
                    );

                    if (!result.rows[0]) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy lớp.",
                        );
                    }

                    await client.query(
                        "select public.sync_class_curriculum($1)",
                        [classId],
                    );

                    return result.rows[0];
                });

                res.json(data);
            }),
        );
    }

    #registerDelete(app) {
        app.delete(
            this.#route.managementClass,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const classId = this.#values.parseId(
                    req.params.classId,
                    "Mã lớp",
                );
                const data = await this.#db.withAppContext(req, async (client) => {
                    const result = await client.query(
                        `
                        delete from public.classes
                        where id = $1
                        returning id
                        `,
                        [classId],
                    );

                    if (!result.rows[0]) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy lớp.",
                        );
                    }

                    return result.rows[0];
                });

                res.json(data);
            }),
        );
    }
}
