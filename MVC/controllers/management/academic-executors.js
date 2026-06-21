export class AcademicExecutors {
    #db;
    #http;
    #route;
    #values;
    #credentials;

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
            this.#route.adminAcademicExecutors,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const accountId = await this.#credentials.create(
                        client,
                        "academic_executor",
                        body,
                    );
                    await this.#credentials.createPerson(
                        client,
                        accountId,
                        body,
                    );
                    const result = await client.query(
                        `
                        insert into public.academic_executors (account_id)
                        values ($1)
                        returning id
                        `,
                        [accountId],
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
            this.#route.adminAcademicExecutor,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const executorId = this.#values.parseId(
                    req.params.executorId,
                    "Mã giáo vụ",
                );
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const executorResult = await client.query(
                        `
                        select account_id
                        from public.academic_executors
                        where id = $1
                        limit 1
                        `,
                        [executorId],
                    );

                    const executor = executorResult.rows[0];

                    if (!executor) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy giáo vụ.",
                        );
                    }

                    await this.#credentials.update(
                        client,
                        executor.account_id,
                        body,
                    );
                    await this.#credentials.updatePerson(
                        client,
                        executor.account_id,
                        body,
                    );

                    return { id: executorId };
                });

                res.json(data);
            }),
        );
    }

    #registerDelete(app) {
        app.delete(
            this.#route.adminAcademicExecutor,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute(async (req, res) => {
                const executorId = this.#values.parseId(
                    req.params.executorId,
                    "Mã giáo vụ",
                );
                const data = await this.#db.withAppContext(req, async (client) => {
                    const executorResult = await client.query(
                        `
                        select account_id
                        from public.academic_executors
                        where id = $1
                        limit 1
                        `,
                        [executorId],
                    );

                    const executor = executorResult.rows[0];

                    if (!executor) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy giáo vụ.",
                        );
                    }

                    await client.query(
                        "delete from public.accounts where id = $1",
                        [executor.account_id],
                    );

                    return { id: executorId };
                });

                res.json(data);
            }),
        );
    }
}
