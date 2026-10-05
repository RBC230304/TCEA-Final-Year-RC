-- T&P Portal V9: onboarding approvals, student photos, company logos and homepage job-ad posters
-- Run this ONCE after the existing schema_v2 / CV patches.
-- Do NOT recreate public.user_role or rerun schema.sql/schema_v2.sql.

alter table public.profiles
  add column if not exists qualification text,
  add column if not exists profile_picture_url text,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approval_note text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;

alter table public.companies
  add column if not exists logo_url text,
  add column if not exists approval_note text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;

update public.profiles
set approval_status = case when is_active = false or validated = false then 'pending' else 'approved' end
where approval_status is null or approval_status = '';

create table if not exists public.home_job_ads (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  company_name text not null,
  company_logo_url text,
  poster_url text not null,
  poster_name text,
  caption text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.home_job_ads enable row level security;

drop policy if exists "public reads approved home job ads" on public.home_job_ads;
create policy "public reads approved home job ads" on public.home_job_ads
for select using (status='approved' and active=true);

drop policy if exists "company reads own home job ads" on public.home_job_ads;
create policy "company reads own home job ads" on public.home_job_ads
for select to authenticated
using (created_by=auth.uid() or public.current_role() in ('admin','tpo'));

drop policy if exists "company creates home job ads" on public.home_job_ads;
create policy "company creates home job ads" on public.home_job_ads
for insert to authenticated
with check (
  created_by=auth.uid() and
  public.current_role()='company' and
  status='pending' and active=false
);

drop policy if exists "company updates own pending home job ads" on public.home_job_ads;
create policy "company updates own pending home job ads" on public.home_job_ads
for update to authenticated
using (created_by=auth.uid() and public.current_role()='company')
with check (created_by=auth.uid() and public.current_role()='company' and status in ('pending','rejected'));

drop policy if exists "admin tpo manage home job ads" on public.home_job_ads;
create policy "admin tpo manage home job ads" on public.home_job_ads
for all to authenticated
using (public.current_role() in ('admin','tpo'))
with check (public.current_role() in ('admin','tpo'));

-- Replace the signup trigger so self-signups remain pending/inactive until approved.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role := case
    when meta->>'role' in ('student','tpo','admin','company') then (meta->>'role')::public.user_role
    else 'student'::public.user_role
  end;
  self_signup boolean := coalesce(meta->>'signup_source','')='self';
  v_skills text[] := case when coalesce(meta->>'skills','')='' then '{}' else array(select trim(x) from unnest(string_to_array(meta->>'skills',',')) x where trim(x)<>'') end;
  v_certs text[] := case when coalesce(meta->>'certifications','')='' then '{}' else array(select trim(x) from unnest(string_to_array(meta->>'certifications',',')) x where trim(x)<>'') end;
  v_projects text[] := case when coalesce(meta->>'projects','')='' then '{}' else array(select trim(x) from unnest(string_to_array(meta->>'projects',E'\n')) x where trim(x)<>'') end;
begin
  insert into public.profiles(
    id, full_name, role, department, roll_no, cgpa, email, phone,
    qualification, skills, certifications, projects, preferred_location, experience,
    validated, is_active, approval_status
  ) values (
    new.id,
    coalesce(meta->>'full_name','User'),
    v_role,
    nullif(trim(meta->>'department'),''),
    nullif(trim(meta->>'roll_no'),''),
    case when nullif(trim(meta->>'cgpa'),'') is null then null else (meta->>'cgpa')::numeric end,
    new.email,
    nullif(trim(meta->>'phone'),''),
    nullif(trim(meta->>'qualification'),''),
    v_skills,
    v_certs,
    v_projects,
    nullif(trim(meta->>'preferred_location'),''),
    nullif(trim(meta->>'experience'),'') ,
    not self_signup,
    not self_signup,
    case when self_signup then 'pending' else 'approved' end
  )
  on conflict(id) do update set
    email=excluded.email,
    full_name=coalesce(nullif(excluded.full_name,''), public.profiles.full_name);

  if v_role='company' then
    insert into public.companies(user_id,name,email,contact_name,phone,website,verified)
    values (
      new.id,
      coalesce(nullif(trim(meta->>'company_name'),''), nullif(trim(meta->>'full_name'),''), 'Company'),
      new.email,
      nullif(trim(meta->>'contact_name'),''),
      nullif(trim(meta->>'phone'),''),
      nullif(trim(meta->>'website'),''),
      not self_signup
    )
    on conflict(user_id) do update set
      name=excluded.name,
      email=excluded.email,
      contact_name=coalesce(excluded.contact_name, public.companies.contact_name),
      phone=coalesce(excluded.phone, public.companies.phone),
      website=coalesce(excluded.website, public.companies.website);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Public media buckets.
insert into storage.buckets(id,name,public)
values
  ('profile-media','profile-media',true),
  ('company-logos','company-logos',true),
  ('job-posters','job-posters',true)
on conflict (id) do update set public=true;

-- Profile picture policies.
drop policy if exists "profile media public read" on storage.objects;
create policy "profile media public read" on storage.objects for select
using (bucket_id='profile-media');

drop policy if exists "profile media upload own" on storage.objects;
create policy "profile media upload own" on storage.objects for insert to authenticated
with check (bucket_id='profile-media' and (public.current_role() in ('admin','tpo') or (public.current_role()='student' and name like (auth.uid()::text || '/%'))));

drop policy if exists "profile media update own" on storage.objects;
create policy "profile media update own" on storage.objects for update to authenticated
using (bucket_id='profile-media' and (public.current_role() in ('admin','tpo') or (public.current_role()='student' and name like (auth.uid()::text || '/%'))))
with check (bucket_id='profile-media' and (public.current_role() in ('admin','tpo') or (public.current_role()='student' and name like (auth.uid()::text || '/%'))));

drop policy if exists "profile media delete own" on storage.objects;
create policy "profile media delete own" on storage.objects for delete to authenticated
using (bucket_id='profile-media' and (public.current_role() in ('admin','tpo') or (public.current_role()='student' and name like (auth.uid()::text || '/%'))));

-- Company logo policies.
drop policy if exists "company logos public read" on storage.objects;
create policy "company logos public read" on storage.objects for select
using (bucket_id='company-logos');

drop policy if exists "company logos upload own" on storage.objects;
create policy "company logos upload own" on storage.objects for insert to authenticated
with check (bucket_id='company-logos' and (public.current_role() in ('admin','tpo') or (public.current_role()='company' and name like (auth.uid()::text || '/%'))));

drop policy if exists "company logos update own" on storage.objects;
create policy "company logos update own" on storage.objects for update to authenticated
using (bucket_id='company-logos' and (public.current_role() in ('admin','tpo') or (public.current_role()='company' and name like (auth.uid()::text || '/%'))))
with check (bucket_id='company-logos' and (public.current_role() in ('admin','tpo') or (public.current_role()='company' and name like (auth.uid()::text || '/%'))));

drop policy if exists "company logos delete own" on storage.objects;
create policy "company logos delete own" on storage.objects for delete to authenticated
using (bucket_id='company-logos' and (public.current_role() in ('admin','tpo') or (public.current_role()='company' and name like (auth.uid()::text || '/%'))));

-- Homepage job-ad poster policies.
drop policy if exists "job posters public read" on storage.objects;
create policy "job posters public read" on storage.objects for select
using (bucket_id='job-posters');

drop policy if exists "job posters upload authenticated" on storage.objects;
create policy "job posters upload authenticated" on storage.objects for insert to authenticated
with check (bucket_id='job-posters' and public.current_role() in ('company','tpo','admin'));

drop policy if exists "job posters update authenticated" on storage.objects;
create policy "job posters update authenticated" on storage.objects for update to authenticated
using (bucket_id='job-posters' and public.current_role() in ('company','tpo','admin'))
with check (bucket_id='job-posters' and public.current_role() in ('company','tpo','admin'));

drop policy if exists "job posters delete authenticated" on storage.objects;
create policy "job posters delete authenticated" on storage.objects for delete to authenticated
using (bucket_id='job-posters' and public.current_role() in ('company','tpo','admin'));
