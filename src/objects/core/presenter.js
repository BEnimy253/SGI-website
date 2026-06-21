const ROLE_LABELS = {
    admin: "Admin",
    academic_executor: "Giáo vụ",
    teacher: "Giáo viên",
    student: "Học sinh",
};

export class Presenter {
    mapAccount(row) {
        return {
            id: row.id,
            username: row.username,
            role: row.role,
            roleLabel: ROLE_LABELS[row.role] ?? row.role,
            status: row.status,
            createdAt: row.created_at,
        };
    }

    mapPerson(row) {
        if (!row || !row.full_name) {
            return null;
        }
        return {
            familyName: row.family_name,
            givenName: row.given_name,
            fullName: row.full_name,
            dateOfBirth: row.date_of_birth,
            gender: row.gender,
            phone: row.phone,
            email: row.email,
        };
    }

    mapScore(row) {
        return {
            studentScoreId: row.student_score_id,
            studentId: row.student_id,
            studentCode: row.student_code,
            familyName: row.family_name,
            givenName: row.given_name,
            studentName: row.student_name,
            dateOfBirth: row.date_of_birth,
            classSubjectId: row.class_subject_id,
            classId: row.class_id,
            classCode: row.class_code,
            cohortCode: row.cohort_code,
            classSubjectStatus: row.class_subject_status,
            programId: row.program_id,
            programCode: row.program_code,
            programName: row.program_name,
            semesterNo: row.semester_no,
            termType: row.term_type,
            subjectId: row.subject_id,
            subjectCode: row.subject_code,
            subjectName: row.subject_name,
            totalPeriods: row.total_periods,
            credits: row.credits,
            plannedSessions: row.planned_sessions,
            kttx1: this.toNumber(row.kttx1),
            kttx2: this.toNumber(row.kttx2),
            ktdk1: this.toNumber(row.ktdk1),
            ktdk2: this.toNumber(row.ktdk2),
            processAverage: this.toNumber(row.process_average),
            ktm1: this.toNumber(row.ktm1),
            ktm2: this.toNumber(row.ktm2),
            finalScore: this.toNumber(row.final_score),
            absentSessions: Number(row.absent_sessions ?? 0),
            learningStatus: row.learning_status,
            note: row.note,
            editable: {
                kttx1: Boolean(row.kttx1_editable),
                kttx2: Boolean(row.kttx2_editable),
                ktdk1: Boolean(row.ktdk1_editable),
                ktdk2: Boolean(row.ktdk2_editable),
                ktm1: Boolean(row.ktm1_editable),
                ktm2: Boolean(row.ktm2_editable),
            },
        };
    }

    toNumber(value) {
        return value === null || value === undefined ? null : Number(value);
    }
}
