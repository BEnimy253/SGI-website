export class ClassSubjects {
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
        app.put(
            this.#route.managementClassSubject,
            this.#route.requireRole("admin", "academic_executor"),
            this.#route.asyncRoute(async (req, res) => {
                const classSubjectId = this.#values.parseId(
                    req.params.classSubjectId,
                    "Lớp - môn",
                );
                const body = req.body;
                const data = await this.#db.withAppContext(req, async (client) => {
                    const teacherId = this.#values.parseOptionalId(
                        body.teacherId,
                        "Mã giáo viên",
                    );
                    const status = this.#values.parseCourseStatus(body.status);

                    if (status === "open" && !teacherId) {
                        throw this.#http.createError(
                            400,
                            "Cần chọn giáo viên khi mở lớp-môn.",
                        );
                    }

                    const openedAt =
                        status === "open"
                            ? this.#values.optionalDate(body.openedAt) ??
                              new Date().toISOString().slice(0, 10)
                            : null;
                    const closedAt =
                        status === "closed"
                            ? this.#values.optionalDate(body.closedAt) ??
                              new Date().toISOString().slice(0, 10)
                            : null;

                    const result = await client.query(
                        `
                        update public.class_subjects
                        set
                            teacher_id = $1,
                            status = $2,
                            opened_at = $3,
                            closed_at = $4,
                            note = $5
                        where id = $6
                        returning id
                        `,
                        [
                            teacherId,
                            status,
                            openedAt,
                            closedAt,
                            this.#values.optionalText(body.note),
                            classSubjectId,
                        ],
                    );

                    if (!result.rows[0]) {
                        throw this.#http.createError(
                            404,
                            "Không tìm thấy lớp-môn cần phân công.",
                        );
                    }

                    return result.rows[0];
                });

                res.json(data);
            }),
        );
    }
}
