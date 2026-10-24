-- V13: robust media upload + job-ad drive visibility.
-- Run ONCE after the existing V12 patch. Do NOT rerun schema.sql/schema_v2.sql.

insert into storage.buckets (id,name,public)
values
  ('profile-media','profile-media',true),
  ('company-logos','company-logos',true),
  ('job-posters','job-posters',true)
on conflict (id) do update set public=true;

-- Student profile pictures: use only the first folder segment (auth.uid()) for writes.
drop policy if exists "profile media public read" on storage.objects;
create policy "profile media public read" on storage.objects
for select using (bucket_id='profile-media');

drop policy if exists "profile media upload own" on storage.objects;
create policy "profile media upload own" on storage.objects
for insert to authenticated
with check (bucket_id='profile-media' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "profile media update own" on storage.objects;
create policy "profile media update own" on storage.objects
for update to authenticated
using (bucket_id='profile-media' and split_part(name,'/',1)=auth.uid()::text)
with check (bucket_id='profile-media' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "profile media delete own" on storage.objects;
create policy "profile media delete own" on storage.objects
for delete to authenticated
using (bucket_id='profile-media' and split_part(name,'/',1)=auth.uid()::text);

-- Company logos.
drop policy if exists "company logos public read" on storage.objects;
create policy "company logos public read" on storage.objects
for select using (bucket_id='company-logos');

drop policy if exists "company logos upload own" on storage.objects;
create policy "company logos upload own" on storage.objects
for insert to authenticated
with check (bucket_id='company-logos' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "company logos update own" on storage.objects;
create policy "company logos update own" on storage.objects
for update to authenticated
using (bucket_id='company-logos' and split_part(name,'/',1)=auth.uid()::text)
with check (bucket_id='company-logos' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "company logos delete own" on storage.objects;
create policy "company logos delete own" on storage.objects
for delete to authenticated
using (bucket_id='company-logos' and split_part(name,'/',1)=auth.uid()::text);

-- Job posters: company uploads under its company UUID; TPO/Admin can manage all.
drop policy if exists "job posters public read" on storage.objects;
create policy "job posters public read" on storage.objects
for select using (bucket_id='job-posters');

drop policy if exists "job posters upload authenticated" on storage.objects;
create policy "job posters upload authenticated" on storage.objects
for insert to authenticated
with check (
  bucket_id='job-posters' and
  (public.current_role() in ('company','tpo','admin')) and
  (public.current_role() in ('tpo','admin') or split_part(name,'/',1)=auth.uid()::text)
);

drop policy if exists "job posters update authenticated" on storage.objects;
create policy "job posters update authenticated" on storage.objects
for update to authenticated
using (
  bucket_id='job-posters' and
  (public.current_role() in ('tpo','admin') or (public.current_role()='company' and split_part(name,'/',1)=auth.uid()::text))
)
with check (
  bucket_id='job-posters' and
  (public.current_role() in ('tpo','admin') or (public.current_role()='company' and split_part(name,'/',1)=auth.uid()::text))
);

drop policy if exists "job posters delete authenticated" on storage.objects;
create policy "job posters delete authenticated" on storage.objects
for delete to authenticated
using (
  bucket_id='job-posters' and
  (public.current_role() in ('tpo','admin') or (public.current_role()='company' and split_part(name,'/',1)=auth.uid()::text))
);

-- Ensure companies can read active jobs and their own jobs even when older rows were created without company_id.
drop policy if exists "company can read own jobs by owner" on public.jobs;
create policy "company can read own jobs by owner" on public.jobs
for select to authenticated
using (
  active=true
  or public.current_role() in ('admin','tpo')
  or (public.current_role()='company' and company_id in (select id from public.companies where user_id=auth.uid()))
);

-- Allow companies to create a homepage poster only for a job that is active and either belongs to them
-- or is a legacy drive carrying the same company name.
drop policy if exists "company creates home job ads" on public.home_job_ads;
create policy "company creates home job ads" on public.home_job_ads
for insert to authenticated
with check (
  created_by=auth.uid() and public.current_role()='company' and status='pending' and active=false and
  exists (
    select 1 from public.jobs j
    where j.id=job_id and j.active=true and
      (j.company_id in (select id from public.companies where user_id=auth.uid())
       or j.company=(select name from public.companies where user_id=auth.uid() limit 1))
  )
);
