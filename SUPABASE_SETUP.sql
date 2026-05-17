create table if not exists public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person text not null check (person in ('katya', 'mykyta')),
  category_id text not null,
  category_title text not null,
  mood text not null,
  emoji text not null,
  created_at timestamptz not null default now()
);

alter table public.mood_entries enable row level security;
alter table public.mood_entries replica identity full;

grant select, insert, delete on table public.mood_entries to authenticated;

drop policy if exists "Both users can read moods" on public.mood_entries;
create policy "Both users can read moods"
on public.mood_entries
for select
to authenticated
using (true);

drop policy if exists "Users can add their own moods" on public.mood_entries;
create policy "Users can add their own moods"
on public.mood_entries
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and person = ((select auth.jwt()) -> 'app_metadata' ->> 'person')
  and person in ('katya', 'mykyta')
);

drop policy if exists "Users can delete their own moods" on public.mood_entries;
create policy "Users can delete their own moods"
on public.mood_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mood_entries'
  ) then
    alter publication supabase_realtime add table public.mood_entries;
  end if;
end $$;
