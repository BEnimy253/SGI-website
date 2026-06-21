begin;

drop view if exists public.gradebook_attendance_view;
drop view if exists public.student_score_details_view;
drop view if exists public.teacher_assigned_classes_view;

create type public.attendance_status_v2 as enum (
    'present',
    'absent',
    'excused',
    'late'
);

alter table public.attendance
    alter column status drop default;

alter table public.attendance
    alter column status type public.attendance_status_v2
    using status::text::public.attendance_status_v2;

drop type public.attendance_status;
alter type public.attendance_status_v2 rename to attendance_status;

alter table public.attendance
    alter column status set default 'present'::public.attendance_status;

alter table public.subjects
    rename column study_hours to total_periods;

alter table public.subjects
    rename constraint subjects_study_hours_check
    to subjects_total_periods_check;

alter table public.course_sessions
    alter column study_date drop not null;

alter table public.course_sessions
    rename column study_hours to lesson_periods;

update public.course_sessions
set lesson_periods = 5;

alter table public.course_sessions
    drop constraint course_sessions_hours_check;

alter table public.course_sessions
    add constraint course_sessions_periods_check
    check (lesson_periods = 5);

alter table public.course_sessions
    drop column topic;

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

drop trigger if exists class_subjects_sync_sessions_trigger
on public.class_subjects;

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

drop trigger if exists subjects_sync_sessions_trigger
on public.subjects;

create trigger subjects_sync_sessions_trigger
after update of total_periods on public.subjects
for each row execute function public.subjects_sync_sessions();

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

drop trigger if exists course_sessions_guard_update_trigger
on public.course_sessions;

create trigger course_sessions_guard_update_trigger
before update of study_date on public.course_sessions
for each row execute function public.guard_course_session_update();

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
                raise exception
                    'Giáo viên không được phân công môn học này.';
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

select public.sync_course_sessions_for_class_subject(id)
from public.class_subjects;

select public.refresh_student_score(id)
from public.student_scores;

commit;
