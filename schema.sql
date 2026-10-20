-- Ideal English Public School: starter portal schema
-- Run in Supabase Dashboard > SQL Editor. Do not expose service_role keys in browser code.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin','teacher','student','parent')),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  admission_no text unique not null,
  full_name text not null,
  grade text not null,
  section text not null check (section in ('A','B','C')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_user_id uuid not null references public.profiles(id) on delete cascade,
  relationship text default 'Parent/Guardian',
  primary key (student_id, guardian_user_id)
);

create table if not exists public.teacher_assignments (
  teacher_user_id uuid not null references public.profiles(id) on delete cascade,
  grade text not null,
  section text not null check (section in ('A','B','C')),
  subject text not null default 'General',
  primary key (teacher_user_id, grade, section, subject)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null default current_date,
  status text not null check (status in ('present','absent','late','leave')),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(student_id, attendance_date)
);

create table if not exists public.marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject text not null,
  exam_name text not null,
  total_marks numeric(7,2) not null check (total_marks > 0),
  obtained_marks numeric(7,2) not null check (obtained_marks >= 0 and obtained_marks <= total_marks),
  entered_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(student_id, subject, exam_name)
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.teaches_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.students s join public.teacher_assignments ta
  on ta.grade = s.grade and ta.section = s.section
  where s.id = p_student_id and ta.teacher_user_id = auth.uid()
) $$;

create or replace function public.can_view_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_admin()
 or exists(select 1 from public.students s where s.id = p_student_id and s.user_id = auth.uid())
 or exists(select 1 from public.student_guardians sg where sg.student_id = p_student_id and sg.guardian_user_id = auth.uid())
 or public.teaches_student(p_student_id) $$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.attendance enable row level security;
alter table public.marks enable row level security;
alter table public.notices enable row level security;

-- Profiles: users can see their own profile; admins manage all. No public role changes.
create policy "profile self or admin read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "admin manages profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "student rows scoped read" on public.students for select to authenticated using (public.can_view_student(id));
create policy "admin manages students" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "guardians see own links or admin" on public.student_guardians for select to authenticated using (guardian_user_id = auth.uid() or public.is_admin());
create policy "admin manages guardian links" on public.student_guardians for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "teachers see own assignments or admin" on public.teacher_assignments for select to authenticated using (teacher_user_id = auth.uid() or public.is_admin());
create policy "admin manages assignments" on public.teacher_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "attendance scoped read" on public.attendance for select to authenticated using (public.can_view_student(student_id));
create policy "teacher or admin records attendance" on public.attendance for insert to authenticated with check (
  (public.is_admin() or public.teaches_student(student_id)) and recorded_by = auth.uid()
);
create policy "teacher or admin updates attendance" on public.attendance for update to authenticated using (
  public.is_admin() or public.teaches_student(student_id)
) with check (public.is_admin() or (public.teaches_student(student_id) and recorded_by = auth.uid()));
create policy "admin deletes attendance" on public.attendance for delete to authenticated using (public.is_admin());

create policy "marks scoped read" on public.marks for select to authenticated using (public.can_view_student(student_id));
create policy "teacher or admin enters marks" on public.marks for insert to authenticated with check (
  (public.is_admin() or public.teaches_student(student_id)) and entered_by = auth.uid()
);
create policy "teacher or admin updates marks" on public.marks for update to authenticated using (
  public.is_admin() or public.teaches_student(student_id)
) with check (public.is_admin() or (public.teaches_student(student_id) and entered_by = auth.uid()));
create policy "admin deletes marks" on public.marks for delete to authenticated using (public.is_admin());

create policy "authenticated reads published notices" on public.notices for select to authenticated using (published or public.is_admin());
create policy "admin manages notices" on public.notices for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Starter seed: safe to run once; add your own notice in the dashboard later.
insert into public.notices(title, body, published)
values ('Welcome to the school portal', 'Please contact the school office if you need help accessing your account.', true)
on conflict do nothing;
