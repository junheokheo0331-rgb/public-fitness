-- ============================================================
-- GymLink — 17_pt_application_owner.sql
-- 지원서에 요청 회원을 비정규화해 RLS에서 테이블을 서로 참조하지 않는다.
-- ============================================================

alter table public.pt_applications
  add column if not exists member_id uuid references public.profiles(id) on delete cascade;

update public.pt_applications a
set member_id = r.member_id
from public.pt_requests r
where r.id = a.request_id and a.member_id is null;

create or replace function public.fill_pt_application_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select member_id into new.member_id from public.pt_requests where id = new.request_id;
  if new.member_id is null then raise exception 'PT request not found'; end if;
  return new;
end $$;

drop trigger if exists fill_pt_application_member_trg on public.pt_applications;
create trigger fill_pt_application_member_trg
before insert or update of request_id on public.pt_applications
for each row execute function public.fill_pt_application_member();

drop policy if exists pt_requests_read on public.pt_requests;
create policy pt_requests_read on public.pt_requests for select using (
  member_id = auth.uid()
  or status = 'open'
  or exists (select 1 from public.trainers t where t.profile_id = auth.uid())
  or public.is_admin()
);

drop policy if exists pt_applications_read on public.pt_applications;
create policy pt_applications_read on public.pt_applications for select using (
  trainer_id = auth.uid()
  or member_id = auth.uid()
  or public.is_admin()
);

select 'GymLink PT application ownership ready' as result;
