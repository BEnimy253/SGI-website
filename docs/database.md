# Database

## Tổng quan

Database là PostgreSQL, được truy cập bằng `pg.Pool`. Source nhắc đến Supabase trong comment/schema grants, nhưng ứng dụng hiện kết nối bằng PostgreSQL connection string.

## Enum

| Enum | Giá trị |
|---|---|
| `account_role` | `admin`, `academic_executor`, `teacher`, `student` |
| `account_status` | `active`, `block` |
| `gender_type` | `male`, `female`, `other` |
| `contract_type` | `permanent`, `visiting` |
| `term_type` | `regular`, `supplementary` |
| `course_status` | `planned`, `open`, `closed` |
| `attendance_status` | `present`, `absent`, `excused`, `late` |
| `learning_status` | `studying`, `repeat_course`, `retake_exam`, `passed` |

## Bảng

| Bảng | Mục đích |
|---|---|
| `accounts` | Username, hash, role, status |
| `people` | Hồ sơ cá nhân dùng chung |
| `academic_executors` | Profile giáo vụ |
| `teachers` | Profile giáo viên và loại hợp đồng |
| `academic_programs` | Chương trình đào tạo |
| `classes` | Lớp thuộc chương trình |
| `students` | Profile học sinh, lớp, kỳ và học phí |
| `subjects` | Môn, số tiết, tín chỉ, số buổi |
| `program_subjects` | Môn trong curriculum theo kỳ |
| `class_subjects` | Môn đã đồng bộ vào lớp và phân công |
| `student_scores` | Điểm và trạng thái học tập |
| `course_sessions` | Buổi học, ngày và số tiết |
| `attendance` | Điểm danh theo score/session |
| `tuition_payments` | Giao dịch học phí; chưa có controller |

## Quan hệ chính

```text
accounts ── people
   ├── academic_executors
   ├── teachers
   └── students ── classes ── academic_programs
                         └── class_subjects ── program_subjects ── subjects
students ── student_scores ── class_subjects
student_scores ── attendance ── course_sessions
```

## View

- `account_details_view`: account + person.
- `teacher_assigned_classes_view`: lớp–môn và giáo viên.
- `student_score_details_view`: score đã ghép học sinh/lớp/môn.
- `gradebook_attendance_view`: điểm danh theo lớp–môn.

## Function và trigger quan trọng

- `touch_updated_at`: cập nhật timestamp.
- `validate_person_account`, `validate_role_profile`: kiểm tra profile đúng role.
- `students_set_class_defaults`: lấy khóa, năm, tổng kỳ từ lớp.
- `validate_program_subject`, `class_subject_set_curriculum`: bảo vệ curriculum.
- `sync_student_scores_*`: đồng bộ bảng điểm.
- `sync_course_sessions_*`: sinh số buổi từ `planned_sessions`.
- `*_sync_attendance`: sinh attendance.
- `guard_score_update`, `guard_attendance_update`, `guard_course_session_update`: kiểm tra actor/quyền.
- `refresh_student_score`: tính điểm và trạng thái.
- `sync_class_curriculum`: đồng bộ chương trình vào lớp.

## Công thức

- `planned_sessions = (total_periods + 4) / 5`.
- Môn dưới 4 tín chỉ: `(KTTX1 + KTĐK1 × 2) / 3`.
- Môn từ 4 tín chỉ: `(KTTX1 + KTTX2 + KTĐK1 × 2) / 4`.
- Điểm cuối: `điểm quá trình × 0.4 + KTM1 × 0.6`.
- `outstanding_debt = max(current_semester - tuition_paid_through_semester, 0) × tuition_per_semester`.

