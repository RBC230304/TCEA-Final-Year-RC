-- CV template support for T&P portal
alter table public.jobs
  add column if not exists cv_template_type text default 'web-professional',
  add column if not exists cv_template_url text,
  add column if not exists cv_template_name text;

insert into storage.buckets (id, name, public)
values ('cv-templates','cv-templates',true)
on conflict (id) do update set public=true;

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
