create index if not exists duel_room_members_user_idx on public.duel_room_members(user_id);
create index if not exists duel_rooms_host_idx on public.duel_rooms(host);
create index if not exists duel_rooms_guest_idx on public.duel_rooms(guest) where guest is not null;

drop policy if exists duel_members_read on public.duel_rooms;
create policy duel_members_read on public.duel_rooms for select to authenticated
 using (
  expires_at>now() and exists(
   select 1 from public.duel_room_members m
   where m.room_id=duel_rooms.id and m.user_id=(select auth.uid())
  )
 );

drop policy if exists duel_room_member_self_read on public.duel_room_members;
create policy duel_room_member_self_read on public.duel_room_members for select to authenticated
 using (user_id=(select auth.uid()));

drop policy if exists duel_broadcast_read on realtime.messages;
create policy duel_broadcast_read on realtime.messages for select to authenticated
 using (
  extension='broadcast' and exists(
   select 1 from public.duel_rooms r
   join public.duel_room_members m on m.room_id=r.id
   where realtime.topic()='duel:'||r.id::text
    and m.user_id=(select auth.uid()) and m.last_seen>now()-interval '90 seconds'
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
    and m.user_id=(select auth.uid()) and m.last_seen>now()-interval '90 seconds'
    and r.expires_at>now()
  )
 );
