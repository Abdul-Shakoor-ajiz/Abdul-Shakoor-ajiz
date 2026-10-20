# Ideal English Public School — Portal Activation Starter

This starter adds a Supabase-backed login and role-specific dashboards to an existing static HTML/CSS/JS website. It is a working MVP, not a complete school ERP. Test with dummy records before using real student data.

## Files to copy into your website folder
- `login.html`
- `portal.html`
- `supabase-config.js`
- `js/login.js`
- `js/portal.js`
- `supabase/schema.sql` (run this in Supabase SQL Editor; do not put it in your public website folder if you prefer to keep project files organized)

These HTML pages link to your existing `style.css` and `index.html`. If your CSS has different file names, update the links.

## 1. Create Supabase project
1. Visit https://supabase.com and create a project.
2. In the project, open SQL Editor → New query.
3. Paste all of `supabase/schema.sql` and run it.
4. Open Project Settings → API (or Connect, depending on dashboard layout). Copy the Project URL and the `anon` / publishable key.
5. Paste them into `supabase-config.js`. Keep the `service_role` / secret key private; never use it in browser code.

## 2. Run your site locally
1. Keep the files in the same folder as `index.html` and `style.css`.
2. Make sure the `js` folder contains `login.js` and `portal.js`.
3. In VS Code, install the Live Server extension if needed.
4. Right-click `index.html` → Open with Live Server.
5. In your existing homepage, portal links should point to `login.html`, for example `<a href="login.html">Student Portal</a>`.

Do not open files by double-clicking `file://`; use Live Server so the browser can load scripts consistently.

## 3. Create test accounts (admin must do this)
Public sign-up is intentionally disabled. In Supabase Dashboard → Authentication → Users → Add user, create one test email/password for each role. For every new user, copy the user's UUID.

Then in SQL Editor, run a separate insert for each account, replacing UUID/name/role with your test details:

```sql
insert into public.profiles (id, full_name, role)
values ('PASTE-AUTH-USER-UUID-HERE', 'Test Student', 'student');
```

Allowed roles: `admin`, `teacher`, `student`, `parent`. Never give an untrusted person the `admin` role. Use a strong password and change test passwords before real use.

## 4. Link a student account
First create the student's profile (role `student`), then add the school student record. Replace the IDs and sample values:

```sql
insert into public.students (user_id, admission_no, full_name, grade, section)
values ('STUDENT-USER-UUID', 'TEST-001', 'Test Student', '5', 'A');
```

To link a parent: create a parent auth user and profile first, then run:

```sql
insert into public.student_guardians (student_id, guardian_user_id, relationship)
select s.id, 'PARENT-USER-UUID', 'Parent'
from public.students s where s.admission_no = 'TEST-001';
```

## 5. Assign a teacher to a class
Create teacher auth user and profile first, then:

```sql
insert into public.teacher_assignments (teacher_user_id, grade, section, subject)
values ('TEACHER-USER-UUID', '5', 'A', 'English');
```

Repeat for each grade/section/subject the teacher is permitted to manage. Grade values should match your `students.grade` values exactly.

## 6. Test
- Student: sign in via `login.html` with role Student; should see their attendance and marks.
- Parent: sign in with role Parent; should see only linked children.
- Teacher: sign in with role Teacher; should see assigned students and can submit attendance/marks.
- Admin: sign in with role Administrator; can see the admin note. Admin setup and student/teacher/parent record creation is done in Supabase Dashboard/SQL for this starter.

## Important security and production notes
- Supabase Row Level Security (RLS) is enabled; don't disable it to fix a permission error.
- Only use the Project URL and anon/publishable key in browser code. Never put the `service_role` or secret key in HTML/JS.
- This MVP does not include fee payments, password reset UI, a full admin CRUD interface, printable report cards, or comprehensive audit logging.
- Test all roles with separate test accounts before entering real records. Have a qualified developer review the RLS policies and school privacy obligations before production use.
- If you already have an older schema with tables of the same names, don't run this SQL blindly. Back up first and adapt it to your existing schema.
