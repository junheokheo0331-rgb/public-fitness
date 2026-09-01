-- GymLink SST 심사용 삼축 데모 데이터
-- Auth > Users에서 아래 계정 3개를 먼저 만든 뒤 실행한다.
-- owner.demo@gymlink.test / trainer.demo@gymlink.test / member.demo@gymlink.test
-- 비밀번호는 이 파일이나 Git에 기록하지 않는다.

do $$
declare
  v_owner uuid;
  v_trainer uuid;
  v_member uuid;
  v_gym uuid := '44444444-4444-4444-4444-444444444444';
  v_membership_plan uuid := '44444444-4444-4444-4444-444444444401';
  v_pt_plan uuid := '44444444-4444-4444-4444-444444444402';
  v_day_plan uuid := '44444444-4444-4444-4444-444444444403';
  v_membership uuid := '44444444-4444-4444-4444-444444444410';
  v_ledger uuid := '44444444-4444-4444-4444-444444444420';
  v_routine uuid := '44444444-4444-4444-4444-444444444430';
  v_assignment uuid := '44444444-4444-4444-4444-444444444440';
  v_thread uuid := '44444444-4444-4444-4444-444444444450';
begin
  select id into v_owner from auth.users where lower(email) = 'owner.demo@gymlink.test';
  select id into v_trainer from auth.users where lower(email) = 'trainer.demo@gymlink.test';
  select id into v_member from auth.users where lower(email) = 'member.demo@gymlink.test';
  if v_owner is null or v_trainer is null or v_member is null then
    raise exception '먼저 Auth Users에 owner/trainer/member 데모 계정 3개를 만드세요.';
  end if;

  update profiles set role = 'owner', display_name = '모두의짐 관장' where id = v_owner;
  update profiles set role = 'trainer', display_name = '박서연 트레이너' where id = v_trainer;
  update profiles set role = 'member', display_name = '김지훈 회원' where id = v_member;

  insert into gyms (id, owner_id, name, status, road_address, dong, lat, lng, phone, intro, amenities, hours)
  values (v_gym, v_owner, '모두의짐 서면점', 'active', '부산 부산진구 중앙대로 000', '부전동',
    35.1579, 129.0594, '051-000-0000',
    'Cybex Eagle 라인과 프리웨이트를 갖춘 GymLink 데모 헬스장입니다.',
    array['샤워실','주차','운동복','락커'],
    '{"mon":["06:00","24:00"],"tue":["06:00","24:00"],"wed":["06:00","24:00"],"thu":["06:00","24:00"],"fri":["06:00","24:00"],"sat":["08:00","22:00"],"sun":["08:00","20:00"]}'::jsonb)
  on conflict (id) do update set owner_id=excluded.owner_id, name=excluded.name, status='active', intro=excluded.intro;

  insert into gym_staff(gym_id, profile_id, can_manage) values (v_gym, v_owner, true)
  on conflict (gym_id, profile_id) do update set can_manage=true;

  insert into trainers(profile_id, primary_gym_id, headline, bio, specialties, years, is_public, accepts_new, rating_avg, rating_count)
  values (v_trainer, v_gym, '초보자 자세·체력 향상 전문',
    '운동을 처음 시작한 회원이 혼자서도 이어갈 수 있도록 수업 기록과 숙제를 남깁니다.',
    array['beginner','posture','diet'], 6, true, true, 4.9, 28)
  on conflict (profile_id) do update set primary_gym_id=excluded.primary_gym_id, headline=excluded.headline,
    bio=excluded.bio, specialties=excluded.specialties, years=excluded.years, is_public=true, accepts_new=true;

  insert into gym_machines(gym_id, machine_id, qty, brand, model_name, min_step_kg, supports_unilateral, custom_capabilities, metadata)
  select v_gym, id, case when code in ('DUMBBELL','BENCH_ADJ') then 4 else 1 end,
    case when category='machine' or code in ('LAT_PULLDOWN','SEATED_ROW') then 'Cybex' else '국산·멀티브랜드' end,
    case code
      when 'CHEST_PRESS' then 'Eagle NX Chest Press' when 'PEC_DECK' then 'Eagle NX Fly / Rear Delt'
      when 'SHOULDER_PR' then 'Eagle NX Overhead Press' when 'LAT_PULLDOWN' then 'Eagle NX Lat Pulldown'
      when 'SEATED_ROW' then 'Eagle NX Row' when 'LEG_PRESS' then 'Eagle NX Leg Press'
      when 'LEG_EXT' then 'Eagle NX Leg Extension' when 'LEG_CURL' then 'Eagle NX Prone Leg Curl'
      when 'HIP_ABD' then 'Eagle NX Hip Abduction' when 'HIP_ADD' then 'Eagle NX Hip Adduction'
      else case when code like 'CYBEX_EAGLE_%' then name_ko else null end end,
    default_step_kg, code in ('LAT_PULLDOWN','SEATED_ROW','LEG_EXT','LEG_CURL'), '{}',
    jsonb_build_object('demo_line','Cybex Eagle','verified',true)
  from machine_catalog
  where code = any(array[
    'POWER_RACK','SMITH','BENCH_FLAT','BENCH_ADJ','BARBELL','PLATE_SMALL','EZ_BAR','DUMBBELL',
    'CABLE_CROSS','LAT_PULLDOWN','SEATED_ROW','CHEST_PRESS','PEC_DECK','SHOULDER_PR',
    'LEG_PRESS','HACK_SQUAT','LEG_EXT','LEG_CURL','HIP_ABD','HIP_ADD','CALF_MACHINE',
    'ASSIST_PULLUP','TREADMILL','CYCLE','STAIRMILL','MAT','BAND',
    'CYBEX_EAGLE_LEG_PRESS','CYBEX_EAGLE_LEG_EXT','CYBEX_EAGLE_SEATED_CURL','CYBEX_EAGLE_PRONE_CURL',
    'CYBEX_EAGLE_CALF','CYBEX_EAGLE_HIP_AB_AD','CYBEX_EAGLE_GLUTE','CYBEX_EAGLE_CHEST',
    'CYBEX_EAGLE_INCLINE','CYBEX_EAGLE_OVERHEAD','CYBEX_EAGLE_PULLDOWN','CYBEX_EAGLE_INCLINE_PULL',
    'CYBEX_EAGLE_ROW','CYBEX_EAGLE_ARM_CURL','CYBEX_EAGLE_ARM_EXT','CYBEX_EAGLE_FLY_REAR',
    'CYBEX_EAGLE_LATERAL','CYBEX_EAGLE_AB','CYBEX_EAGLE_BACK_EXT','CYBEX_EAGLE_TORSO'])
  on conflict (gym_id, machine_id) do update set qty=excluded.qty, brand=excluded.brand,
    model_name=excluded.model_name, supports_unilateral=excluded.supports_unilateral, metadata=excluded.metadata;

  insert into price_plans(id, gym_id, trainer_id, kind, name, months, sessions, valid_days, metadata, price, list_price, terms, is_active)
  values
    (v_membership_plan, v_gym, null, 'membership', '6개월 회원권', 6, null, null, '{}', 390000, 480000, '운동복·락커 별도. 휴회 최대 30일.', true),
    (v_pt_plan, v_gym, v_trainer, 'pt', '박서연 트레이너 PT 10회', null, 10, null, '{}', 650000, 750000, '회당 50분. 당일 취소 1회 차감.', true),
    (v_day_plan, v_gym, null, 'daily', '일일 이용권', null, null, 1, '{"valid_hours":24,"reentry_allowed":false}', 15000, 15000, '결제일 당일 1회 입장. 운동복·수건 포함.', true)
  on conflict (id) do update set price=excluded.price, list_price=excluded.list_price, valid_days=excluded.valid_days, metadata=excluded.metadata, terms=excluded.terms, is_active=true;

  insert into memberships(id, member_id, gym_id, plan_id, registered_by, paid_amount, starts_on, ends_on, is_active)
  values (v_membership, v_member, v_gym, v_membership_plan, v_owner, 390000, current_date-45, current_date+135, true)
  on conflict (id) do update set ends_on=excluded.ends_on, is_active=true;

  insert into pt_ledger(id, plan_id, paid_amount, registered_by, member_id, trainer_id, gym_id, total_sessions, used_sessions, expires_on)
  values (v_ledger, v_pt_plan, 650000, v_owner, v_member, v_trainer, v_gym, 10, 3, current_date+120)
  on conflict (id) do update set used_sessions=3, expires_on=excluded.expires_on;

  insert into routines(id, author_id, gym_id, title, level, goal, days_per_week, is_template, is_public, origin, body)
  values (v_routine, v_trainer, v_gym, '초보자 전신 A · 머신 중심', 1, 'hypertrophy', 3, false, false, 'trainer',
    '{"days":[{"day_index":0,"name":"전신 A","items":[
      {"code":"LEG_PRESS_EX","name":"레그프레스","sets":3,"reps":12,"rest":90},
      {"code":"CHEST_PRESS_M","name":"체스트 프레스","sets":3,"reps":10,"rest":90},
      {"code":"LAT_PULLDOWN_W","name":"케이블 랫 풀다운","sets":3,"reps":10,"rest":90},
      {"code":"LEG_CURL_EX","name":"레그 컬","sets":3,"reps":12,"rest":75},
      {"code":"CABLE_FACE_PULL","name":"페이스 풀","sets":2,"reps":15,"rest":60}
    ]}]}'::jsonb)
  on conflict (id) do update set body=excluded.body, updated_at=now();

  insert into assignments(id, trainer_id, member_id, routine_id, due_date, note, body)
  values (v_assignment, v_trainer, v_member, v_routine, current_date+5,
    '지난 수업 중량으로 시작하고, 모든 세트를 편한 자세로 마치면 다음 운동 때 2.5~5kg 올려보세요.',
    '{"source":"last_workout","sent_as":"homework"}'::jsonb)
  on conflict (id) do update set due_date=excluded.due_date, note=excluded.note, done_at=null;

  insert into threads(id, kind, gym_id, trainer_id, member_id) values (v_thread, 'pt', v_gym, v_trainer, v_member)
  on conflict (id) do update set gym_id=excluded.gym_id;

  insert into messages(id, thread_id, sender_id, body, created_at) values
    ('44444444-4444-4444-4444-444444444451', v_thread, v_trainer, '오늘 수업 기록과 숙제 루틴을 보냈어요. 무릎이 불편하면 바로 앱으로 알려주세요.', now()-interval '1 day'),
    ('44444444-4444-4444-4444-444444444452', v_thread, v_member, '확인했습니다. 지난 기록 중량부터 시작할게요!', now()-interval '23 hours'),
    ('44444444-4444-4444-4444-444444444453', v_thread, v_trainer, '좋아요. 운동 후 식사 사진도 대화방에 올려주세요.', now()-interval '22 hours')
  on conflict (id) do update set body=excluded.body;

  insert into bookings(id, ledger_id, trainer_id, member_id, gym_id, starts_at, ends_at, status, member_memo)
  values ('44444444-4444-4444-4444-444444444460', v_ledger, v_trainer, v_member, v_gym,
    date_trunc('day', now()) + interval '2 days 19 hours', date_trunc('day', now()) + interval '2 days 19 hours 50 minutes',
    'confirmed', '스쿼트 자세와 무릎 상태를 봐주세요.')
  on conflict (id) do update set starts_at=excluded.starts_at, ends_at=excluded.ends_at, status='confirmed';

  insert into payment_orders(id, member_id, gym_id, plan_id, order_name, amount, status, provider, provider_order_id, paid_at)
  values ('44444444-4444-4444-4444-444444444470', v_member, v_gym, v_membership_plan,
    '6개월 회원권', 390000, 'paid', 'demo', 'sst_demo_membership', now()-interval '45 days')
  on conflict (id) do update set status='paid', paid_at=excluded.paid_at;
end $$;

select 'GymLink SST demo ready' as result;
