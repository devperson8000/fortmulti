-- Run once in your Supabase SQL editor. No service-role key belongs in the app.
create table if not exists public.duel_rooms (
 id uuid primary key default gen_random_uuid(),
 code text unique not null,
 host uuid not null references auth.users(id) on delete cascade,
 guest uuid references auth.users(id) on delete set null,
 expires_at timestamptz not null default now()+interval '2 hours',
 check (host is distinct from guest)
);
alter table public.duel_rooms enable row level security;
revoke all on public.duel_rooms from anon, authenticated;
grant select on public.duel_rooms to authenticated;
drop policy if exists duel_members_read on public.duel_rooms;
create policy duel_members_read on public.duel_rooms for select to authenticated
 using (auth.uid() in (host,guest) and expires_at>now());
create or replace function public.duel_room(invite text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.duel_rooms; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sign in anonymously first'; end if;
 if invite is null then
  if (select count(*) from public.duel_rooms where host=uid and expires_at>now())>=4 then raise exception 'Too many active rooms. Try again later.'; end if;
  insert into public.duel_rooms(code,host) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),uid) returning * into r;
 else
  select * into r from public.duel_rooms where code=upper(trim(invite)) and expires_at>now() for update;
  if not found then raise exception 'Room not found or expired'; end if;
  if r.host<>uid and r.guest is not null and r.guest<>uid then raise exception 'Room is full (2 players maximum)'; end if;
  if r.host<>uid then update public.duel_rooms set guest=uid where id=r.id returning * into r; end if;
 end if;
 return jsonb_build_object('id',r.id,'code',r.code,'host',r.host);
end $$;
revoke all on function public.duel_room(text) from public,anon;
grant execute on function public.duel_room(text) to authenticated;
drop policy if exists duel_broadcast_read on realtime.messages;
create policy duel_broadcast_read on realtime.messages for select to authenticated
 using (extension='broadcast' and exists(select 1 from public.duel_rooms r where realtime.topic()='duel:'||r.id::text and auth.uid() in(r.host,r.guest) and r.expires_at>now()));
drop policy if exists duel_broadcast_write on realtime.messages;
create policy duel_broadcast_write on realtime.messages for insert to authenticated
 with check (extension='broadcast' and exists(select 1 from public.duel_rooms r where realtime.topic()='duel:'||r.id::text and auth.uid() in(r.host,r.guest) and r.expires_at>now()));
