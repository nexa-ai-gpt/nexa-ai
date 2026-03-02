create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  nango_connection_id text not null,
  account_email text,
  account_display_name text,
  scopes text[],
  status text not null default 'connected',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, provider, nango_connection_id)
);

create index if not exists connected_accounts_user_provider_idx
  on public.connected_accounts (user_id, provider);

create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  nonce text not null,
  connection_id text,
  redirect_to text,
  created_at timestamp with time zone not null default now()
);

create index if not exists oauth_states_user_provider_idx
  on public.oauth_states (user_id, provider);

alter table public.connected_accounts enable row level security;
alter table public.oauth_states enable row level security;

create policy "connected_accounts_select_own"
  on public.connected_accounts
  for select
  using (auth.uid() = user_id);

create policy "connected_accounts_insert_own"
  on public.connected_accounts
  for insert
  with check (auth.uid() = user_id);

create policy "connected_accounts_update_own"
  on public.connected_accounts
  for update
  using (auth.uid() = user_id);

create policy "connected_accounts_delete_own"
  on public.connected_accounts
  for delete
  using (auth.uid() = user_id);

create policy "oauth_states_select_own"
  on public.oauth_states
  for select
  using (auth.uid() = user_id);

create policy "oauth_states_insert_own"
  on public.oauth_states
  for insert
  with check (auth.uid() = user_id);

create policy "oauth_states_delete_own"
  on public.oauth_states
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_connected_accounts_updated_at on public.connected_accounts;
create trigger set_connected_accounts_updated_at
before update on public.connected_accounts
for each row execute function public.set_updated_at();
