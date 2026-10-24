-- TPO-led coordinator access. Apply in Supabase SQL Editor after the existing schema files.
-- Permissions are stored centrally and can be changed by the TPO at any time.
create table if not exists public.coordinator_permissions (
  coordinator_id uuid primary key references public.profiles(id) on delete cascade,
  can_view_applicants boolean not null default false,
  can_shortlist boolean not null default false,
  can_download_cvs boolean not null default false,
  granted_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.coordinator_permissions enable row level security;

drop policy if exists "TPO manage coordinator permissions" on public.coordinator_permissions;
create policy "TPO manage coordinator permissions" on public.coordinator_permissions
  for all to authenticated using (public.current_role() in ('tpo','admin'))
  with check (public.current_role() in ('tpo','admin'));

drop policy if exists "Coordinator read own permissions" on public.coordinator_permissions;
create policy "Coordinator read own permissions" on public.coordinator_permissions
  for select to authenticated using (coordinator_id = auth.uid());

-- Coordinators can only read drives/applications/profiles when the corresponding permission is granted.
drop policy if exists "Coordinator read placement jobs" on public.jobs;
create policy "Coordinator read placement jobs" on public.jobs for select to authenticated
  using (public.current_role() = 'coordinator' and exists (
    select 1 from public.coordinator_permissions cp where cp.coordinator_id = auth.uid() and cp.can_view_applicants = true
  ));

drop policy if exists "Coordinator read applications with permission" on public.applications;
create policy "Coordinator read applications with permission" on public.applications for select to authenticated
  using (public.current_role() = 'coordinator' and exists (
    select 1 from public.coordinator_permissions cp where cp.coordinator_id = auth.uid() and cp.can_view_applicants = true
  ));

drop policy if exists "Coordinator update application status with permission" on public.applications;
create policy "Coordinator update application status with permission" on public.applications for update to authenticated
  using (public.current_role() = 'coordinator' and exists (
    select 1 from public.coordinator_permissions cp where cp.coordinator_id = auth.uid() and cp.can_shortlist = true
  ))
  with check (public.current_role() = 'coordinator' and exists (
    select 1 from public.coordinator_permissions cp where cp.coordinator_id = auth.uid() and cp.can_shortlist = true
  ));

drop policy if exists "Coordinator read applicant profiles with permission" on public.profiles;
create policy "Coordinator read applicant profiles with permission" on public.profiles for select to authenticated
  using (public.current_role() = 'coordinator' and role = 'student' and id in (
    select a.student_id from public.applications a
    where exists (select 1 from public.coordinator_permissions cp where cp.coordinator_id = auth.uid() and cp.can_view_applicants = true)
  ));

-- Allow the TPO workspace to manage website content and published placement information.
drop policy if exists "TPO manage site settings" on public.site_settings;
create policy "TPO manage site settings" on public.site_settings for all to authenticated
  using (public.current_role() in ('tpo','admin')) with check (public.current_role() in ('tpo','admin'));
drop policy if exists "TPO manage placement stats" on public.placement_stats;
create policy "TPO manage placement stats" on public.placement_stats for all to authenticated
  using (public.current_role() in ('tpo','admin')) with check (public.current_role() in ('tpo','admin'));
drop policy if exists "TPO manage notices" on public.notices;
create policy "TPO manage notices" on public.notices for all to authenticated
  using (public.current_role() in ('tpo','admin')) with check (public.current_role() in ('tpo','admin'));
drop policy if exists "TPO manage jobs" on public.jobs;
create policy "TPO manage jobs" on public.jobs for all to authenticated
  using (public.current_role() in ('tpo','admin')) with check (public.current_role() in ('tpo','admin'));

-- CV template storage is also available to the TPO and authorized company workflow.
drop policy if exists "cv template company upload" on storage.objects;
create policy "cv template company upload" on storage.objects for insert to authenticated
  with check (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'));
drop policy if exists "cv template company update" on storage.objects;
create policy "cv template company update" on storage.objects for update to authenticated
  using (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'))
  with check (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'));
drop policy if exists "cv template company delete" on storage.objects;
create policy "cv template company delete" on storage.objects for delete to authenticated
  using (bucket_id='cv-templates' and public.current_role() in ('company','tpo','admin'));
