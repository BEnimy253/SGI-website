export class Subjects {
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
            this.#route.managementSubjects,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const result = await client.query(
                        `
                        insert into public.subjects (
                            subject_code,
                            subject_name,
                            total_periods,
                            credits
                        )
                        values ($1, $2, $3, $4)
                        returning id
                        `,
                        [
                            this.#values.requiredText(
                                body.subjectCode,
                                "Mã môn học",
                            ),
                            this.#values.requiredText(
                                body.subjectName,
                                "Tên môn học",
                            ),
                            this.#values.parseInteger(
                                body.totalPeriods,
                                "Tổng số tiết",
                                1,
                                1000,
                            ),
                            this.#values.parseInteger(
                                body.credits,
                                "Số tín chỉ",
                                1,
                                12,
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
            this.#route.managementSubject,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const subjectId = this.#values.parseId(
                    req.params.subjectId,
                    "Mã môn học",
                );
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const result = await client.query(
                        `
                        update public.subjects
                        set
                            subject_code = $1,
                            subject_name = $2,
                            total_periods = $3,
                            credits = $4
                        where id = $5
                        returning id
                        `,
                        [
                            this.#values.requiredText(
                                body.subjectCode,
                                "Mã môn học",
                            ),
                            this.#values.requiredText(
                                body.subjectName,
                                "Tên môn học",
                            ),
                            this.#values.parseInteger(
                                body.totalPeriods,
                                "Tổng số tiết",
                                1,
                                1000,
                            ),
                            this.#values.parseInteger(
                                body.credits,
                                "Số tín chỉ",
                                1,
                                12,
                            ),
                            subjectId,
                        ],
                    );

                    if (!result.rows[0]) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy môn học.",
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
            this.#route.managementSubject,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const subjectId = this.#values.parseId(
                    req.params.subjectId,
                    "Mã môn học",
                );
                const data = await this.#db.withAppContext(req, async (client) => {
                    const result = await client.query(
                        `
                        delete from public.subjects
                        where id = $1
                        returning id
                        `,
                        [subjectId],
                    );

                    if (!result.rows[0]) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy môn học.",
                        );
                    }

                    return result.rows[0];
                });

                res.json(data);
            }),
        );
    }
}
