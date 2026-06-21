export class Route {
    constructor() {
        this.root = "/";
        this.login = "/login";
        this.warningLoginUsername = "/login?error=wrong_username";
        this.warningLoginPassword = "/login?error=wrong_password";
        this.warningLoginStatus = "/login?error=blocked";
        this.dashboard = "/dashboard";
        this.logout = "/logout";
        this.dbTest = "/db-test";
        this.apiMe = "/api/me";
        this.studentInfo = "/api/student-info";
        this.teacherClasses = "/api/teacher/classes";
        this.teacherClassDetail =
            "/api/teacher/classes/:classId/subjects/:subjectId";
        this.teacherScore =
            "/api/teacher/scores/:studentId/:subjectId";
        this.gradebook = "/api/gradebook/:classSubjectId";
        this.gradebookStudent =
            "/api/gradebook/:classSubjectId/students/:studentId";
        this.gradebookSession =
            "/api/gradebook/:classSubjectId/sessions/:sessionId";
        this.gradebookAttendance =
            "/api/gradebook/:classSubjectId/sessions/:sessionId/students/:studentId";
        this.managementOverview = "/api/management/overview";
        this.managementTeachers = "/api/management/teachers";
        this.managementTeacher = "/api/management/teachers/:teacherId";
        this.managementStudents = "/api/management/students";
        this.managementStudent = "/api/management/students/:studentId";
        this.managementPrograms = "/api/management/programs";
        this.managementProgram = "/api/management/programs/:programId";
        this.managementSubjects = "/api/management/subjects";
        this.managementSubject = "/api/management/subjects/:subjectId";
        this.managementProgramSubjects =
            "/api/management/program-subjects";
        this.managementProgramSubject =
            "/api/management/program-subjects/:programSubjectId";
        this.managementClassSubject =
            "/api/management/class-subjects/:classSubjectId";
        this.managementClasses = "/api/management/classes";
        this.managementClass = "/api/management/classes/:classId";
        this.adminAcademicExecutors = "/api/admin/academic-executors";
        this.adminAcademicExecutor =
            "/api/admin/academic-executors/:executorId";
    }

    asyncRoute(handler) {
        return (req, res, next) => {
            Promise.resolve(handler(req, res, next)).catch(next);
        };
    }

    requireLogin = (req, res, next) => {
        if (req.session.userId) {
            next();
            return;
        }

        res.redirect(this.login);
    };

    requireApiLogin = (req, res, next) => {
        if (req.session.userId) {
            next();
            return;
        }

        res.status(401).json({ message: "Vui lòng đăng nhập." });
    };

    requireRole = (...roles) => {
        return (req, res, next) => {
            if (!req.session.userId) {
                res.status(401).json({ message: "Vui lòng đăng nhập." });
                return;
            }

            if (!roles.includes(req.session.role)) {
                res.status(403).json({
                    message:
                        "Bạn không có quyền thực hiện thao tác này.",
                });
                return;
            }

            next();
        };
    };
}
