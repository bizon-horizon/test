-- Run this in your Supabase project: SQL Editor → New query → paste → Run

create table if not exists public.articles (
  id uuid default gen_random_uuid() primary key,
  title text not null check (char_length(title) >= 1 and char_length(title) <= 200),
  slug text not null unique,
  content text not null check (char_length(content) >= 1),
  excerpt text,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_created_at_idx on public.articles (created_at desc);
create index if not exists articles_slug_idx on public.articles (slug);

alter table public.articles enable row level security;

-- Anyone on the internet can read published articles
create policy "Public read access"
  on public.articles for select
  using (true);

-- Only signed-in users can publish
create policy "Authenticated users can insert"
  on public.articles for insert
  with check (auth.uid() = author_id);

create policy "Authors can update own articles"
  on public.articles for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "Authors can delete own articles"
  on public.articles for delete
  using (auth.uid() = author_id);

-- Auto-update updated_at on edits
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists articles_updated_at on public.articles;
create trigger articles_updated_at
  before update on public.articles
  for each row execute function public.handle_updated_at();
