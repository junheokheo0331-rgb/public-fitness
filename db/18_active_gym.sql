-- ============================================================
-- GymLink — 18_active_gym.sql
-- 여러 회원권 이력 중 앱에서 사용할 '내 헬스장'을 명시적으로 선택한다.
-- ============================================================

alter table public.profiles
  add column if not exists active_gym_id uuid references public.gyms(id) on delete set null;

update public.profiles p
set active_gym_id = (
  select m.gym_id from public.memberships m
  where m.member_id = p.id and m.is_active
  order by m.starts_on desc, m.created_at desc limit 1
)
where p.role = 'member' and p.active_gym_id is null
  and exists (
    select 1 from public.memberships m
    where m.member_id = p.id and m.is_active
  );

create or replace function public.set_active_gym(p_gym_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.memberships
    where member_id = auth.uid() and gym_id = p_gym_id and is_active
      and (ends_on is null or ends_on >= current_date)
  ) then
    raise exception 'active membership required';
  end if;
  update public.profiles set active_gym_id = p_gym_id, updated_at = now() where id = auth.uid();
  return p_gym_id;
end $$;

create or replace function public.activate_gym_after_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active then
    update public.profiles set active_gym_id = new.gym_id, updated_at = now()
    where id = new.member_id;
  end if;
  return new;
end $$;

drop trigger if exists activate_gym_after_membership_trg on public.memberships;
create trigger activate_gym_after_membership_trg
after insert or update of is_active on public.memberships
for each row when (new.is_active) execute function public.activate_gym_after_membership();

revoke all on function public.set_active_gym(uuid) from public;
grant execute on function public.set_active_gym(uuid) to authenticated;

select 'GymLink active gym ready' as result;
