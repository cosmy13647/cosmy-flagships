-- =============================================================================
-- Cosmy Flagships — database schema for Supabase (Postgres)
--
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query.
-- It is safe to re-run (uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
--
-- Security model (enforced by the database, not by the frontend):
--   * Everyone (anon) can only READ phones whose status = 'available'.
--   * Only users listed in public.admins can read all phones or insert /
--     update / delete them, or upload / delete images.
--   * Public sign-ups should be DISABLED in Supabase (see README).
--   * All data validation is done here with CHECK constraints and triggers,
--     so a hand-crafted API request cannot bypass it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Admins
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- SECURITY DEFINER so policies can check membership without exposing the table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- A signed-in user may see only their own row (lets the app ask "am I an admin?").
-- Nobody can insert / update / delete admins through the API; add admins with SQL.
drop policy if exists "admins read own row" on public.admins;
create policy "admins read own row" on public.admins
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Phones
-- -----------------------------------------------------------------------------
create or replace function public.valid_image_urls(urls text[])
returns boolean
language sql
immutable
as $$
  select coalesce(
    cardinality(urls) <= 6
    and not exists (
      select 1 from unnest(urls) as u
      where u !~* '^https://[^[:space:]]+$' or char_length(u) > 2048
    ),
    false
  );
$$;

create table if not exists public.phones (
  id                    uuid primary key default gen_random_uuid(),
  brand                 text    not null check (char_length(btrim(brand)) between 1 and 50),
  model                 text    not null check (char_length(btrim(model)) between 1 and 100),
  storage_gb            integer check (storage_gb is null or storage_gb between 1 and 4096),
  ram_gb                integer check (ram_gb is null or ram_gb between 1 and 64),  -- optional: not every listing states RAM
  price_kes             integer not null check (price_kes between 1 and 10000000),
  condition             text    not null check (condition in ('new', 'ex_uk', 'used')),
  description           text    not null default '' check (char_length(description) <= 2000),
  image_urls            text[]  not null default '{}' check (public.valid_image_urls(image_urls)),
  status                text    not null default 'available'
                                check (status in ('available', 'sold', 'unavailable')),
  stock_source          text    not null default 'own'
                                check (stock_source in ('own', 'supplier')),
  supplier_confirmed    boolean not null default false,
  supplier_confirmed_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Supplier confirmation only makes sense for supplier stock.
  constraint supplier_confirmed_only_for_supplier
    check (stock_source = 'supplier' or (supplier_confirmed = false and supplier_confirmed_at is null))
);

create index if not exists phones_status_idx on public.phones (status);
create index if not exists phones_brand_idx  on public.phones (lower(brand));

-- Housekeeping + business rules, applied on every write regardless of the client.
create or replace function public.phones_before_write()
returns trigger
language plpgsql
as $$
begin
  new.brand       := btrim(new.brand);
  new.model       := btrim(new.model);
  new.description := btrim(new.description);

  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;      -- immutable
    new.id         := old.id;              -- immutable
  end if;
  new.updated_at := now();

  -- If the supplier runs out / the phone is no longer for sale, the supplier
  -- confirmation no longer holds. Re-listing it requires a fresh confirmation.
  if new.stock_source = 'supplier' and new.status <> 'available' then
    new.supplier_confirmed := false;
  end if;

  -- Keep the confirmation timestamp consistent with the flag.
  if new.supplier_confirmed then
    if tg_op = 'INSERT' or old.supplier_confirmed is distinct from true then
      new.supplier_confirmed_at := now();
    else
      new.supplier_confirmed_at := old.supplier_confirmed_at;
    end if;
  else
    new.supplier_confirmed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists phones_before_write on public.phones;
create trigger phones_before_write
  before insert or update on public.phones
  for each row execute function public.phones_before_write();

-- Row level security
alter table public.phones enable row level security;

drop policy if exists "public reads available phones" on public.phones;
create policy "public reads available phones" on public.phones
  for select to anon, authenticated
  using (status = 'available' or public.is_admin());

drop policy if exists "admins insert phones" on public.phones;
create policy "admins insert phones" on public.phones
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admins update phones" on public.phones;
create policy "admins update phones" on public.phones
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete phones" on public.phones;
create policy "admins delete phones" on public.phones
  for delete to authenticated
  using (public.is_admin());

revoke all on public.phones from anon, authenticated;
grant select on public.phones to anon;
grant select, insert, update, delete on public.phones to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Image storage (Supabase Storage bucket "phone-images")
--    Public read (so product pages can show images); admin-only write.
--    2 MB max, JPEG / PNG / WebP only — enforced by the bucket itself.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('phone-images', 'phone-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins upload phone images" on storage.objects;
create policy "admins upload phone images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'phone-images' and public.is_admin());

drop policy if exists "admins update phone images" on storage.objects;
create policy "admins update phone images" on storage.objects
  for update to authenticated
  using (bucket_id = 'phone-images' and public.is_admin())
  with check (bucket_id = 'phone-images' and public.is_admin());

drop policy if exists "admins delete phone images" on storage.objects;
create policy "admins delete phone images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'phone-images' and public.is_admin());

-- Admins can list files in the bucket; public image URLs work without a policy
-- because the bucket is public.
drop policy if exists "admins list phone images" on storage.objects;
create policy "admins list phone images" on storage.objects
  for select to authenticated
  using (bucket_id = 'phone-images' and public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. Make yourself an admin (run AFTER creating your user in Authentication ->
--    Users). Replace the email, then run this single statement:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict do nothing;
-- -----------------------------------------------------------------------------
