-- ============================================================
-- GymLink — 16_pt_request_rls_fix.sql
-- pt_requests ↔ pt_applications 정책의 상호 참조 재귀를 끊는다.
-- ============================================================

create or replace function public.owns_pt_request(p_request uuid, p_member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pt_requests
    where id = p_request and member_id = p_member
  );
$$;

create or replace function public.has_pt_application(p_request uuid, p_trainer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pt_applications
    where request_id = p_request and trainer_id = p_trainer
  );
$$;

drop policy if exists pt_requests_read on public.pt_requests;
create policy pt_requests_read on public.pt_requests for select using (
  member_id = auth.uid()
  or status = 'open'
  or public.has_pt_application(id, auth.uid())
  or public.is_admin()
);

drop policy if exists pt_applications_read on public.pt_applications;
create policy pt_applications_read on public.pt_applications for select using (
  trainer_id = auth.uid()
  or public.owns_pt_request(request_id, auth.uid())
  or public.is_admin()
);

grant execute on function public.owns_pt_request(uuid, uuid) to authenticated;
grant execute on function public.has_pt_application(uuid, uuid) to authenticated;

select 'GymLink PT request RLS ready' as result;
