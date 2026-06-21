export class StudentApi {
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
            this.#route.studentInfo,
            this.#route.requireRole("student"),
            this.#route.asyncRoute(async (req, res) => {
                const data = await this.#db.withAppContext(req, async (client) => {
                    const studentResult = await client.query(
                        `
                        select
                            s.id as student_id,
                            s.student_code,
                            p.family_name,
                            p.given_name,
                            p.full_name,
                            to_char(p.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
                            p.gender,
                            p.phone,
                            p.email,
                            s.cohort_code,
                            s.start_year,
                            s.end_year,
                            s.current_semester,
                            s.total_semesters,
                            s.tuition_paid_through_semester,
                            s.tuition_per_semester,
                            s.outstanding_debt,
                            c.class_code,
                            ap.program_code,
                            ap.program_name
                        from public.students s
                        join public.people p on p.account_id = s.user_id
                        join public.classes c on c.id = s.class_id
                        join public.academic_programs ap
                            on ap.id = c.program_id
                        where s.user_id = $1
                        limit 1
                        `,
                        [req.session.userId],
                    );

                    const studentRow = studentResult.rows[0];

                    if (!studentRow) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy thông tin học sinh.",
                        );
                    }

                    const scoresResult = await client.query(
                        `
                        select *
                        from public.student_score_details_view
                        where student_id = $1
                        order by semester_no, subject_code
                        `,
                        [studentRow.student_id],
                    );

                    return {
                        student: {
                            id: studentRow.student_id,
                            studentCode: studentRow.student_code,
                            familyName: studentRow.family_name,
                            givenName: studentRow.given_name,
                            fullName: studentRow.full_name,
                            dateOfBirth: studentRow.date_of_birth,
                            gender: studentRow.gender,
                            phone: studentRow.phone,
                            email: studentRow.email,
                            classCode: studentRow.class_code,
                            cohortCode: studentRow.cohort_code,
                            startYear: studentRow.start_year,
                            endYear: studentRow.end_year,
                            currentSemester: studentRow.current_semester,
                            totalSemesters: studentRow.total_semesters,
                            tuitionPaidThroughSemester:
                                studentRow.tuition_paid_through_semester,
                            tuitionPerSemester: Number(
                                studentRow.tuition_per_semester,
                            ),
                            outstandingDebt: Number(
                                studentRow.outstanding_debt,
                            ),
                            programCode: studentRow.program_code,
                            programName: studentRow.program_name,
                        },
                        scores: scoresResult.rows.map((row) =>
                            this.#presenter.mapScore(row),
                        ),
                    };
                });

                res.json(data);
            }),
        );
    }
}
