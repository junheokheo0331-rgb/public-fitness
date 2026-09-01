-- ============================================================
-- GymLink — 15_booking_approval.sql
-- 회원 예약은 요청으로 시작하고 트레이너가 확정/거절한다.
-- ============================================================

create or replace function public.notify_booking_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare member_name text; trainer_name text;
begin
  select display_name into member_name from profiles where id = new.member_id;
  select p.display_name into trainer_name
    from profiles p where p.id = new.trainer_id;

  if tg_op = 'INSERT' then
    insert into notifications (user_id, type, title, body, data)
    values (
      new.trainer_id, 'booking_requested', '새 PT 예약 요청',
      coalesce(member_name, '회원') || ' 회원이 수업을 요청했습니다. 확인 후 확정해주세요.',
      jsonb_build_object('booking_id', new.id, 'starts_at', new.starts_at, 'member_id', new.member_id)
    );
  elsif old.status is distinct from new.status then
    if new.status = 'confirmed' then
      insert into notifications (user_id, type, title, body, data)
      values (
        new.member_id, 'booking_confirmed', 'PT 예약 확정',
        coalesce(trainer_name, '트레이너') || ' 트레이너가 예약을 확정했습니다.',
        jsonb_build_object('booking_id', new.id, 'starts_at', new.starts_at, 'trainer_id', new.trainer_id)
      );
    elsif new.status = 'cancelled' and new.cancelled_by = new.trainer_id then
      insert into notifications (user_id, type, title, body, data)
      values (
        new.member_id, 'booking_rejected', 'PT 예약 미확정',
        '요청한 시간의 수업 진행이 어렵습니다. 다른 시간을 선택해주세요.',
        jsonb_build_object('booking_id', new.id, 'starts_at', new.starts_at, 'trainer_id', new.trainer_id)
      );
    elsif new.status = 'cancelled' then
      insert into notifications (user_id, type, title, body, data)
      values (
        new.trainer_id, 'booking_cancelled', 'PT 예약 취소',
        coalesce(member_name, '회원') || ' 회원의 예약이 취소됐습니다.',
        jsonb_build_object('booking_id', new.id, 'starts_at', new.starts_at, 'member_id', new.member_id)
      );
    end if;
  end if;
  return new;
end $$;

select 'GymLink booking approval ready' as result;
