-- Sunny Skirmish multiplayer + social party schema.
-- Run this entire file in the Supabase SQL editor after every major game update.
-- Browser clients use anonymous authenticated users plus a public publishable key.
-- NEVER expose a service-role or secret key to the browser.

create table if not exists public.duel_rooms (
 id uuid primary key default gen_random_uuid(),
 code text unique not null,
 host uuid not null references auth.users(id) on delete cascade,
 guest uuid references auth.users(id) on delete set null, -- legacy column retained for safe upgrades
 expires_at timestamptz not null default now()+interval '2 hours'
);
alter table public.duel_rooms add column if not exists max_players integer not null default 8;
alter table public.duel_rooms drop constraint if exists duel_rooms_max_players_check;
alter table public.duel_rooms add constraint duel_rooms_max_players_check check (max_players between 2 and 8);

create table if not exists public.duel_room_members (
 room_id uuid not null references public.duel_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 last_seen timestamptz not null default now(),
 primary key (room_id,user_id)
);
create index if not exists duel_room_members_seen_idx on public.duel_room_members(room_id,last_seen);

-- Global lobby presence used only to show who is online.
create table if not exists public.duel_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Ranger',
 outfit_color text not null default '408faf',
 activity text not null default 'online' check (activity in ('online','party','match')),
 room_code text,
 last_seen timestamptz not null default now()
);
create index if not exists duel_presence_seen_idx on public.duel_presence(last_seen desc);

-- Short-lived party invitations. Room codes are only returned to the intended recipient.
create table if not exists public.duel_invites (
 id uuid primary key default gen_random_uuid(),
 from_user uuid not null references auth.users(id) on delete cascade,
 to_user uuid not null references auth.users(id) on delete cascade,
 room_code text not null,
 status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '45 seconds'
);
create index if not exists duel_invites_to_idx on public.duel_invites(to_user,status,expires_at desc);
create index if not exists duel_invites_from_idx on public.duel_invites(from_user,status,created_at desc);

-- Migrate rooms created by the old 1v1 schema.
insert into public.duel_room_members(room_id,user_id)
select id,host from public.duel_rooms
on conflict (room_id,user_id) do nothing;
insert into public.duel_room_members(room_id,user_id)
select id,guest from public.duel_rooms where guest is not null
on conflict (room_id,user_id) do nothing;

alter table public.duel_rooms enable row level security;
alter table public.duel_room_members enable row level security;
alter table public.duel_presence enable row level security;
alter table public.duel_invites enable row level security;

revoke all on public.duel_rooms from anon,authenticated;
revoke all on public.duel_room_members from anon,authenticated;
revoke all on public.duel_presence from anon,authenticated;
revoke all on public.duel_invites from anon,authenticated;
grant select on public.duel_rooms to authenticated;
grant select on public.duel_room_members to authenticated;

-- Room rows are readable only by active members. These reads are also used by Realtime RLS.
drop policy if exists duel_members_read on public.duel_rooms;
create policy duel_members_read on public.duel_rooms for select to authenticated
 using (
  expires_at>now() and exists(
   select 1 from public.duel_room_members m
   where m.room_id=duel_rooms.id and m.user_id=auth.uid()
  )
 );

drop policy if exists duel_room_member_self_read on public.duel_room_members;
create policy duel_room_member_self_read on public.duel_room_members for select to authenticated
 using (user_id=auth.uid());

-- Create a room when invite is null, otherwise join by the private code returned from an accepted invite.
create or replace function public.duel_room(invite text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 r public.duel_rooms;
 uid uuid:=auth.uid();
 n integer;
begin
 if uid is null then raise exception 'Sign in anonymously first'; end if;

 if invite is null then
  -- Remove stale rooms owned by this browser before creating another one.
  delete from public.duel_rooms where host=uid and expires_at<=now();
  if (select count(*) from public.duel_rooms where host=uid and expires_at>now())>=4 then
   raise exception 'Too many active rooms. Leave an old party and try again.';
  end if;
  insert into public.duel_rooms(code,host,max_players)
   values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),uid,8)
   returning * into r;
  insert into public.duel_room_members(room_id,user_id) values(r.id,uid)
   on conflict (room_id,user_id) do update set last_seen=now();
 else
  select * into r from public.duel_rooms
   where code=upper(trim(invite)) and expires_at>now()
   for update;
  if not found then raise exception 'Room not found or expired'; end if;

  -- A dead leader should never strand an invitee in a zombie room.
  if r.host<>uid and not exists(
   select 1 from public.duel_room_members m
   where m.room_id=r.id and m.user_id=r.host and m.last_seen>now()-interval '70 seconds'
  ) then raise exception 'Room host is offline'; end if;

  delete from public.duel_room_members
   where room_id=r.id and user_id<>r.host and user_id<>uid
    and last_seen<now()-interval '70 seconds';

  if not exists(select 1 from public.duel_room_members where room_id=r.id and user_id=uid) then
   select count(*) into n from public.duel_room_members where room_id=r.id;
   if n>=r.max_players then raise exception 'Room is full (8 players maximum)'; end if;
   insert into public.duel_room_members(room_id,user_id) values(r.id,uid);
  else
   update public.duel_room_members set last_seen=now() where room_id=r.id and user_id=uid;
  end if;
 end if;

 select count(*) into n from public.duel_room_members where room_id=r.id;
 return jsonb_build_object('id',r.id,'code',r.code,'host',r.host,'max_players',r.max_players,'member_count',n);
end $$;

create or replace function public.duel_room_heartbeat(room_uuid uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); r public.duel_rooms; n integer;
begin
 if uid is null then raise exception 'Not signed in'; end if;
 select * into r from public.duel_rooms where id=room_uuid and expires_at>now();
 if not found then raise exception 'Room not found or expired'; end if;
 update public.duel_room_members set last_seen=now() where room_id=room_uuid and user_id=uid;
 if not found then raise exception 'You are not a member of this room'; end if;
 if r.host=uid then update public.duel_rooms set expires_at=now()+interval '2 hours' where id=room_uuid; end if;
 select count(*) into n from public.duel_room_members where room_id=room_uuid and last_seen>now()-interval '70 seconds';
 return jsonb_build_object('host',r.host,'member_count',n,'max_players',r.max_players);
end $$;

create or replace function public.duel_room_leave(room_uuid uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); owner uuid;
begin
 if uid is null then return false; end if;
 select host into owner from public.duel_rooms where id=room_uuid;
 if not found then return true; end if;
 if owner=uid then
  delete from public.duel_rooms where id=room_uuid;
 else
  delete from public.duel_room_members where room_id=room_uuid and user_id=uid;
 end if;
 update public.duel_presence set activity='online',room_code=null,last_seen=now() where user_id=uid;
 return true;
end $$;

-- Update one user's global lobby presence. room_code is validated against actual membership.
create or replace function public.duel_presence_upsert(display_name text,outfit_color text,activity_state text default 'online',room_code text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); safe_room text:=null; safe_activity text;
begin
 if uid is null then raise exception 'Not signed in'; end if;
 safe_activity:=case when activity_state in ('online','party','match') then activity_state else 'online' end;
 if room_code is not null and exists(
  select 1 from public.duel_rooms r join public.duel_room_members m on m.room_id=r.id
  where r.code=upper(trim(room_code)) and r.expires_at>now() and m.user_id=uid
 ) then safe_room:=upper(trim(room_code)); end if;
 if safe_room is null and safe_activity<>'online' then safe_activity:='online'; end if;
 insert into public.duel_presence(user_id,display_name,outfit_color,activity,room_code,last_seen)
 values(uid,left(coalesce(nullif(trim(display_name),''),'Ranger'),20),case when outfit_color~'^[0-9A-Fa-f]{6}$' then lower(outfit_color) else '408faf' end,safe_activity,safe_room,now())
 on conflict(user_id) do update set display_name=excluded.display_name,outfit_color=excluded.outfit_color,activity=excluded.activity,room_code=excluded.room_code,last_seen=now();
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.duel_presence_offline() returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then return false; end if;
 delete from public.duel_presence where user_id=uid;
 return true;
end $$;

-- Returns only public lobby information. Private room codes are intentionally omitted.
create or replace function public.duel_online_players() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'Not signed in'; end if;
 delete from public.duel_presence where last_seen<now()-interval '45 seconds';
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.user_id,
  'display_name',p.display_name,
  'outfit_color',p.outfit_color,
  'activity',p.activity,
  'last_seen',p.last_seen
 ) order by p.activity='online' desc,p.last_seen desc),'[]'::jsonb)
 into result from public.duel_presence p where p.user_id<>uid and p.last_seen>now()-interval '45 seconds';
 return result;
end $$;

create or replace function public.duel_invite_send(target_user uuid,invite_code text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); r public.duel_rooms; invite_id uuid; n integer;
begin
 if uid is null then raise exception 'Not signed in'; end if;
 if target_user is null or target_user=uid then raise exception 'Choose another player'; end if;
 if not exists(select 1 from public.duel_presence where user_id=target_user and last_seen>now()-interval '45 seconds' and activity<>'match') then raise exception 'That player is no longer available'; end if;
 select * into r from public.duel_rooms where code=upper(trim(invite_code)) and expires_at>now();
 if not found then raise exception 'Party not found or expired'; end if;
 if not exists(select 1 from public.duel_room_members where room_id=r.id and user_id=uid) then raise exception 'You are not in that party'; end if;
 if exists(select 1 from public.duel_room_members where room_id=r.id and user_id=target_user) then raise exception 'That player is already in your party'; end if;
 select count(*) into n from public.duel_room_members where room_id=r.id and last_seen>now()-interval '70 seconds';
 if n>=r.max_players then raise exception 'Room is full (8 players maximum)'; end if;
 update public.duel_invites set status='expired' where status='pending' and (expires_at<=now() or (from_user=uid and to_user=target_user));
 if (select count(*) from public.duel_invites where from_user=uid and status='pending' and created_at>now()-interval '1 minute')>=12 then raise exception 'Too many invites. Try again in a moment.'; end if;
 insert into public.duel_invites(from_user,to_user,room_code) values(uid,target_user,r.code) returning id into invite_id;
 return jsonb_build_object('id',invite_id,'expires_in',45);
end $$;

create or replace function public.duel_invites() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'Not signed in'; end if;
 update public.duel_invites set status='expired' where status='pending' and expires_at<=now();
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',i.id,
  'from_user',i.from_user,
  'from_name',coalesce(p.display_name,'Ranger'),
  'from_color',coalesce(p.outfit_color,'408faf'),
  'room_code',i.room_code,
  'created_at',i.created_at,
  'expires_at',i.expires_at
 ) order by i.created_at desc),'[]'::jsonb)
 into result
 from public.duel_invites i
 left join public.duel_presence p on p.user_id=i.from_user
 where i.to_user=uid and i.status='pending' and i.expires_at>now();
 return result;
end $$;

create or replace function public.duel_invite_respond(invite_uuid uuid,accept_invite boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); i public.duel_invites; r public.duel_rooms; n integer;
begin
 if uid is null then raise exception 'Not signed in'; end if;
 select * into i from public.duel_invites where id=invite_uuid and to_user=uid and status='pending' for update;
 if not found or i.expires_at<=now() then
  if found then update public.duel_invites set status='expired' where id=i.id; end if;
  raise exception 'Invite expired or not found';
 end if;
 if not accept_invite then update public.duel_invites set status='declined' where id=i.id;return jsonb_build_object('accepted',false);end if;
 select * into r from public.duel_rooms where code=i.room_code and expires_at>now();
 if not found then update public.duel_invites set status='expired' where id=i.id;raise exception 'Party no longer exists';end if;
 if not exists(select 1 from public.duel_room_members where room_id=r.id and user_id=r.host and last_seen>now()-interval '70 seconds') then update public.duel_invites set status='expired' where id=i.id;raise exception 'Party leader is offline';end if;
 select count(*) into n from public.duel_room_members where room_id=r.id and last_seen>now()-interval '70 seconds';
 if n>=r.max_players then update public.duel_invites set status='expired' where id=i.id;raise exception 'Room is full (8 players maximum)';end if;
 update public.duel_invites set status='accepted' where id=i.id;
 return jsonb_build_object('accepted',true,'code',i.room_code);
end $$;

revoke all on function public.duel_room(text) from public,anon;
revoke all on function public.duel_room_heartbeat(uuid) from public,anon;
revoke all on function public.duel_room_leave(uuid) from public,anon;
revoke all on function public.duel_presence_upsert(text,text,text,text) from public,anon;
revoke all on function public.duel_presence_offline() from public,anon;
revoke all on function public.duel_online_players() from public,anon;
revoke all on function public.duel_invite_send(uuid,text) from public,anon;
revoke all on function public.duel_invites() from public,anon;
revoke all on function public.duel_invite_respond(uuid,boolean) from public,anon;

grant execute on function public.duel_room(text) to authenticated;
grant execute on function public.duel_room_heartbeat(uuid) to authenticated;
grant execute on function public.duel_room_leave(uuid) to authenticated;
grant execute on function public.duel_presence_upsert(text,text,text,text) to authenticated;
grant execute on function public.duel_presence_offline() to authenticated;
grant execute on function public.duel_online_players() to authenticated;
grant execute on function public.duel_invite_send(uuid,text) to authenticated;
grant execute on function public.duel_invites() to authenticated;
grant execute on function public.duel_invite_respond(uuid,boolean) to authenticated;

-- Private Realtime broadcast access is granted only to active room members.
drop policy if exists duel_broadcast_read on realtime.messages;
create policy duel_broadcast_read on realtime.messages for select to authenticated
 using (
  extension='broadcast' and exists(
   select 1 from public.duel_rooms r
   join public.duel_room_members m on m.room_id=r.id
   where realtime.topic()='duel:'||r.id::text
    and m.user_id=auth.uid() and m.last_seen>now()-interval '90 seconds'
    and r.expires_at>now()
  )
 );

drop policy if exists duel_broadcast_write on realtime.messages;
create policy duel_broadcast_write on realtime.messages for insert to authenticated
 with check (
  extension='broadcast' and exists(
   select 1 from public.duel_rooms r
   join public.duel_room_members m on m.room_id=r.id
   where realtime.topic()='duel:'||r.id::text
    and m.user_id=auth.uid() and m.last_seen>now()-interval '90 seconds'
    and r.expires_at>now()
  )
 );
