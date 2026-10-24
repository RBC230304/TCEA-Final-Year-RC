-- V5 CV template + shortlisting access patch. Safe to run after schema_v2/cv_templates.
alter table public.jobs
  add column if not exists cv_template_type text default 'web-professional',
  add column if not exists cv_template_url text,
  add column if not exists cv_template_name text;

insert into storage.buckets(id,name,public) values ('cv-templates','cv-templates',true) on conflict (id) do update set public=true;

drop policy if exists "cv template public read" on storage.objects;
create policy "cv template public read" on storage.objects for select using (bucket_id='cv-templates');

drop policy if exists "cv template company upload" on storage.objects;
create policy "cv template company upload" on storage.objects for insert to authenticated with check (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'));

drop policy if exists "cv template company update" on storage.objects;
create policy "cv template company update" on storage.objects for update to authenticated using (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin')) with check (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'));

drop policy if exists "cv template company delete" on storage.objects;
create policy "cv template company delete" on storage.objects for delete to authenticated using (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'));

-- Companies may read the profiles of students who applied to their own jobs, which is required for CV matching and shortlist review.
drop policy if exists "companies read applicant profiles" on public.profiles;
create policy "companies read applicant profiles" on public.profiles for select to authenticated
using (public.current_role()='company' and id in (
  select a.student_id from public.applications a
  join public.jobs j on j.id=a.job_id
  join public.companies c on c.id=j.company_id
  where c.user_id=auth.uid()
));
