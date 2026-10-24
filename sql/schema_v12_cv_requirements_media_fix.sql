-- V12: dynamic CV requirements + student extra CV fields + reliable media storage policies.
-- Run AFTER the existing V2/V5/V9 patches. Do NOT rerun schema.sql.

alter table public.profiles
  add column if not exists profile_extra_fields jsonb not null default '{}'::jsonb;

alter table public.jobs
  add column if not exists cv_required_fields jsonb not null default '[]'::jsonb;

-- Ensure media buckets exist and remain publicly readable for generated CV/profile views.
insert into storage.buckets (id,name,public)
values
  ('profile-media','profile-media',true),
  ('company-logos','company-logos',true),
  ('cv-templates','cv-templates',true)
on conflict (id) do update set public=true;

-- Reliable student profile-picture access: authorization is based on the object path,
-- not a lookup through current_role() inside storage RLS.
drop policy if exists "profile media public read" on storage.objects;
create policy "profile media public read" on storage.objects
for select using (bucket_id='profile-media');

drop policy if exists "profile media upload own" on storage.objects;
create policy "profile media upload own" on storage.objects
for insert to authenticated
with check (bucket_id='profile-media' and name like (auth.uid()::text || '/%'));

drop policy if exists "profile media update own" on storage.objects;
create policy "profile media update own" on storage.objects
for update to authenticated
using (bucket_id='profile-media' and name like (auth.uid()::text || '/%'))
with check (bucket_id='profile-media' and name like (auth.uid()::text || '/%'));

drop policy if exists "profile media delete own" on storage.objects;
create policy "profile media delete own" on storage.objects
for delete to authenticated
using (bucket_id='profile-media' and name like (auth.uid()::text || '/%'));

-- Company logo storage: company account owns the folder named by auth.uid().
drop policy if exists "company logos public read" on storage.objects;
create policy "company logos public read" on storage.objects
for select using (bucket_id='company-logos');

drop policy if exists "company logos upload own" on storage.objects;
create policy "company logos upload own" on storage.objects
for insert to authenticated
with check (bucket_id='company-logos' and name like (auth.uid()::text || '/%'));

drop policy if exists "company logos update own" on storage.objects;
create policy "company logos update own" on storage.objects
for update to authenticated
using (bucket_id='company-logos' and name like (auth.uid()::text || '/%'))
with check (bucket_id='company-logos' and name like (auth.uid()::text || '/%'));

drop policy if exists "company logos delete own" on storage.objects;
create policy "company logos delete own" on storage.objects
for delete to authenticated
using (bucket_id='company-logos' and name like (auth.uid()::text || '/%'));

-- CV template files: authenticated recruitment users may manage templates.
drop policy if exists "cv template public read" on storage.objects;
create policy "cv template public read" on storage.objects
for select using (bucket_id='cv-templates');

drop policy if exists "cv template company upload" on storage.objects;
create policy "cv template company upload" on storage.objects
for insert to authenticated
with check (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'));

drop policy if exists "cv template company update" on storage.objects;
create policy "cv template company update" on storage.objects
for update to authenticated
using (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'))
with check (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'));

drop policy if exists "cv template company delete" on storage.objects;
create policy "cv template company delete" on storage.objects
for delete to authenticated
using (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'));
