import bcrypt from "bcryptjs";

import { CurrentAccount } from "../account/current-account.js";
import { GradebookApi } from "../gradebook/gradebook-api.js";
import { AcademicExecutors } from "../management/academic-executors.js";
import { Classes } from "../management/classes.js";
import { ClassSubjects } from "../management/class-subjects.js";
import { ManagementOverview } from "../management/management-overview.js";
import { Programs } from "../management/programs.js";
import { ProgramSubjects } from "../management/program-subjects.js";
import { Students } from "../management/students.js";
import { Subjects } from "../management/subjects.js";
import { Teachers } from "../management/teachers.js";
import { StudentApi } from "../student/student-api.js";
import { TeacherApi } from "../teacher/teacher-api.js";

export class User {
    #db;
    #modules;
    #route;

    constructor(dependencies) {
        this.#db = dependencies.db;
        this.#route = dependencies.route;
        this.#modules = [
            new CurrentAccount(dependencies),
            new GradebookApi(dependencies),
            new Admin(dependencies),
            new AcademicExecutor(dependencies),
            new Teacher(dependencies),
            new Student(dependencies),
        ];
    }

    register(app) {
        this.#modules.forEach((module) => module.register(app));
        this.#registerLogin(app);
        this.#registerLogout(app);
    }

    #registerLogin(app) {
        app.post(
            this.#route.login,
            this.#route.asyncRoute(async (req, res) => {
                const { username, password } = req.body;
                const result = await this.#db.getPool().query(
                    `
                    select id, password_hash, role, status
                    from public.accounts
                    where username = $1
                    limit 1
                    `,
                    [username],
                );
                const user = result.rows[0];

                if (!user) {
                    res.redirect(this.#route.warningLoginUsername);
                    return;
                }

                const passwordMatches = await bcrypt.compare(
                    password,
                    user.password_hash,
                );

                if (!passwordMatches) {
                    res.redirect(this.#route.warningLoginPassword);
                    return;
                }

                if (user.status !== "active") {
                    res.redirect(this.#route.warningLoginStatus);
                    return;
                }

                req.session.userId = user.id;
                req.session.role = user.role;
                res.redirect(this.#route.dashboard);
            }),
        );
    }

    #registerLogout(app) {
        app.post(this.#route.logout, (req, res) => {
            req.session.destroy(() => {
                res.clearCookie("connect.sid");
                res.redirect(this.#route.login);
            });
        });
    }
}

class Admin {
    #modules;

    constructor(dependencies) {
        this.#modules = [
            new AcademicExecutors(dependencies),
            new Programs(dependencies),
            new ProgramSubjects(dependencies),
            new Subjects(dependencies),
            new Classes(dependencies),
        ];
    }

    register(app) {
        this.#modules.forEach((module) => module.register(app));
    }
}

class AcademicExecutor {
    #modules;

    constructor(dependencies) {
        this.#modules = [
            new ManagementOverview(dependencies),
            new Teachers(dependencies),
            new Students(dependencies),
            new ClassSubjects(dependencies),
        ];
    }

    register(app) {
        this.#modules.forEach((module) => module.register(app));
    }
}

class Teacher {
    #api;

    constructor(dependencies) {
        this.#api = new TeacherApi(dependencies);
    }

    register(app) {
        this.#api.register(app);
    }
}

class Student {
    #api;

    constructor(dependencies) {
        this.#api = new StudentApi(dependencies);
    }

    register(app) {
        this.#api.register(app);
    }
}
