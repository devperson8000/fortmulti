-- Only the independent referee may write official rankings and tournament state.
create table if not exists public.horizon_hcs_state (
 id smallint primary key check (id = 1),
 state jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.horizon_hcs_state enable row level security;
revoke all on public.horizon_hcs_state from anon, authenticated;
grant select, insert, update on public.horizon_hcs_state to service_role;

-- One referee owns the edition; overlapping deploys cannot create two champions.
create table if not exists public.horizon_hcs_lease (
 id smallint primary key check (id = 1),
 owner uuid not null,
 expires_at timestamptz not null
);
alter table public.horizon_hcs_lease enable row level security;
revoke all on public.horizon_hcs_lease from anon, authenticated;
create or replace function public.hcs_claim_lease(p_owner uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
 insert into public.horizon_hcs_lease(id,owner,expires_at)
 values(1,p_owner,now()+interval '30 seconds')
 on conflict(id) do update set owner=excluded.owner,expires_at=excluded.expires_at
 where horizon_hcs_lease.owner=p_owner or horizon_hcs_lease.expires_at<now();
 return found;
end; $$;
create or replace function public.hcs_save_state(p_owner uuid,p_state jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not exists(select 1 from public.horizon_hcs_lease where id=1 and owner=p_owner and expires_at>now()) then
  raise exception 'Referee lease is not held';
 end if;
 insert into public.horizon_hcs_state(id,state,updated_at) values(1,p_state,now())
 on conflict(id) do update set state=excluded.state,updated_at=excluded.updated_at;
end; $$;
revoke all on function public.hcs_claim_lease(uuid) from public, anon, authenticated;
revoke all on function public.hcs_save_state(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.hcs_claim_lease(uuid) to service_role;
grant execute on function public.hcs_save_state(uuid,jsonb) to service_role;
