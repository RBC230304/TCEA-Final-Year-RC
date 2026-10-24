-- Run this entire script in Supabase > SQL Editor.
create extension if not exists pgcrypto;
create type public.user_role as enum ('student','tpo','admin');
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, role public.user_role not null default 'student', department text, roll_no text, cgpa numeric(3,2), skills text[], created_at timestamptz default now());
create table if not exists public.site_settings (id integer primary key default 1, site_name text not null default 'CampusConnect', hero_text text not null default 'A modern Training & Placement portal connecting students, TPO teams and companies.', updated_at timestamptz default now());
create table if not exists public.jobs (id uuid primary key default gen_random_uuid(), title text not null, company text not null, location text, min_cgpa numeric(3,2), description text, active boolean default true, created_at timestamptz default now());
create table if not exists public.notices (id uuid primary key default gen_random_uuid(), title text not null, body text not null, created_at timestamptz default now());
create table if not exists public.placement_stats (id integer primary key default 1, total_students integer default 0, companies integer default 0, active_drives integer default 0, students_placed integer default 0, updated_at timestamptz default now());
insert into public.site_settings(id) values(1) on conflict(id) do nothing;
insert into public.placement_stats(id) values(1) on conflict(id) do nothing;

-- Profile row is created when an authenticated user signs up.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','User'),'student'); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.jobs enable row level security;
alter table public.notices enable row level security;
alter table public.placement_stats enable row level security;

-- Helper: current user's role.
create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid(); $$;

-- Public reads.
create policy "public can read site settings" on public.site_settings for select using (true);
create policy "public can read active jobs" on public.jobs for select using (active=true or public.current_role() in ('admin','tpo'));
create policy "public can read notices" on public.notices for select using (true);
create policy "public can read placement stats" on public.placement_stats for select using (true);

-- Authenticated users can read their own profile.
create policy "users read own profile" on public.profiles for select to authenticated using (id=auth.uid() or public.current_role() in ('admin','tpo'));

-- Admin manages CMS; TPO may later be granted narrower management policies.
create policy "admins manage site settings" on public.site_settings for all to authenticated using (public.current_role()='admin') with check (public.current_role()='admin');
create policy "admins manage jobs" on public.jobs for all to authenticated using (public.current_role()='admin') with check (public.current_role()='admin');
create policy "admins manage notices" on public.notices for all to authenticated using (public.current_role()='admin') with check (public.current_role()='admin');
create policy "admins manage stats" on public.placement_stats for all to authenticated using (public.current_role()='admin') with check (public.current_role()='admin');

-- IMPORTANT: after creating the first admin account, run:
-- update public.profiles set role='admin' where id='PASTE_AUTH_USER_UUID_HERE';
