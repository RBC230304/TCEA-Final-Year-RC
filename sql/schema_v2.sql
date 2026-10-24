-- T&P SMART PORTAL v2 - run in Supabase SQL Editor
create extension if not exists pgcrypto;

alter type public.user_role add value if not exists 'company';

alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists skills text[] default '{}',
  add column if not exists certifications text[] default '{}',
  add column if not exists projects text[] default '{}',
  add column if not exists preferred_location text,
  add column if not exists experience text,
  add column if not exists resume_text text,
  add column if not exists resume_name text,
  add column if not exists validated boolean default true,
  add column if not exists is_active boolean default true;

create table if not exists public.companies (
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique references public.profiles(id) on delete set null,
 name text not null,
 contact_name text,
 email text,
 phone text,
 website text,
 verified boolean default false,
 created_at timestamptz default now()
);

alter table public.jobs
 add column if not exists company_id uuid references public.companies(id) on delete set null,
 add column if not exists requirements text,
 add column if not exists required_skills text[] default '{}',
 add column if not exists shortlist_criteria text,
 add column if not exists cv_template text,
 add column if not exists interview_mode text default 'Online',
 add column if not exists deadline date,
 add column if not exists status text default 'open';

create table if not exists public.applications (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'Applied',
 cv_text text,
 match_score numeric(5,2) default 0,
 missing_skills text[] default '{}',
 cover_note text,
 applied_at timestamptz default now(),
 unique(job_id, student_id)
);

create table if not exists public.interviews (
 id uuid primary key default gen_random_uuid(),
 job_id uuid references public.jobs(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 scheduled_at timestamptz not null,
 mode text default 'Online',
 meeting_link text,
 location text,
 status text default 'Scheduled',
 notes text,
 created_at timestamptz default now()
);

create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 student_id uuid references public.profiles(id) on delete cascade,
 title text not null,
 body text not null,
 type text default 'General',
 read boolean default false,
 created_at timestamptz default now()
);

create table if not exists public.practice_questions (
 id uuid primary key default gen_random_uuid(),
 category text not null,
 question text not null,
 answer text,
 year text,
 difficulty text default 'Medium',
 created_at timestamptz default now()
);

create table if not exists public.placement_history (
 id uuid primary key default gen_random_uuid(),
 company_name text not null,
 visit_date date,
 students_placed integer default 0,
 highest_package numeric(10,2) default 0,
 average_package numeric(10,2) default 0,
 department text,
 notes text,
 created_at timestamptz default now()
);

create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid references public.profiles(id) on delete set null,
 receiver_id uuid references public.profiles(id) on delete set null,
 company_id uuid references public.companies(id) on delete set null,
 subject text not null,
 body text not null,
 created_at timestamptz default now(),
 read boolean default false
);

create or replace function public.current_role() returns public.user_role
language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name,role,email)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name','User'),
        coalesce((new.raw_user_meta_data->>'role')::public.user_role,'student'),new.email)
 on conflict(id) do update set email=excluded.email;
 return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Enable RLS
do $$ declare t text; begin
 foreach t in array array['profiles','companies','jobs','applications','interviews','notifications','practice_questions','placement_history','messages'] loop
   execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

-- Existing public tables are retained; ensure reads
drop policy if exists "public can read active jobs" on public.jobs;
create policy "public can read active jobs" on public.jobs for select using (active=true or public.current_role() in ('admin','tpo','company'));

drop policy if exists "users read own profile" on public.profiles;
create policy "users read profiles by role" on public.profiles for select to authenticated
using (id=auth.uid() or public.current_role() in ('admin','tpo'));

drop policy if exists "admins manage jobs" on public.jobs;
create policy "admin tpo company manage jobs" on public.jobs for all to authenticated
using (public.current_role() in ('admin','tpo') or (public.current_role()='company' and company_id in (select id from public.companies where user_id=auth.uid())))
with check (public.current_role() in ('admin','tpo') or (public.current_role()='company' and company_id in (select id from public.companies where user_id=auth.uid())));

create policy "admin manage companies" on public.companies for all to authenticated
using (public.current_role() in ('admin','tpo') or user_id=auth.uid())
with check (public.current_role() in ('admin','tpo') or user_id=auth.uid());

create policy "students manage own applications" on public.applications for all to authenticated
using (student_id=auth.uid() or public.current_role() in ('admin','tpo') or
       job_id in (select id from public.jobs where company_id in (select id from public.companies where user_id=auth.uid())))
with check (student_id=auth.uid() or public.current_role() in ('admin','tpo') or
       job_id in (select id from public.jobs where company_id in (select id from public.companies where user_id=auth.uid())));

create policy "interview participants manage" on public.interviews for all to authenticated
using (student_id=auth.uid() or public.current_role() in ('admin','tpo') or
       job_id in (select id from public.jobs where company_id in (select id from public.companies where user_id=auth.uid())))
with check (student_id=auth.uid() or public.current_role() in ('admin','tpo') or
       job_id in (select id from public.jobs where company_id in (select id from public.companies where user_id=auth.uid())));

create policy "students notifications" on public.notifications for select to authenticated
using (student_id=auth.uid() or public.current_role() in ('admin','tpo'));
create policy "admin tpo notifications" on public.notifications for all to authenticated
using (public.current_role() in ('admin','tpo'))
with check (public.current_role() in ('admin','tpo'));

create policy "practice public read" on public.practice_questions for select using (true);
create policy "admin tpo practice" on public.practice_questions for all to authenticated
using (public.current_role() in ('admin','tpo')) with check (public.current_role() in ('admin','tpo'));

create policy "history public read" on public.placement_history for select using (true);
create policy "admin tpo history" on public.placement_history for all to authenticated
using (public.current_role() in ('admin','tpo')) with check (public.current_role() in ('admin','tpo'));

create policy "messages participants" on public.messages for select to authenticated
using (sender_id=auth.uid() or receiver_id=auth.uid() or
       company_id in (select id from public.companies where user_id=auth.uid()) or
       public.current_role() in ('admin','tpo'));
create policy "messages send" on public.messages for insert to authenticated
with check (sender_id=auth.uid());
create policy "admin tpo messages" on public.messages for all to authenticated
using (public.current_role() in ('admin','tpo')) with check (public.current_role() in ('admin','tpo'));

-- Allow a student to update only their own profile. Admin/TPO may update all.
create policy "profiles self update" on public.profiles for update to authenticated
using (id=auth.uid() or public.current_role() in ('admin','tpo'))
with check (id=auth.uid() or public.current_role() in ('admin','tpo'));

-- Seed practice examples if empty
insert into public.practice_questions(category,question,answer,year,difficulty)
select * from (values
 ('Aptitude','If a number is increased by 20% and then decreased by 20%, what is the net change?','4% decrease','Practice','Easy'),
 ('Java','What is the main purpose of encapsulation in OOP?','Bundle data and methods and control access to internal state.','Practice','Easy'),
 ('SQL','Which clause is used to filter grouped records?','HAVING','Practice','Easy')
) v(category,question,answer,year,difficulty)
where not exists (select 1 from public.practice_questions);

-- If you already have an admin-create-user Edge Function, redeploy the updated file
-- supplied with this project so it accepts the company role and creates company records.
