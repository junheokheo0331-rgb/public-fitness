-- ============================================================
-- GymLink — 20_booking_enum_fix.sql
-- booking_status enum에 빈 문자열을 coalesce 하던 기존 트리거를 수정한다.
-- ============================================================

create or replace function public.consume_session()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' and new.ledger_id is not null then
    update pt_ledger
       set used_sessions = used_sessions + 1
     where id = new.ledger_id and used_sessions < total_sessions;
    if not found then raise exception '잔여 세션이 없습니다'; end if;
  end if;
  return new;
end $$;

select 'GymLink booking enum fix ready' as result;
