export class ManagementOverview {
    #db;
    #presenter;
    #route;

    constructor({ db, presenter, route }) {
        this.#db = db;
        this.#presenter = presenter;
        this.#route = route;
    }

    register(app) {
        app.get(
            this.#route.managementOverview,
            this.#route.requireRole("admin", "academic_executor"),
            this.#route.asyncRoute(async (req, res) => {
                const data = await this.#db.withAppContext(req, (client) =>
                    this.#getOverview(client, req.session.role),
                );

                res.json(data);
            }),
        );
    }

    async #getOverview(client, role = "admin") {
        const [
            countsResult,
            accountsResult,
            academicsResult,
            teachersResult,
            classesResult,
            studentsResult,
            subjectsResult,
            programSubjectsResult,
            classSubjectsResult,
            programsResult,
        ] = await this.#runQueries([
            () => client.query(`
                select
                    (select count(*)::int from public.accounts) as accounts,
                    (select count(*)::int from public.academic_executors) as academic_executors,
                    (select count(*)::int from public.teachers) as teachers,
                    (select count(*)::int from public.students) as students,
                    (select count(*)::int from public.classes) as classes,
                    (select count(*)::int from public.subjects) as subjects,
                    (select count(*)::int from public.academic_programs) as programs,
                    (select count(*)::int from public.class_subjects where status = 'open') as open_courses
            `),
            () => client.query(`
                select *
                from public.account_details_view
                order by username
            `),
            () => client.query(`
                select
                    ae.id,
                    ae.account_id,
                    a.username,
                    a.status,
                    p.family_name,
                    p.given_name,
                    p.full_name,
                    to_char(p.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
                    p.gender,
                    p.phone,
                    p.email
                from public.academic_executors ae
                join public.accounts a on a.id = ae.account_id
                join public.people p on p.account_id = ae.account_id
                order by p.full_name
            `),
            () => client.query(`
                select
                    t.id,
                    t.account_id,
                    t.contract_type,
                    a.username,
                    a.status,
                    p.family_name,
                    p.given_name,
                    p.full_name,
                    to_char(p.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
                    p.gender,
                    p.phone,
                    p.email
                from public.teachers t
                join public.accounts a on a.id = t.account_id
                join public.people p on p.account_id = t.account_id
                order by p.full_name
            `),
            () => client.query(`
                select
                    c.*,
                    ap.program_code,
                    ap.program_name
                from public.classes c
                join public.academic_programs ap on ap.id = c.program_id
                order by c.class_code
            `),
            () => client.query(`
                select
                    s.*,
                    a.username,
                    a.status,
                    p.family_name,
                    p.given_name,
                    p.full_name,
                    to_char(p.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
                    p.gender,
                    p.phone,
                    p.email,
                    c.class_code,
                    ap.program_code,
                    ap.program_name
                from public.students s
                join public.accounts a on a.id = s.user_id
                join public.people p on p.account_id = s.user_id
                join public.classes c on c.id = s.class_id
                join public.academic_programs ap on ap.id = c.program_id
                order by s.student_code
            `),
            () => client.query(`
                select *
                from public.subjects
                order by subject_code
            `),
            () => client.query(`
                select
                    ps.*,
                    ap.program_code,
                    ap.program_name,
                    s.subject_code,
                    s.subject_name,
                    s.credits,
                    s.total_periods
                from public.program_subjects ps
                join public.academic_programs ap on ap.id = ps.program_id
                join public.subjects s on s.id = ps.subject_id
                order by ap.program_code, ps.semester_no, ps.term_type, s.subject_code
            `),
            () => client.query(`
                select
                    tac.*,
                    count(distinct ss.student_id)::int as student_count
                from public.teacher_assigned_classes_view tac
                left join public.student_scores ss
                    on ss.class_subject_id = tac.class_subject_id
                group by
                    tac.class_subject_id,
                    tac.teacher_id,
                    tac.teacher_name,
                    tac.contract_type,
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
                    tac.closed_at
                order by tac.class_code, tac.semester_no, tac.subject_code
            `),
            () => client.query(`
                select
                    ap.*,
                    count(distinct c.id)::int as classes_count,
                    count(distinct ps.id)::int as curriculum_subjects_count
                from public.academic_programs ap
                left join public.classes c on c.program_id = ap.id
                left join public.program_subjects ps on ps.program_id = ap.id
                group by ap.id
                order by ap.program_code
            `),
        ]);

        const canManageAll = role === "admin";
        const canManagePeople =
            canManageAll || role === "academic_executor";

        return {
            counts: countsResult.rows[0],
            accounts: canManageAll
                ? accountsResult.rows.map((row) =>
                      ({
                          ...this.#presenter.mapAccount(row),
                          fullName: row.full_name,
                      }),
                  )
                : accountsResult.rows
                      .filter(
                          (account) =>
                              account.role === "teacher" ||
                              account.role === "student",
                      )
                      .map((row) => ({
                          ...this.#presenter.mapAccount(row),
                          fullName: row.full_name,
                      })),
            academicExecutors: canManageAll ? academicsResult.rows : [],
            teachers: teachersResult.rows,
            classes: classesResult.rows,
            students: canManagePeople ? studentsResult.rows : [],
            subjects: subjectsResult.rows,
            programSubjects: programSubjectsResult.rows,
            classSubjects: classSubjectsResult.rows,
            programs: programsResult.rows,
        };
    }

    async #runQueries(tasks) {
        const results = [];

        for (const task of tasks) {
            results.push(await task());
        }

        return results;
    }
}
