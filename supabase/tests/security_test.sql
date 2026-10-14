-- Run after supabase_sim.sql + schema.sql on a scratch Postgres.
\set ON_ERROR_STOP on
drop schema if exists t cascade;
create schema t;
create table t.results (name text, ok boolean, got text);

create function t.run(q text, as_role text, uid uuid) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  execute 'set local role ' || as_role;
  begin
    execute q; get diagnostics n = row_count; reset role; return 'ok rows=' || n;
  exception when others then reset role; return 'ERR ' || sqlstate;
  end;
end $$;

create function t.scalar(q text, as_role text, uid uuid) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  execute 'set local role ' || as_role;
  begin execute q into v; reset role; return v;
  exception when others then reset role; return 'ERR ' || sqlstate; end;
end $$;

create function t.check(n text, got text, want text) returns void language plpgsql as $$
begin insert into t.results values (n, got = want or (right(want,1)='%' and got like want), got); end $$;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@x.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'user@x.test');
insert into public.admins (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''

-- ---- seed as admin through the API role (also proves admin insert works) ----
select t.check('admin can insert own-stock phone',
  t.run($q$insert into phones (brand,model,storage_gb,ram_gb,price_kes,condition,stock_source)
           values ('Samsung','Galaxy S23',256,8,35000,'ex_uk','own')$q$, 'authenticated', :A), 'ok rows=1');
select t.check('admin can insert supplier phone',
  t.run($q$insert into phones (brand,model,storage_gb,price_kes,condition,stock_source)
           values ('Apple','iPhone 14 Pro',128,55000,'ex_uk','supplier')$q$, 'authenticated', :A), 'ok rows=1');
select t.check('admin can insert sold phone',
  t.run($q$insert into phones (brand,model,price_kes,condition,status)
           values ('Google','Pixel 8',40000,'used','sold')$q$, 'authenticated', :A), 'ok rows=1');

-- ---- visibility ----
select t.check('anon sees only available phones', t.scalar('select count(*) from phones','anon',null), '2');
select t.check('non-admin sees only available phones', t.scalar('select count(*) from phones','authenticated',:B), '2');
select t.check('admin sees all phones', t.scalar('select count(*) from phones','authenticated',:A), '3');
select t.check('anon is not admin', t.scalar('select is_admin()','anon',null), 'false');
select t.check('admin is admin', t.scalar('select is_admin()','authenticated',:A), 'true');
select t.check('non-admin is not admin', t.scalar('select is_admin()','authenticated',:B), 'false');

-- ---- unauthenticated / non-admin writes are refused ----
select t.check('anon cannot insert', t.run($q$insert into phones (brand,model,price_kes,condition) values ('X','Y',1000,'new')$q$,'anon',null), 'ERR 42501');
select t.check('anon cannot update', t.run($q$update phones set price_kes = 1$q$,'anon',null), 'ERR 42501');
select t.check('anon cannot delete', t.run($q$delete from phones$q$,'anon',null), 'ERR 42501');
select t.check('non-admin cannot insert', t.run($q$insert into phones (brand,model,price_kes,condition) values ('X','Y',1000,'new')$q$,'authenticated',:B), 'ERR 42501');
select t.check('non-admin update affects 0 rows', t.run($q$update phones set price_kes = 1$q$,'authenticated',:B), 'ok rows=0');
select t.check('non-admin delete affects 0 rows', t.run($q$delete from phones$q$,'authenticated',:B), 'ok rows=0');
select t.check('data untouched by attackers', (select count(*) from phones where price_kes = 1)::text, '0');
select t.check('data count intact', (select count(*) from phones)::text, '3');

-- ---- server-side validation (as a real admin, so only the DB rules can stop it) ----
select t.check('reject price 0', t.run($q$insert into phones (brand,model,price_kes,condition) values ('A','B',0,'new')$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject negative price', t.run($q$insert into phones (brand,model,price_kes,condition) values ('A','B',-5,'new')$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject blank brand', t.run($q$insert into phones (brand,model,price_kes,condition) values ('   ','B',100,'new')$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject blank model', t.run($q$insert into phones (brand,model,price_kes,condition) values ('A','',100,'new')$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject bad condition', t.run($q$insert into phones (brand,model,price_kes,condition) values ('A','B',100,'mint')$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject bad status', t.run($q$insert into phones (brand,model,price_kes,condition,status) values ('A','B',100,'new','gone')$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject bad stock source', t.run($q$insert into phones (brand,model,price_kes,condition,stock_source) values ('A','B',100,'new','friend')$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject storage 0', t.run($q$insert into phones (brand,model,price_kes,condition,storage_gb) values ('A','B',100,'new',0)$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject ram 999', t.run($q$insert into phones (brand,model,price_kes,condition,ram_gb) values ('A','B',100,'new',999)$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject http image url', t.run($q$insert into phones (brand,model,price_kes,condition,image_urls) values ('A','B',100,'new',array['http://x.test/a.jpg'])$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject javascript: url', t.run($q$insert into phones (brand,model,price_kes,condition,image_urls) values ('A','B',100,'new',array['javascript:alert(1)'])$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject 7 images', t.run($q$insert into phones (brand,model,price_kes,condition,image_urls) values ('A','B',100,'new',array_fill('https://x.test/a.jpg'::text, array[7]))$q$,'authenticated',:A), 'ERR 23514');
select t.check('accept https image url', t.run($q$insert into phones (brand,model,price_kes,condition,image_urls) values ('A','B',100,'new',array['https://x.test/a.jpg'])$q$,'authenticated',:A), 'ok rows=1');
select t.check('reject long description', t.run($q$insert into phones (brand,model,price_kes,condition,description) values ('A','B',100,'new',repeat('x',2001))$q$,'authenticated',:A), 'ERR 23514');
select t.check('reject confirmed flag on own stock', t.run($q$insert into phones (brand,model,price_kes,condition,stock_source,supplier_confirmed) values ('A','B',100,'new','own',true)$q$,'authenticated',:A), 'ERR 23514');

-- ---- supplier confirmation workflow (triggers) ----
select t.check('supplier phone starts unconfirmed', (select supplier_confirmed::text from phones where model='iPhone 14 Pro'), 'false');
select t.check('admin confirms supplier stock', t.run($q$update phones set supplier_confirmed = true where model='iPhone 14 Pro'$q$,'authenticated',:A), 'ok rows=1');
select t.check('confirmation timestamp set', (select (supplier_confirmed_at is not null)::text from phones where model='iPhone 14 Pro'), 'true');
select t.check('mark sold clears confirmation', t.run($q$update phones set status='sold' where model='iPhone 14 Pro'$q$,'authenticated',:A), 'ok rows=1');
select t.check('  -> confirmed reset', (select supplier_confirmed::text||'/'||(supplier_confirmed_at is null)::text from phones where model='iPhone 14 Pro'), 'false/true');
select t.check('mark available again stays unconfirmed', t.run($q$update phones set status='available' where model='iPhone 14 Pro'$q$,'authenticated',:A), 'ok rows=1');
select t.check('  -> still unconfirmed', (select supplier_confirmed::text from phones where model='iPhone 14 Pro'), 'false');

-- ---- immutable fields ----
select t.check('client cannot rewrite created_at', t.run($q$update phones set created_at='2000-01-01' where model='Galaxy S23'$q$,'authenticated',:A), 'ok rows=1');
select t.check('  -> created_at unchanged', (select (created_at > '2020-01-01')::text from phones where model='Galaxy S23'), 'true');
select t.check('updated_at advances', (select (updated_at >= created_at)::text from phones where model='Galaxy S23'), 'true');
select t.check('  -> brand is trimmed', t.run($q$update phones set brand='  Samsung  ' where model='Galaxy S23'$q$,'authenticated',:A) || ':' || (select brand from phones where model='Galaxy S23'), 'ok rows=1:Samsung');

-- ---- admin delete ----
select t.check('admin can delete', t.run($q$delete from phones where model='Pixel 8'$q$,'authenticated',:A), 'ok rows=1');

-- ---- admins table is locked down ----
select t.check('non-admin sees no admin rows', t.scalar('select count(*) from admins','authenticated',:B), '0');
select t.check('admin sees own admin row', t.scalar('select count(*) from admins','authenticated',:A), '1');
select t.check('anon cannot read admins', t.run('select * from admins','anon',null), 'ERR 42501');
select t.check('non-admin cannot self-promote', t.run($q$insert into admins (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002')$q$,'authenticated',:B), 'ERR 42501');
select t.check('admin cannot add admins via API', t.run($q$insert into admins (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002')$q$,'authenticated',:A), 'ERR 42501');

-- ---- storage bucket + policies ----
select t.check('bucket configured', (select public::text||'/'||file_size_limit||'/'||cardinality(allowed_mime_types) from storage.buckets where id='phone-images'), 'true/2097152/3');
select t.check('admin can upload', t.run($q$insert into storage.objects (bucket_id,name) values ('phone-images','a.jpg')$q$,'authenticated',:A), 'ok rows=1');
select t.check('non-admin cannot upload', t.run($q$insert into storage.objects (bucket_id,name) values ('phone-images','b.jpg')$q$,'authenticated',:B), 'ERR 42501');
select t.check('anon cannot upload', t.run($q$insert into storage.objects (bucket_id,name) values ('phone-images','c.jpg')$q$,'anon',null), 'ERR 42501');
insert into storage.buckets (id, name, public) values ('private-docs','private-docs',false);
select t.check('admin cannot write other bucket', t.run($q$insert into storage.objects (bucket_id,name) values ('private-docs','x.jpg')$q$,'authenticated',:A), 'ERR 42501');
select t.check('non-admin cannot delete image', t.run($q$delete from storage.objects$q$,'authenticated',:B), 'ok rows=0');
select t.check('admin can delete image', t.run($q$delete from storage.objects where name='a.jpg'$q$,'authenticated',:A), 'ok rows=1');

-- ---- re-running schema is idempotent (checked by the runner script) ----
select case when ok then 'PASS' else 'FAIL' end as result, name, case when ok then '' else 'got: ' || got end as detail
from t.results order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
