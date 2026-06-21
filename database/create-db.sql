-- SGI Portal database
-- PostgreSQL / Supabase
-- Running this file removes the previous public schema and creates a new one.

drop schema if exists public cascade;
create schema public;

grant all on schema public to postgres;
grant usage on schema public to anon, authenticated, service_role;

create type public.account_role as enum (
    'admin',
    'academic_executor',
    'teacher',
    'student'
);

create type public.account_status as enum ('active', 'block');
create type public.gender_type as enum ('male', 'female', 'other');
create type public.contract_type as enum ('permanent', 'visiting');
create type public.term_type as enum ('regular', 'supplementary');
create type public.course_status as enum ('planned', 'open', 'closed');
create type public.attendance_status as enum (
    'present',
    'absent',
    'excused',
    'late'
);
create type public.learning_status as enum (
    'studying',
    'repeat_course',
    'retake_exam',
    'passed'
);

create table public.accounts (
    id bigint generated always as identity primary key,
    username varchar(80) not null unique,
    password_hash text not null,
    role public.account_role not null,
    status public.account_status not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.people (
    account_id bigint primary key
        references public.accounts(id) on delete cascade,
    family_name varchar(120) not null,
    given_name varchar(80) not null,
    full_name varchar(220) generated always as (
        trim(family_name || ' ' || given_name)
    ) stored,
    date_of_birth date not null,
    gender public.gender_type not null,
    phone varchar(30),
    email varchar(180),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint people_email_format check (
        email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    )
);

create unique index people_email_unique
    on public.people(lower(email))
    where email is not null;

create table public.academic_executors (
    id bigint generated always as identity primary key,
    account_id bigint not null unique
        references public.accounts(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table public.teachers (
    id bigint generated always as identity primary key,
    account_id bigint not null unique
        references public.accounts(id) on delete cascade,
    contract_type public.contract_type not null,
    created_at timestamptz not null default now()
);

create table public.academic_programs (
    id bigint generated always as identity primary key,
    program_code varchar(30) not null unique,
    program_name varchar(160) not null,
    total_semesters smallint not null,
    tuition_per_semester numeric(14, 2) not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint academic_programs_total_semesters_check
        check (total_semesters between 1 and 20),
    constraint academic_programs_tuition_check
        check (tuition_per_semester >= 0)
);

create table public.classes (
    id bigint generated always as identity primary key,
    class_code varchar(50) not null unique,
    program_id bigint not null
        references public.academic_programs(id) on delete restrict,
    cohort_code varchar(10) not null,
    start_year smallint not null,
    end_year smallint not null,
    total_semesters smallint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint classes_cohort_code_check
        check (cohort_code ~ '^K[0-9]{2}$'),
    constraint classes_year_check
        check (
            start_year between 2000 and 2200
            and end_year between start_year and 2200
        ),
    constraint classes_total_semesters_check
        check (total_semesters between 1 and 20)
);

create table public.students (
    id bigint generated always as identity primary key,
    user_id bigint not null unique
        references public.accounts(id) on delete cascade,
    student_code varchar(40) not null unique,
    class_id bigint not null
        references public.classes(id) on delete restrict,
    cohort_code varchar(10) not null,
    start_year smallint not null,
    end_year smallint not null,
    current_semester smallint not null default 1,
    total_semesters smallint not null,
    tuition_paid_through_semester smallint not null default 0,
    tuition_per_semester numeric(14, 2) not null default 0,
    outstanding_debt numeric(14, 2) generated always as (
        greatest(current_semester - tuition_paid_through_semester, 0)
        * tuition_per_semester
    ) stored,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint students_cohort_code_check
        check (cohort_code ~ '^K[0-9]{2}$'),
    constraint students_year_check
        check (
            start_year between 2000 and 2200
            and end_year between start_year and 2200
        ),
    constraint students_semester_check
        check (
            total_semesters between 1 and 20
            and current_semester between 1 and total_semesters
            and tuition_paid_through_semester between 0 and total_semesters
        ),
    constraint students_tuition_check
        check (tuition_per_semester >= 0)
);

create table public.subjects (
    id bigint generated always as identity primary key,
    subject_code varchar(40) not null unique,
    subject_name varchar(180) not null,
    total_periods smallint not null,
    credits smallint not null,
    planned_sessions smallint generated always as (
        (total_periods + 4) / 5
    ) stored,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint subjects_total_periods_check check (total_periods > 0),
    constraint subjects_credits_check check (credits between 1 and 12)
);

create table public.program_subjects (
    id bigint generated always as identity primary key,
    program_id bigint not null
        references public.academic_programs(id) on delete cascade,
    subject_id bigint not null
        references public.subjects(id) on delete restrict,
    semester_no smallint not null,
    term_type public.term_type not null default 'regular',
    reference_semester_no smallint,
    created_at timestamptz not null default now(),
    constraint program_subjects_semester_check
        check (semester_no between 1 and 20),
    constraint program_subjects_supplementary_check check (
        (
            term_type = 'regular'
            and reference_semester_no is null
        )
        or (
            term_type = 'supplementary'
            and reference_semester_no between 1 and 20
        )
    ),
    unique (program_id, subject_id, semester_no, term_type)
);

create table public.class_subjects (
    id bigint generated always as identity primary key,
    class_id bigint not null
        references public.classes(id) on delete cascade,
    program_subject_id bigint not null
        references public.program_subjects(id) on delete restrict,
    subject_id bigint not null
        references public.subjects(id) on delete restrict,
    semester_no smallint not null,
    term_type public.term_type not null,
    teacher_id bigint
        references public.teachers(id) on delete set null,
    status public.course_status not null default 'planned',
    opened_at date,
    closed_at date,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint class_subjects_dates_check check (
        closed_at is null
        or opened_at is null
        or closed_at >= opened_at
    ),
    unique (class_id, program_subject_id)
);

create table public.student_scores (
    id bigint generated always as identity primary key,
    student_id bigint not null
        references public.students(id) on delete cascade,
    class_subject_id bigint not null
        references public.class_subjects(id) on delete cascade,
    kttx1 numeric(4, 1),
    kttx2 numeric(4, 1),
    ktdk1 numeric(4, 1),
    ktdk2 numeric(4, 1),
    ktm1 numeric(4, 1),
    ktm2 numeric(4, 1),
    process_average numeric(4, 2),
    final_score numeric(4, 2),
    learning_status public.learning_status not null default 'studying',
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_id, class_subject_id),
    constraint student_scores_range_check check (
        (kttx1 is null or kttx1 between 0 and 10)
        and (kttx2 is null or kttx2 between 0 and 10)
        and (ktdk1 is null or ktdk1 between 0 and 10)
        and (ktdk2 is null or ktdk2 between 0 and 10)
        and (ktm1 is null or ktm1 between 0 and 10)
        and (ktm2 is null or ktm2 between 0 and 10)
    )
);

create table public.course_sessions (
    id bigint generated always as identity primary key,
    class_subject_id bigint not null
        references public.class_subjects(id) on delete cascade,
    session_no smallint not null,
    study_date date,
    lesson_periods smallint not null default 5,
    created_at timestamptz not null default now(),
    constraint course_sessions_number_check check (session_no > 0),
    constraint course_sessions_periods_check check (lesson_periods = 5),
    unique (class_subject_id, session_no),
    unique (class_subject_id, study_date)
);

create table public.attendance (
    id bigint generated always as identity primary key,
    session_id bigint not null
        references public.course_sessions(id) on delete cascade,
    student_score_id bigint not null
        references public.student_scores(id) on delete cascade,
    status public.attendance_status not null default 'present',
    note text,
    updated_at timestamptz not null default now(),
    unique (session_id, student_score_id)
);

create table public.tuition_payments (
    id bigint generated always as identity primary key,
    student_id bigint not null
        references public.students(id) on delete cascade,
    semester_no smallint not null,
    amount numeric(14, 2) not null,
    paid_at date not null default current_date,
    note text,
    created_at timestamptz not null default now(),
    constraint tuition_payments_semester_check
        check (semester_no between 1 and 20),
    constraint tuition_payments_amount_check check (amount > 0)
);

create index accounts_role_status_idx
    on public.accounts(role, status);
create index students_class_idx on public.students(class_id);
create index program_subjects_program_semester_idx
    on public.program_subjects(program_id, semester_no, term_type);
create index class_subjects_class_semester_idx
    on public.class_subjects(class_id, semester_no, term_type);
create index class_subjects_teacher_idx
    on public.class_subjects(teacher_id);
create index student_scores_class_subject_idx
    on public.student_scores(class_subject_id);
create index course_sessions_class_subject_idx
    on public.course_sessions(class_subject_id, session_no);
create index attendance_student_score_idx
    on public.attendance(student_score_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger accounts_touch_updated_at
before update on public.accounts
for each row execute function public.touch_updated_at();

create trigger people_touch_updated_at
before update on public.people
for each row execute function public.touch_updated_at();

create trigger academic_programs_touch_updated_at
before update on public.academic_programs
for each row execute function public.touch_updated_at();

create trigger classes_touch_updated_at
before update on public.classes
for each row execute function public.touch_updated_at();

create trigger students_touch_updated_at
before update on public.students
for each row execute function public.touch_updated_at();

create trigger subjects_touch_updated_at
before update on public.subjects
for each row execute function public.touch_updated_at();

create trigger class_subjects_touch_updated_at
before update on public.class_subjects
for each row execute function public.touch_updated_at();

create trigger student_scores_touch_updated_at
before update on public.student_scores
for each row execute function public.touch_updated_at();

create trigger attendance_touch_updated_at
before update on public.attendance
for each row execute function public.touch_updated_at();

create or replace function public.current_account_id()
returns bigint
language sql
stable
as $$
    select nullif(current_setting('app.account_id', true), '')::bigint;
$$;

create or replace function public.current_account_role()
returns public.account_role
language sql
stable
as $$
    select role
    from public.accounts
    where id = public.current_account_id();
$$;

create or replace function public.validate_person_account()
returns trigger
language plpgsql
as $$
declare
    account_role public.account_role;
begin
    select role into account_role
    from public.accounts
    where id = new.account_id;

    if account_role is null then
        raise exception 'Tài khoản không tồn tại.';
    end if;

    if account_role = 'admin' then
        raise exception 'Tài khoản admin không có hồ sơ cá nhân.';
    end if;

    return new;
end;
$$;

create trigger people_validate_account
before insert or update on public.people
for each row execute function public.validate_person_account();

create or replace function public.validate_role_profile()
returns trigger
language plpgsql
as $$
declare
    expected_role public.account_role := tg_argv[0]::public.account_role;
    actual_role public.account_role;
begin
    select role into actual_role
    from public.accounts
    where id = new.account_id;

    if actual_role is distinct from expected_role then
        raise exception 'Vai trò tài khoản phải là %.', expected_role;
    end if;

    if not exists (
        select 1
        from public.people
        where account_id = new.account_id
    ) then
        raise exception 'Tài khoản phải có hồ sơ cá nhân trước.';
    end if;

    return new;
end;
$$;

create trigger academic_executors_validate_role
before insert or update on public.academic_executors
for each row execute function public.validate_role_profile('academic_executor');

create trigger teachers_validate_role
before insert or update on public.teachers
for each row execute function public.validate_role_profile('teacher');

create or replace function public.students_set_class_defaults()
returns trigger
language plpgsql
as $$
declare
    account_role public.account_role;
    class_row record;
begin
    select role into account_role
    from public.accounts
    where id = new.user_id;

    if account_role is distinct from 'student' then
        raise exception 'Vai trò tài khoản phải là student.';
    end if;

    if not exists (
        select 1
        from public.people
        where account_id = new.user_id
    ) then
        raise exception 'Tài khoản học sinh phải có hồ sơ cá nhân.';
    end if;

    select
        c.cohort_code,
        c.start_year,
        c.end_year,
        c.total_semesters,
        p.tuition_per_semester
    into class_row
    from public.classes c
    join public.academic_programs p on p.id = c.program_id
    where c.id = new.class_id;

    if class_row is null then
        raise exception 'Lớp không tồn tại.';
    end if;

    new.cohort_code := class_row.cohort_code;
    new.start_year := class_row.start_year;
    new.end_year := class_row.end_year;
    new.total_semesters := class_row.total_semesters;

    if new.tuition_per_semester = 0 then
        new.tuition_per_semester := class_row.tuition_per_semester;
    end if;

    return new;
end;
$$;

create trigger students_set_class_defaults_trigger
before insert or update of user_id, class_id on public.students
for each row execute function public.students_set_class_defaults();

create or replace function public.validate_program_subject()
returns trigger
language plpgsql
as $$
declare
    max_semesters smallint;
begin
    select total_semesters into max_semesters
    from public.academic_programs
    where id = new.program_id;

    if new.semester_no > max_semesters then
        raise exception 'Học kỳ vượt quá tổng số học kỳ của ngành.';
    end if;

    if new.reference_semester_no is not null
       and new.reference_semester_no > max_semesters then
        raise exception 'Học kỳ tham chiếu không hợp lệ.';
    end if;

    return new;
end;
$$;

create trigger program_subjects_validate_trigger
before insert or update on public.program_subjects
for each row execute function public.validate_program_subject();

create or replace function public.class_subject_set_curriculum()
returns trigger
language plpgsql
as $$
declare
    curriculum record;
    class_program_id bigint;
begin
    select
        ps.program_id,
        ps.subject_id,
        ps.semester_no,
        ps.term_type
    into curriculum
    from public.program_subjects ps
    where ps.id = new.program_subject_id;

    select program_id into class_program_id
    from public.classes
    where id = new.class_id;

    if curriculum.program_id is distinct from class_program_id then
        raise exception 'Môn học không thuộc ngành của lớp.';
    end if;

    new.subject_id := curriculum.subject_id;
    new.semester_no := curriculum.semester_no;
    new.term_type := curriculum.term_type;

    if new.status = 'open' then
        new.opened_at := coalesce(new.opened_at, current_date);
        new.closed_at := null;
    elsif new.status = 'closed' then
        new.closed_at := coalesce(new.closed_at, current_date);
    end if;

    return new;
end;
$$;

create trigger class_subjects_set_curriculum_trigger
before insert or update of program_subject_id, class_id, status
on public.class_subjects
for each row execute function public.class_subject_set_curriculum();

create or replace function public.sync_student_scores_for_student(
    target_student_id bigint
)
returns void
language sql
as $$
    insert into public.student_scores (student_id, class_subject_id)
    select s.id, cs.id
    from public.students s
    join public.class_subjects cs on cs.class_id = s.class_id
    where s.id = target_student_id
    on conflict (student_id, class_subject_id) do nothing;
$$;

create or replace function public.sync_student_scores_for_class_subject(
    target_class_subject_id bigint
)
returns void
language sql
as $$
    insert into public.student_scores (student_id, class_subject_id)
    select s.id, cs.id
    from public.class_subjects cs
    join public.students s on s.class_id = cs.class_id
    where cs.id = target_class_subject_id
    on conflict (student_id, class_subject_id) do nothing;
$$;

create or replace function public.students_sync_scores()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'UPDATE' and old.class_id is distinct from new.class_id then
        delete from public.student_scores ss
        using public.class_subjects cs
        where ss.student_id = new.id
          and ss.class_subject_id = cs.id
          and cs.class_id <> new.class_id;
    end if;

    perform public.sync_student_scores_for_student(new.id);
    return new;
end;
$$;

create trigger students_sync_scores_trigger
after insert or update of class_id on public.students
for each row execute function public.students_sync_scores();

create or replace function public.class_subjects_sync_scores()
returns trigger
language plpgsql
as $$
begin
    perform public.sync_student_scores_for_class_subject(new.id);
    return new;
end;
$$;

create trigger class_subjects_sync_scores_trigger
after insert on public.class_subjects
for each row execute function public.class_subjects_sync_scores();

create or replace function public.sync_course_sessions_for_class_subject(
    target_class_subject_id bigint
)
returns void
language plpgsql
as $$
declare
    total_sessions smallint;
begin
    select s.planned_sessions
    into total_sessions
    from public.class_subjects cs
    join public.subjects s on s.id = cs.subject_id
    where cs.id = target_class_subject_id;

    if total_sessions is null then
        return;
    end if;

    delete from public.course_sessions
    where class_subject_id = target_class_subject_id
      and session_no > total_sessions;

    insert into public.course_sessions (
        class_subject_id,
        session_no,
        lesson_periods
    )
    select
        target_class_subject_id,
        generated_session_no,
        5
    from generate_series(1, total_sessions) as generated_session_no
    on conflict (class_subject_id, session_no) do nothing;
end;
$$;

create or replace function public.class_subjects_sync_sessions()
returns trigger
language plpgsql
as $$
begin
    perform public.sync_course_sessions_for_class_subject(new.id);
    return new;
end;
$$;

create trigger class_subjects_sync_sessions_trigger
after insert on public.class_subjects
for each row execute function public.class_subjects_sync_sessions();

create or replace function public.subjects_sync_sessions()
returns trigger
language plpgsql
as $$
declare
    target_class_subject_id bigint;
begin
    for target_class_subject_id in
        select id
        from public.class_subjects
        where subject_id = new.id
    loop
        perform public.sync_course_sessions_for_class_subject(
            target_class_subject_id
        );
    end loop;

    return new;
end;
$$;

create trigger subjects_sync_sessions_trigger
after update of total_periods on public.subjects
for each row execute function public.subjects_sync_sessions();

create or replace function public.validate_course_session()
returns trigger
language plpgsql
as $$
declare
    maximum_sessions smallint;
begin
    select s.planned_sessions into maximum_sessions
    from public.class_subjects cs
    join public.subjects s on s.id = cs.subject_id
    where cs.id = new.class_subject_id;

    if new.session_no > maximum_sessions then
        raise exception
            'Môn học chỉ có tối đa % buổi học.',
            maximum_sessions;
    end if;

    return new;
end;
$$;

create trigger course_sessions_validate_trigger
before insert or update on public.course_sessions
for each row execute function public.validate_course_session();

create or replace function public.guard_course_session_update()
returns trigger
language plpgsql
as $$
declare
    assigned_teacher_id bigint;
    actor_role public.account_role;
    actor_teacher_id bigint;
begin
    if new.study_date is not distinct from old.study_date then
        return new;
    end if;

    select teacher_id
    into assigned_teacher_id
    from public.class_subjects
    where id = new.class_subject_id;

    actor_role := public.current_account_role();

    if actor_role is null then
        return new;
    end if;

    if actor_role not in ('admin', 'academic_executor', 'teacher') then
        raise exception
            'Tài khoản không có quyền cập nhật ngày học.';
    end if;

    if actor_role = 'teacher' then
        select id
        into actor_teacher_id
        from public.teachers
        where account_id = public.current_account_id();

        if actor_teacher_id is distinct from assigned_teacher_id then
            raise exception
                'Giáo viên không được phân công môn học này.';
        end if;
    end if;

    return new;
end;
$$;

create trigger course_sessions_guard_update_trigger
before update of study_date on public.course_sessions
for each row execute function public.guard_course_session_update();

create or replace function public.course_sessions_sync_attendance()
returns trigger
language plpgsql
as $$
begin
    insert into public.attendance (session_id, student_score_id)
    select new.id, ss.id
    from public.student_scores ss
    where ss.class_subject_id = new.class_subject_id
    on conflict (session_id, student_score_id) do nothing;

    return new;
end;
$$;

create trigger course_sessions_sync_attendance_trigger
after insert on public.course_sessions
for each row execute function public.course_sessions_sync_attendance();

create or replace function public.student_scores_sync_attendance()
returns trigger
language plpgsql
as $$
begin
    insert into public.attendance (session_id, student_score_id)
    select cs.id, new.id
    from public.course_sessions cs
    where cs.class_subject_id = new.class_subject_id
    on conflict (session_id, student_score_id) do nothing;

    return new;
end;
$$;

create trigger student_scores_sync_attendance_trigger
after insert on public.student_scores
for each row execute function public.student_scores_sync_attendance();

create or replace function public.guard_score_update()
returns trigger
language plpgsql
as $$
declare
    subject_credits smallint;
    course_state public.course_status;
    assigned_teacher_id bigint;
    actor_role public.account_role;
    actor_teacher_id bigint;
begin
    if row(
        old.kttx1,
        old.kttx2,
        old.ktdk1,
        old.ktdk2,
        old.ktm1,
        old.ktm2
    ) is not distinct from row(
        new.kttx1,
        new.kttx2,
        new.ktdk1,
        new.ktdk2,
        new.ktm1,
        new.ktm2
    ) then
        return new;
    end if;

    select
        s.credits,
        cs.status,
        cs.teacher_id
    into subject_credits, course_state, assigned_teacher_id
    from public.class_subjects cs
    join public.subjects s on s.id = cs.subject_id
    where cs.id = new.class_subject_id;

    actor_role := public.current_account_role();

    if actor_role is not null then
        if actor_role not in ('admin', 'academic_executor', 'teacher') then
            raise exception 'Tài khoản không có quyền cập nhật điểm.';
        end if;

        if course_state <> 'open' then
            raise exception 'Môn học chưa mở hoặc đã đóng.';
        end if;

        if actor_role = 'teacher' then
            select id into actor_teacher_id
            from public.teachers
            where account_id = public.current_account_id();

            if actor_teacher_id is distinct from assigned_teacher_id then
                raise exception 'Giáo viên không được phân công môn học này.';
            end if;
        end if;
    end if;

    if subject_credits < 4 then
        if new.kttx2 is not null or new.ktdk2 is not null then
            raise exception
                'Môn dưới 4 tín chỉ chỉ sử dụng KTTX1, KTĐK1 và KTM1.';
        end if;
    else
        if new.ktdk2 is not null then
            raise exception
                'Môn từ 4 tín chỉ sử dụng KTTX1, KTTX2, KTĐK1 và KTM1.';
        end if;
    end if;

    if new.ktm2 is distinct from old.ktm2 then
        raise exception
            'KTM2 được giữ theo biểu mẫu nhưng hiện không cho phép cập nhật.';
    end if;

    return new;
end;
$$;

create trigger student_scores_guard_update_trigger
before update on public.student_scores
for each row execute function public.guard_score_update();

create or replace function public.guard_attendance_update()
returns trigger
language plpgsql
as $$
declare
    course_state public.course_status;
    assigned_teacher_id bigint;
    actor_role public.account_role;
    actor_teacher_id bigint;
begin
    select cs.status, cs.teacher_id
    into course_state, assigned_teacher_id
    from public.student_scores ss
    join public.class_subjects cs on cs.id = ss.class_subject_id
    where ss.id = new.student_score_id;

    actor_role := public.current_account_role();

    if actor_role is null then
        return new;
    end if;

    if actor_role not in ('admin', 'academic_executor', 'teacher') then
        raise exception 'Tài khoản không có quyền cập nhật điểm danh.';
    end if;

    if course_state <> 'open' then
        raise exception 'Môn học chưa mở hoặc đã đóng.';
    end if;

    if actor_role = 'teacher' then
        select id into actor_teacher_id
        from public.teachers
        where account_id = public.current_account_id();

        if actor_teacher_id is distinct from assigned_teacher_id then
            raise exception 'Giáo viên không được phân công môn học này.';
        end if;
    end if;

    return new;
end;
$$;

create trigger attendance_guard_update_trigger
before update on public.attendance
for each row execute function public.guard_attendance_update();

create or replace function public.refresh_student_score(
    target_score_id bigint
)
returns void
language plpgsql
as $$
declare
    score_row record;
    process_score numeric(4, 2);
    calculated_final numeric(4, 2);
    calculated_status public.learning_status;
    absent_count integer;
begin
    select
        ss.*,
        s.credits,
        s.planned_sessions,
        cs.status as course_status
    into score_row
    from public.student_scores ss
    join public.class_subjects cs on cs.id = ss.class_subject_id
    join public.subjects s on s.id = cs.subject_id
    where ss.id = target_score_id;

    if score_row.credits < 4 then
        if score_row.kttx1 is not null
           and score_row.ktdk1 is not null then
            process_score := round(
                (score_row.kttx1 + score_row.ktdk1 * 2) / 3,
                2
            );
        end if;
    elsif score_row.kttx1 is not null
          and score_row.kttx2 is not null
          and score_row.ktdk1 is not null then
        process_score := round(
            (
                score_row.kttx1
                + score_row.kttx2
                + score_row.ktdk1 * 2
            ) / 4,
            2
        );
    end if;

    select count(*)::integer into absent_count
    from public.attendance
    where student_score_id = target_score_id
      and status in ('absent', 'excused');

    if process_score is not null and score_row.ktm1 is not null then
        calculated_final := round(
            process_score * 0.4 + score_row.ktm1 * 0.6,
            2
        );
    end if;

    if score_row.planned_sessions > 0
       and absent_count::numeric / score_row.planned_sessions > 0.2 then
        calculated_status := 'repeat_course';
    elsif process_score is not null and process_score < 5 then
        calculated_status := 'repeat_course';
    elsif score_row.ktm1 is not null then
        calculated_status :=
            case
                when score_row.ktm1 >= 5 then 'passed'
                else 'retake_exam'
            end;
    else
        calculated_status := 'studying';
    end if;

    update public.student_scores
    set
        process_average = process_score,
        final_score = calculated_final,
        learning_status = calculated_status
    where id = target_score_id;
end;
$$;

create or replace function public.student_scores_refresh_after_change()
returns trigger
language plpgsql
as $$
begin
    perform public.refresh_student_score(new.id);
    return new;
end;
$$;

create trigger student_scores_refresh_after_change_trigger
after insert or update of kttx1, kttx2, ktdk1, ktdk2, ktm1, ktm2
on public.student_scores
for each row execute function public.student_scores_refresh_after_change();

create or replace function public.attendance_refresh_score()
returns trigger
language plpgsql
as $$
begin
    perform public.refresh_student_score(
        coalesce(new.student_score_id, old.student_score_id)
    );

    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;
end;
$$;

create trigger attendance_refresh_score_trigger
after insert or update or delete on public.attendance
for each row execute function public.attendance_refresh_score();

create or replace function public.class_subject_refresh_scores()
returns trigger
language plpgsql
as $$
declare
    score_id bigint;
begin
    for score_id in
        select id
        from public.student_scores
        where class_subject_id = new.id
    loop
        perform public.refresh_student_score(score_id);
    end loop;

    return new;
end;
$$;

create trigger class_subject_refresh_scores_trigger
after update of status on public.class_subjects
for each row execute function public.class_subject_refresh_scores();

create or replace function public.sync_class_curriculum(
    target_class_id bigint
)
returns integer
language plpgsql
as $$
declare
    inserted_count integer;
begin
    insert into public.class_subjects (
        class_id,
        program_subject_id,
        subject_id,
        semester_no,
        term_type
    )
    select
        c.id,
        ps.id,
        ps.subject_id,
        ps.semester_no,
        ps.term_type
    from public.classes c
    join public.program_subjects ps
        on ps.program_id = c.program_id
    where c.id = target_class_id
    on conflict (class_id, program_subject_id) do nothing;

    get diagnostics inserted_count = row_count;
    return inserted_count;
end;
$$;

create or replace view public.account_details_view as
select
    a.id,
    a.username,
    a.role,
    a.status,
    a.created_at,
    p.family_name,
    p.given_name,
    p.full_name,
    to_char(p.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
    p.gender,
    p.phone,
    p.email
from public.accounts a
left join public.people p on p.account_id = a.id;

create or replace view public.teacher_assigned_classes_view as
select
    cs.id as class_subject_id,
    cs.teacher_id,
    p.full_name as teacher_name,
    t.contract_type,
    c.id as class_id,
    c.class_code,
    c.cohort_code,
    c.start_year,
    c.end_year,
    ap.id as program_id,
    ap.program_code,
    ap.program_name,
    cs.semester_no,
    cs.term_type,
    s.id as subject_id,
    s.subject_code,
    s.subject_name,
    s.total_periods,
    s.credits,
    s.planned_sessions,
    cs.status as class_subject_status,
    to_char(cs.opened_at, 'YYYY-MM-DD') as opened_at,
    to_char(cs.closed_at, 'YYYY-MM-DD') as closed_at
from public.class_subjects cs
join public.classes c on c.id = cs.class_id
join public.academic_programs ap on ap.id = c.program_id
join public.subjects s on s.id = cs.subject_id
left join public.teachers t on t.id = cs.teacher_id
left join public.people p on p.account_id = t.account_id;

create or replace view public.student_score_details_view as
select
    ss.id as student_score_id,
    st.id as student_id,
    st.student_code,
    p.family_name,
    p.given_name,
    p.full_name as student_name,
    to_char(p.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
    p.gender,
    c.id as class_id,
    c.class_code,
    c.cohort_code,
    c.start_year,
    c.end_year,
    ap.id as program_id,
    ap.program_code,
    ap.program_name,
    cs.id as class_subject_id,
    cs.semester_no,
    cs.term_type,
    cs.status as class_subject_status,
    s.id as subject_id,
    s.subject_code,
    s.subject_name,
    s.total_periods,
    s.credits,
    s.planned_sessions,
    ss.kttx1,
    ss.kttx2,
    ss.ktdk1,
    ss.ktdk2,
    ss.ktm1,
    ss.ktm2,
    ss.process_average,
    ss.final_score,
    ss.learning_status,
    ss.note,
    (
        select count(*)::integer
        from public.attendance a
        where a.student_score_id = ss.id
          and a.status in ('absent', 'excused')
    ) as absent_sessions,
    true as kttx1_editable,
    (s.credits >= 4) as kttx2_editable,
    true as ktdk1_editable,
    false as ktdk2_editable,
    true as ktm1_editable,
    false as ktm2_editable
from public.student_scores ss
join public.students st on st.id = ss.student_id
join public.people p on p.account_id = st.user_id
join public.class_subjects cs on cs.id = ss.class_subject_id
join public.classes c on c.id = cs.class_id
join public.academic_programs ap on ap.id = c.program_id
join public.subjects s on s.id = cs.subject_id;

create or replace view public.gradebook_attendance_view as
select
    cs.id as class_subject_id,
    ses.id as session_id,
    ses.session_no,
    ses.study_date,
    ses.lesson_periods,
    ss.student_id,
    a.id as attendance_id,
    a.status,
    a.note
from public.course_sessions ses
join public.class_subjects cs on cs.id = ses.class_subject_id
join public.attendance a on a.session_id = ses.id
join public.student_scores ss on ss.id = a.student_score_id;

-- Seed data

insert into public.accounts (username, password_hash, role, status)
values
    (
        'admin001',
        '$2b$12$BkzB.qrqbdcAQVAwjSYq.e6/YLo/FBvvY.cRXeGxNlC9XEZTd8jua',
        'admin',
        'active'
    ),
    (
        'academic001',
        '$2b$12$BkzB.qrqbdcAQVAwjSYq.e6/YLo/FBvvY.cRXeGxNlC9XEZTd8jua',
        'academic_executor',
        'active'
    ),
    (
        'teacher001',
        '$2b$12$BkzB.qrqbdcAQVAwjSYq.e6/YLo/FBvvY.cRXeGxNlC9XEZTd8jua',
        'teacher',
        'active'
    ),
    (
        'teacher002',
        '$2b$12$BkzB.qrqbdcAQVAwjSYq.e6/YLo/FBvvY.cRXeGxNlC9XEZTd8jua',
        'teacher',
        'active'
    ),
    (
        'student001',
        '$2b$12$BkzB.qrqbdcAQVAwjSYq.e6/YLo/FBvvY.cRXeGxNlC9XEZTd8jua',
        'student',
        'active'
    ),
    (
        'student002',
        '$2b$12$BkzB.qrqbdcAQVAwjSYq.e6/YLo/FBvvY.cRXeGxNlC9XEZTd8jua',
        'student',
        'active'
    ),
    (
        'student003',
        '$2b$12$BkzB.qrqbdcAQVAwjSYq.e6/YLo/FBvvY.cRXeGxNlC9XEZTd8jua',
        'student',
        'active'
    ),
    (
        'student004',
        '$2b$12$BkzB.qrqbdcAQVAwjSYq.e6/YLo/FBvvY.cRXeGxNlC9XEZTd8jua',
        'student',
        'block'
    );

insert into public.people (
    account_id,
    family_name,
    given_name,
    date_of_birth,
    gender,
    phone,
    email
)
select id, 'Nguyễn Hoàng', 'An', date '1993-04-18',
       'female'::public.gender_type,
       '0901000001', 'academic001@sgi.edu.vn'
from public.accounts where username = 'academic001'
union all
select id, 'Trần Minh', 'Quân', date '1988-07-12',
       'male'::public.gender_type,
       '0902000001', 'teacher001@sgi.edu.vn'
from public.accounts where username = 'teacher001'
union all
select id, 'Lê Thị', 'Hương', date '1991-10-03',
       'female'::public.gender_type,
       '0902000002', 'teacher002@sgi.edu.vn'
from public.accounts where username = 'teacher002'
union all
select id, 'Lưu Nguyễn Tường', 'An', date '2008-01-21',
       'male'::public.gender_type,
       '0903000001', 'student001@sgi.edu.vn'
from public.accounts where username = 'student001'
union all
select id, 'Nguyễn Trần Duy', 'Anh', date '2008-05-22',
       'male'::public.gender_type,
       '0903000002', 'student002@sgi.edu.vn'
from public.accounts where username = 'student002'
union all
select id, 'Lê Ngọc Quỳnh', 'Anh', date '2008-09-07',
       'female'::public.gender_type,
       '0903000003', 'student003@sgi.edu.vn'
from public.accounts where username = 'student003'
union all
select id, 'Đặng Lê Minh', 'Bảo', date '2009-10-22',
       'male'::public.gender_type,
       '0903000004', 'student004@sgi.edu.vn'
from public.accounts where username = 'student004';

insert into public.academic_executors (account_id)
select id from public.accounts where username = 'academic001';

insert into public.teachers (account_id, contract_type)
select id, 'permanent'::public.contract_type
from public.accounts where username = 'teacher001'
union all
select id, 'visiting'::public.contract_type
from public.accounts where username = 'teacher002';

insert into public.academic_programs (
    program_code,
    program_name,
    total_semesters,
    tuition_per_semester
)
values
    ('CNTT', 'Công nghệ thông tin', 6, 8500000),
    ('CSSD', 'Chăm sóc sắc đẹp', 4, 9500000);

insert into public.classes (
    class_code,
    program_id,
    cohort_code,
    start_year,
    end_year,
    total_semesters
)
select 'CNTT-K24-A', id, 'K24', 2024, 2027, total_semesters
from public.academic_programs where program_code = 'CNTT'
union all
select 'CSSD-K24-A', id, 'K24', 2024, 2026, total_semesters
from public.academic_programs where program_code = 'CSSD';

insert into public.students (
    user_id,
    student_code,
    class_id,
    cohort_code,
    start_year,
    end_year,
    current_semester,
    total_semesters,
    tuition_paid_through_semester,
    tuition_per_semester
)
select
    a.id,
    'SV24001',
    c.id,
    c.cohort_code,
    c.start_year,
    c.end_year,
    3,
    c.total_semesters,
    3,
    0
from public.accounts a
cross join public.classes c
where a.username = 'student001' and c.class_code = 'CNTT-K24-A'
union all
select
    a.id,
    'SV24002',
    c.id,
    c.cohort_code,
    c.start_year,
    c.end_year,
    3,
    c.total_semesters,
    2,
    0
from public.accounts a
cross join public.classes c
where a.username = 'student002' and c.class_code = 'CNTT-K24-A'
union all
select
    a.id,
    'SV24003',
    c.id,
    c.cohort_code,
    c.start_year,
    c.end_year,
    3,
    c.total_semesters,
    1,
    0
from public.accounts a
cross join public.classes c
where a.username = 'student003' and c.class_code = 'CNTT-K24-A'
union all
select
    a.id,
    'SV24004',
    c.id,
    c.cohort_code,
    c.start_year,
    c.end_year,
    3,
    c.total_semesters,
    3,
    0
from public.accounts a
cross join public.classes c
where a.username = 'student004' and c.class_code = 'CNTT-K24-A';

insert into public.subjects (
    subject_code,
    subject_name,
    total_periods,
    credits
)
values
    ('TINCB', 'Tin học căn bản', 45, 3),
    ('LTCB', 'Lập trình căn bản', 60, 4),
    ('CSDL', 'Cơ sở dữ liệu', 60, 4),
    ('WEB', 'Thiết kế và lập trình Web', 75, 5),
    ('KNGT', 'Kỹ năng giao tiếp', 30, 2),
    ('CSDA', 'Chăm sóc da cơ bản', 45, 3),
    ('TRANGDIEM', 'Trang điểm chuyên nghiệp', 60, 4);

insert into public.program_subjects (
    program_id,
    subject_id,
    semester_no,
    term_type,
    reference_semester_no
)
select p.id, s.id, 1, 'regular'::public.term_type, null::smallint
from public.academic_programs p
join public.subjects s on s.subject_code in ('TINCB', 'KNGT')
where p.program_code = 'CNTT'
union all
select p.id, s.id, 2, 'regular'::public.term_type, null::smallint
from public.academic_programs p
join public.subjects s on s.subject_code in ('LTCB', 'CSDL')
where p.program_code = 'CNTT'
union all
select p.id, s.id, 3, 'regular'::public.term_type, null::smallint
from public.academic_programs p
join public.subjects s on s.subject_code = 'WEB'
where p.program_code = 'CNTT'
union all
select p.id, s.id, 3, 'supplementary'::public.term_type, 3
from public.academic_programs p
join public.subjects s on s.subject_code = 'WEB'
where p.program_code = 'CNTT'
union all
select p.id, s.id, 1, 'regular'::public.term_type, null::smallint
from public.academic_programs p
join public.subjects s on s.subject_code in ('KNGT', 'CSDA')
where p.program_code = 'CSSD'
union all
select p.id, s.id, 2, 'regular'::public.term_type, null::smallint
from public.academic_programs p
join public.subjects s on s.subject_code = 'TRANGDIEM'
where p.program_code = 'CSSD';

select public.sync_class_curriculum(id)
from public.classes;

update public.class_subjects cs
set
    teacher_id = (
        select t.id
        from public.teachers t
        join public.accounts a on a.id = t.account_id
        where a.username = 'teacher001'
    ),
    status = 'open',
    opened_at = date '2026-05-21'
from public.classes c, public.subjects s
where cs.class_id = c.id
  and cs.subject_id = s.id
  and c.class_code = 'CNTT-K24-A'
  and s.subject_code = 'WEB'
  and cs.term_type = 'regular';

update public.class_subjects cs
set
    teacher_id = (
        select t.id
        from public.teachers t
        join public.accounts a on a.id = t.account_id
        where a.username = 'teacher002'
    ),
    status = 'open',
    opened_at = date '2026-05-20'
from public.classes c, public.subjects s
where cs.class_id = c.id
  and cs.subject_id = s.id
  and c.class_code = 'CNTT-K24-A'
  and s.subject_code = 'CSDL';

update public.course_sessions ses
set study_date = schedule.study_date
from public.class_subjects cs
join public.classes c on c.id = cs.class_id
join public.subjects s on s.id = cs.subject_id
cross join (
    values
        (1, date '2026-05-21'),
        (2, date '2026-05-22'),
        (3, date '2026-05-23'),
        (4, date '2026-05-28'),
        (5, date '2026-05-29'),
        (6, date '2026-06-04'),
        (7, date '2026-06-05')
) as schedule(session_no, study_date)
where ses.class_subject_id = cs.id
  and ses.session_no = schedule.session_no
  and c.class_code = 'CNTT-K24-A'
  and s.subject_code = 'WEB'
  and cs.term_type = 'regular';

update public.attendance a
set status = 'absent'
from public.course_sessions ses,
     public.student_scores ss,
     public.students st
where a.session_id = ses.id
  and a.student_score_id = ss.id
  and ss.student_id = st.id
  and st.student_code = 'SV24001'
  and ses.session_no in (1, 2, 3, 4);

update public.attendance a
set status = 'absent'
from public.course_sessions ses,
     public.student_scores ss,
     public.students st
where a.session_id = ses.id
  and a.student_score_id = ss.id
  and ss.student_id = st.id
  and st.student_code = 'SV24003'
  and ses.session_no in (2, 5);

update public.student_scores ss
set
    kttx1 = 6.9,
    kttx2 = 7.5,
    ktdk1 = 8.0,
    ktm1 = 4.0,
    note = 'Đủ điều kiện thi lại'
from public.students st,
     public.class_subjects cs,
     public.subjects s
where ss.student_id = st.id
  and ss.class_subject_id = cs.id
  and cs.subject_id = s.id
  and st.student_code = 'SV24002'
  and s.subject_code = 'WEB'
  and cs.term_type = 'regular';

update public.student_scores ss
set
    kttx1 = 8.5,
    kttx2 = 8.0,
    ktdk1 = 7.5,
    ktm1 = 8.0
from public.students st,
     public.class_subjects cs,
     public.subjects s
where ss.student_id = st.id
  and ss.class_subject_id = cs.id
  and cs.subject_id = s.id
  and st.student_code = 'SV24003'
  and s.subject_code = 'WEB'
  and cs.term_type = 'regular';

insert into public.tuition_payments (
    student_id,
    semester_no,
    amount,
    paid_at,
    note
)
select id, 3, tuition_per_semester, date '2026-01-10', 'Đã đóng đủ học kỳ 3'
from public.students
where student_code = 'SV24001';

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant execute on all functions in schema public to postgres, service_role;

alter default privileges in schema public
grant all on tables to postgres, service_role;
alter default privileges in schema public
grant all on sequences to postgres, service_role;
alter default privileges in schema public
grant execute on functions to postgres, service_role;
