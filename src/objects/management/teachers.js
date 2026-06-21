export class Teachers {
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
            this.#route.managementTeachers,
            this.#route.requireRole("admin", "academic_executor"),
            this.#route.asyncRoute(async (req, res) => {
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const accountId = await this.#credentials.create(
                        client,
                        "teacher",
                        body,
                    );
                    await this.#credentials.createPerson(
                        client,
                        accountId,
                        body,
                    );
                    const result = await client.query(
                        `
                        insert into public.teachers (
                            account_id,
                            contract_type
                        )
                        values ($1, $2)
                        returning id
                        `,
                        [
                            accountId,
                            this.#values.parseContractType(
                                body.contractType,
                            ),
                        ],
                    );

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
            this.#route.managementTeacher,
            this.#route.requireRole("admin", "academic_executor"),
            this.#route.asyncRoute(async (req, res) => {
                const teacherId = this.#values.parseId(
                    req.params.teacherId,
                    "Mã giáo viên",
                );
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
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
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy giáo viên.",
                        );
                    }

                    await this.#credentials.update(
                        client,
                        teacher.account_id,
                        body,
                    );
                    await this.#credentials.updatePerson(
                        client,
                        teacher.account_id,
                        body,
                    );

                    const result = await client.query(
                        `
                        update public.teachers
                        set
                            contract_type = $1
                        where id = $2
                        returning id
                        `,
                        [
                            this.#values.parseContractType(
                                body.contractType,
                            ),
                            teacherId,
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
            this.#route.managementTeacher,
            this.#route.requireRole("admin", "academic_executor"),
            this.#route.asyncRoute(async (req, res) => {
                const teacherId = this.#values.parseId(
                    req.params.teacherId,
                    "Mã giáo viên",
                );
                const data = await this.#db.withAppContext(req, async (client) => {
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
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy giáo viên.",
                        );
                    }

                    await client.query(
                        `
                        update public.class_subjects
                        set
                            status = 'closed',
                            teacher_id = null
                        where teacher_id = $1
                        `,
                        [teacherId],
                    );

                    await client.query(
                        "delete from public.accounts where id = $1",
                        [teacher.account_id],
                    );

                    return { id: teacherId };
                });

                res.json(data);
            }),
        );
    }
}
