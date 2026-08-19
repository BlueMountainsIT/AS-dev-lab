-- Dev Lab: notes table
-- Run this in the Supabase SQL Editor at the start of Session 2.

create table if not exists public.notes (
  id bigint generated always as identity primary key,
  name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Allow the app (using the anon key) to read and insert notes.
alter table public.notes enable row level security;

create policy "Anyone can read notes"
  on public.notes
  for select
  using (true);

create policy "Anyone can insert notes"
  on public.notes
  for insert
  with check (true);
