export class CurrentAccount {
    #db;
    #http;
    #presenter;
    #route;

    constructor({ db, http, presenter, route }) {
        this.#db = db;
        this.#http = http;
        this.#presenter = presenter;
        this.#route = route;
    }

    register(app) {
        app.get(
            this.#route.apiMe,
            this.#route.requireApiLogin,
            this.#route.asyncRoute(async (req, res) => {
                const data = await this.#db.withAppContext(req, (client) =>
                    this.#getCurrentUser(client, req.session.userId),
                );

                res.json(data);
            }),
        );
    }

    async #getCurrentUser(client, accountId) {
        const result = await client.query(
            `
            select *
            from public.account_details_view
            where id = $1
            limit 1
            `,
            [accountId],
        );
        const row = result.rows[0];

        if (!row) {
            throw this.#http.createError(
                401,
                "Phiên đăng nhập không còn hợp lệ.",
            );
        }

        let roleProfile = null;

        if (row.role === "student") {
            const profile = await client.query(
                `
                select
                    s.id,
                    s.student_code,
                    s.class_id,
                    c.class_code,
                    s.cohort_code,
                    s.start_year,
                    s.end_year,
                    s.current_semester,
                    s.total_semesters,
                    s.tuition_paid_through_semester,
                    s.tuition_per_semester,
                    s.outstanding_debt,
                    ap.program_code,
                    ap.program_name
                from public.students s
                join public.classes c on c.id = s.class_id
                join public.academic_programs ap on ap.id = c.program_id
                where s.user_id = $1
                `,
                [accountId],
            );
            roleProfile = profile.rows[0] ?? null;
        } else if (row.role === "teacher") {
            const profile = await client.query(
                `
                select id, contract_type
                from public.teachers
                where account_id = $1
                `,
                [accountId],
            );
            roleProfile = profile.rows[0] ?? null;
        } else if (row.role === "academic_executor") {
            const profile = await client.query(
                `
                select id
                from public.academic_executors
                where account_id = $1
                `,
                [accountId],
            );
            roleProfile = profile.rows[0] ?? null;
        }

        return {
            account: this.#presenter.mapAccount(row),
            person: this.#presenter.mapPerson(row),
            roleProfile,
        };
    }
}
