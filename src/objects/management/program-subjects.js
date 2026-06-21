export class ProgramSubjects {
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
        app.post(
            this.#route.managementProgramSubjects,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute((req, res) =>
                this.#create(req, res),
            ),
        );
        app.put(
            this.#route.managementProgramSubject,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute((req, res) =>
                this.#update(req, res),
            ),
        );
        app.delete(
            this.#route.managementProgramSubject,
            this.#route.requireRole("admin"),
            this.#route.asyncRoute((req, res) =>
                this.#delete(req, res),
            ),
        );
    }

    async #create(req, res) {
        const body = req.body;
        const data = await this.#db.withAppContext(req, async (client) => {
            const result = await client.query(
                `
                insert into public.program_subjects (
                    program_id,
                    subject_id,
                    semester_no,
                    term_type,
                    reference_semester_no
                )
                values ($1, $2, $3, $4, $5)
                returning id, program_id
                `,
                [
                    this.#values.parseId(body.programId, "Ngành"),
                    this.#values.parseId(body.subjectId, "Môn học"),
                    this.#values.parseInteger(
                        body.semesterNo,
                        "Học kỳ",
                        1,
                        20,
                    ),
                    this.#values.parseTermType(body.termType),
                    body.termType === "supplementary"
                        ? this.#values.parseInteger(
                              body.referenceSemesterNo,
                              "Học kỳ bổ sung cho",
                              1,
                              20,
                          )
                        : null,
                ],
            );

            await client.query(
                `
                select public.sync_class_curriculum(id)
                from public.classes
                where program_id = $1
                `,
                [result.rows[0].program_id],
            );
            return result.rows[0];
        });
        res.status(201).json(data);
    }

    async #update(req, res) {
        const id = this.#values.parseId(
            req.params.programSubjectId,
            "Môn trong chương trình",
        );
        const body = req.body;
        const data = await this.#db.withAppContext(req, async (client) => {
            const usage = await client.query(
                `
                select count(*)::int as count
                from public.class_subjects
                where program_subject_id = $1
                `,
                [id],
            );
            if (usage.rows[0].count > 0) {
                throw this.#http.createError(
                    400,
                    "Không thể sửa môn đã được đồng bộ vào lớp.",
                );
            }

            const result = await client.query(
                `
                update public.program_subjects
                set
                    program_id = $1,
                    subject_id = $2,
                    semester_no = $3,
                    term_type = $4,
                    reference_semester_no = $5
                where id = $6
                returning id
                `,
                [
                    this.#values.parseId(body.programId, "Ngành"),
                    this.#values.parseId(body.subjectId, "Môn học"),
                    this.#values.parseInteger(
                        body.semesterNo,
                        "Học kỳ",
                        1,
                        20,
                    ),
                    this.#values.parseTermType(body.termType),
                    body.termType === "supplementary"
                        ? this.#values.parseInteger(
                              body.referenceSemesterNo,
                              "Học kỳ bổ sung cho",
                              1,
                              20,
                          )
                        : null,
                    id,
                ],
            );
            if (!result.rows[0]) {
                throw this.#http.createError(
                    404,
                    "Không tìm thấy môn trong chương trình.",
                );
            }
            return result.rows[0];
        });
        res.json(data);
    }

    async #delete(req, res) {
        const id = this.#values.parseId(
            req.params.programSubjectId,
            "Môn trong chương trình",
        );
        const data = await this.#db.withAppContext(req, async (client) => {
            const result = await client.query(
                `
                delete from public.program_subjects
                where id = $1
                  and not exists (
                      select 1
                      from public.class_subjects
                      where program_subject_id = $1
                  )
                returning id
                `,
                [id],
            );
            if (!result.rows[0]) {
                throw this.#http.createError(
                    400,
                    "Không thể xóa môn đã được đồng bộ vào lớp.",
                );
            }
            return result.rows[0];
        });
        res.json(data);
    }
}
