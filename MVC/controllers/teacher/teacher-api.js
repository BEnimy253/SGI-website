export class TeacherApi {
    #db;
    #http;
    #route;

    constructor({ db, http, route }) {
        this.#db = db;
        this.#http = http;
        this.#route = route;
    }

    register(app) {
        this.#registerClasses(app);
    }

    #registerClasses(app) {
        app.get(
            this.#route.teacherClasses,
            this.#route.requireRole("teacher"),
            this.#route.asyncRoute(async (req, res) => {
                const data = await this.#db.withAppContext(req, async (client) => {
                    const teacher = await this.#getTeacherProfile(
                        client,
                        req.session.userId,
                    );
                    const assignmentsResult = await client.query(
                        `
                        select
                            tac.class_subject_id,
                            tac.class_id,
                            tac.class_code,
                            tac.cohort_code,
                            tac.start_year,
                            tac.end_year,
                            tac.program_id,
                            tac.program_code,
                            tac.program_name,
                            tac.semester_no,
                            tac.term_type,
                            tac.subject_id,
                            tac.subject_code,
                            tac.subject_name,
                            tac.total_periods,
                            tac.credits,
                            tac.planned_sessions,
                            tac.class_subject_status,
                            tac.opened_at,
                            count(distinct ss.student_id)::int as student_count
                        from public.teacher_assigned_classes_view tac
                        left join public.student_scores ss
                            on ss.class_subject_id = tac.class_subject_id
                        where tac.teacher_id = $1
                        group by
                            tac.class_subject_id,
                            tac.class_id,
                            tac.class_code,
                            tac.cohort_code,
                            tac.start_year,
                            tac.end_year,
                            tac.program_id,
                            tac.program_code,
                            tac.program_name,
                            tac.semester_no,
                            tac.term_type,
                            tac.subject_id,
                            tac.subject_code,
                            tac.subject_name,
                            tac.total_periods,
                            tac.credits,
                            tac.planned_sessions,
                            tac.class_subject_status,
                            tac.opened_at
                        order by tac.class_code, tac.semester_no, tac.subject_code
                        `,
                        [teacher.id],
                    );

                    return {
                        teacher,
                        assignments: assignmentsResult.rows,
                    };
                });

                res.json(data);
            }),
        );
    }

    async #getTeacherProfile(client, accountId) {
        const result = await client.query(
            `
            select t.id, p.full_name, t.contract_type
            from public.teachers t
            join public.people p on p.account_id = t.account_id
            where t.account_id = $1
            limit 1
            `,
            [accountId],
        );

        if (!result.rows[0]) {
            throw this.#http.createError(
                404,
                "Không tìm thấy hồ sơ giáo viên.",
            );
        }

        return result.rows[0];
    }

}
