-- ============================================================
-- GymLink — 09 트레이너의 회원 수업 기록
-- 유효한 PT 관계가 있는 트레이너만 회원 운동 로그를 추가할 수 있다.
-- ============================================================

create or replace function public.save_trainer_workout(
  p_member_id uuid,
  p_log_date date,
  p_session jsonb
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare current_payload jsonb;
begin
  if not public.has_pt_relation(auth.uid(), p_member_id) then
    raise exception '담당 회원의 수업만 기록할 수 있습니다';
  end if;

  select payload into current_payload
  from workout_logs where member_id = p_member_id and log_date = p_log_date;

  insert into workout_logs (member_id, log_date, gym_id, payload, updated_at)
  values (
    p_member_id,
    p_log_date,
    (select primary_gym_id from trainers where profile_id = auth.uid()),
    jsonb_build_object('sessions', coalesce(current_payload->'sessions', '[]'::jsonb) || jsonb_build_array(p_session)),
    now()
  )
  on conflict (member_id, log_date) do update
    set payload = excluded.payload, gym_id = excluded.gym_id, updated_at = now();
  return true;
end $$;

revoke all on function public.save_trainer_workout(uuid,date,jsonb) from public;
grant execute on function public.save_trainer_workout(uuid,date,jsonb) to authenticated;
