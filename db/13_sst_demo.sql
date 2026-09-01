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

  update profiles set role = 'owner', display_name = '이도현', phone = '010-0000-1001',
    birth_year = 1984, sex = 'M', marketing_opt = false where id = v_owner;
  update profiles set role = 'trainer', display_name = '박서연', phone = '010-0000-2001',
    birth_year = 1993, sex = 'F', marketing_opt = false where id = v_trainer;
  update profiles set role = 'member', display_name = '김지훈', phone = '010-0000-3001',
    birth_year = 1997, sex = 'M', home_bcode = '2623010300',
    home_address = '부산광역시 부산진구 전포동 (테스트 주소)', home_lat = 35.1543, home_lng = 129.0632,
    marketing_opt = false where id = v_member;

  insert into gyms (id, owner_id, name, status, road_address, dong, lat, lng, phone, intro, amenities, hours)
  values (v_gym, v_owner, '모두의짐 서면점', 'active', '부산광역시 부산진구 중앙대로 672 (테스트 주소)', '부전동',
    35.1579, 129.0594, '051-000-2026',
    '초보자가 혼자 와도 헤매지 않도록 기구별 사용 안내와 단계별 루틴을 제공하는 420평 규모의 테스트 센터입니다. Cybex Eagle 셀렉터라이즈드 라인, 프리웨이트 존, 유산소 존을 분리 운영하며 평일 저녁에는 입문자 오리엔테이션을 진행합니다.',
    array['샤워실','2시간 무료주차','운동복','개인락커','수건','정수기','스트레칭존','여성전용 탈의실','무료 와이파이'],
    '{"mon":["06:00","24:00"],"tue":["06:00","24:00"],"wed":["06:00","24:00"],"thu":["06:00","24:00"],"fri":["06:00","24:00"],"sat":["08:00","22:00"],"sun":["08:00","20:00"]}'::jsonb)
  on conflict (id) do update set owner_id=excluded.owner_id, name=excluded.name, status='active',
    road_address=excluded.road_address, dong=excluded.dong, lat=excluded.lat, lng=excluded.lng,
    phone=excluded.phone, intro=excluded.intro, amenities=excluded.amenities, hours=excluded.hours,
    rating_avg=4.82, rating_count=127;

  update gyms set biz_reg_no = '000-00-00000', detail_address = '테스트빌딩 5층',
    bcode = '2623010300', rating_avg = 4.82, rating_count = 127 where id = v_gym;

  insert into gym_staff(gym_id, profile_id, can_manage) values (v_gym, v_owner, true)
  on conflict (gym_id, profile_id) do update set can_manage=true;

  insert into trainers(profile_id, primary_gym_id, headline, bio, specialties, years, is_public, accepts_new, rating_avg, rating_count)
  values (v_trainer, v_gym, '입문자 자세교정 · 근비대 7년차',
    '처음 운동하는 분이 PT가 없는 날에도 스스로 운동할 수 있게 만드는 것이 목표입니다. 무릎과 어깨 움직임을 먼저 확인하고, 수업마다 중량·횟수·통증 메모를 남겨 다음 루틴에 반영합니다. 과한 식단 통제보다 지속 가능한 주 3회 습관을 함께 설계합니다.',
    array['입문','자세교정','근비대','다이어트'], 7, true, true, 4.93, 58)
  on conflict (profile_id) do update set primary_gym_id=excluded.primary_gym_id, headline=excluded.headline,
    bio=excluded.bio, specialties=excluded.specialties, years=excluded.years, is_public=true, accepts_new=true,
    rating_avg=excluded.rating_avg, rating_count=excluded.rating_count;

  insert into trainer_credentials(id, trainer_id, kind, title, issuer, started_on, ended_on, verified_at, verified_by, sort)
  values
    ('44444444-4444-4444-4444-444444444501', v_trainer, 'cert', '생활스포츠지도사 2급 · 보디빌딩', '문화체육관광부', '2019-05-24', null, now()-interval '2 years', v_owner, 1),
    ('44444444-4444-4444-4444-444444444502', v_trainer, 'cert', 'NSCA-CPT', 'NSCA Korea', '2020-08-14', null, now()-interval '2 years', v_owner, 2),
    ('44444444-4444-4444-4444-444444444503', v_trainer, 'education', 'FMS Level 1 과정 수료', 'Functional Movement Systems', '2022-03-11', '2022-03-12', now()-interval '1 year', v_owner, 3),
    ('44444444-4444-4444-4444-444444444504', v_trainer, 'career', '모두의짐 서면점 퍼스널 트레이너', '모두의짐 서면점', '2021-01-01', null, now()-interval '1 year', v_owner, 4),
    ('44444444-4444-4444-4444-444444444505', v_trainer, 'case', '운동 입문 회원 12주 습관 형성 코칭', 'GymLink 사례 기록', '2025-09-01', '2025-11-24', now()-interval '6 months', v_owner, 5)
  on conflict (id) do update set title=excluded.title, issuer=excluded.issuer, started_on=excluded.started_on,
    ended_on=excluded.ended_on, verified_at=excluded.verified_at, verified_by=excluded.verified_by, sort=excluded.sort;

  insert into trainer_availability(id, trainer_id, weekday, start_time, end_time, slot_minutes)
  values
    ('44444444-4444-4444-4444-444444444511', v_trainer, 1, '10:00', '13:00', 50),
    ('44444444-4444-4444-4444-444444444512', v_trainer, 1, '17:00', '22:00', 50),
    ('44444444-4444-4444-4444-444444444513', v_trainer, 2, '14:00', '22:00', 50),
    ('44444444-4444-4444-4444-444444444514', v_trainer, 3, '10:00', '13:00', 50),
    ('44444444-4444-4444-4444-444444444515', v_trainer, 3, '17:00', '22:00', 50),
    ('44444444-4444-4444-4444-444444444516', v_trainer, 4, '14:00', '22:00', 50),
    ('44444444-4444-4444-4444-444444444517', v_trainer, 5, '10:00', '20:00', 50),
    ('44444444-4444-4444-4444-444444444518', v_trainer, 6, '10:00', '16:00', 50)
  on conflict (id) do update set trainer_id=excluded.trainer_id, weekday=excluded.weekday,
    start_time=excluded.start_time, end_time=excluded.end_time, slot_minutes=excluded.slot_minutes;

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
    ('44444444-4444-4444-4444-444444444404', v_gym, null, 'membership', '1개월 회원권', 1, null, null, '{}', 99000, 120000, '운동복·락커 별도. 휴회 불가.', true),
    ('44444444-4444-4444-4444-444444444405', v_gym, null, 'membership', '3개월 회원권', 3, null, null, '{}', 240000, 300000, '운동복·락커 별도. 휴회 최대 14일.', true),
    (v_membership_plan, v_gym, null, 'membership', '6개월 회원권', 6, null, null, '{}', 390000, 480000, '운동복·락커 별도. 휴회 최대 30일.', true),
    ('44444444-4444-4444-4444-444444444406', v_gym, null, 'membership', '12개월 회원권', 12, null, null, '{}', 660000, 840000, '운동복·락커 별도. 휴회 최대 60일.', true),
    (v_pt_plan, v_gym, v_trainer, 'pt', '박서연 트레이너 PT 10회', null, 10, null, '{}', 650000, 750000, '회당 50분. 당일 취소 1회 차감.', true),
    ('44444444-4444-4444-4444-444444444407', v_gym, v_trainer, 'pt', '박서연 트레이너 PT 20회', null, 20, null, '{}', 1200000, 1400000, '회당 50분. 당일 취소 1회 차감. 유효기간 180일.', true),
    (v_day_plan, v_gym, null, 'daily', '일일 이용권', null, null, 1, '{"valid_hours":24,"reentry_allowed":false}', 15000, 15000, '결제일 당일 1회 입장. 운동복·수건 포함.', true)
  on conflict (id) do update set name=excluded.name, months=excluded.months, sessions=excluded.sessions,
    price=excluded.price, list_price=excluded.list_price, valid_days=excluded.valid_days,
    metadata=excluded.metadata, terms=excluded.terms, is_active=true;

  insert into memberships(id, member_id, gym_id, plan_id, registered_by, paid_amount, starts_on, ends_on, is_active)
  values (v_membership, v_member, v_gym, v_membership_plan, v_owner, 390000, current_date-45, current_date+135, true)
  on conflict (id) do update set ends_on=excluded.ends_on, is_active=true;

  insert into pt_ledger(id, plan_id, paid_amount, registered_by, member_id, trainer_id, gym_id, total_sessions, used_sessions, expires_on)
  values (v_ledger, v_pt_plan, 650000, v_owner, v_member, v_trainer, v_gym, 10, 3, current_date+120)
  on conflict (id) do update set used_sessions=3, expires_on=excluded.expires_on;

  insert into consents(id, subject_id, kind, version, granted, granted_at, scope, ua)
  values
    ('44444444-4444-4444-4444-444444444481', v_member, 'tos', 'v1.0', true, now()-interval '45 days', '{}', 'GymLink SST test account'),
    ('44444444-4444-4444-4444-444444444482', v_member, 'privacy', 'v1.0', true, now()-interval '45 days', '{}', 'GymLink SST test account'),
    ('44444444-4444-4444-4444-444444444483', v_member, 'health_sensitive', 'v1.0', true, now()-interval '44 days', jsonb_build_object('gym_id',v_gym), 'GymLink SST test account'),
    ('44444444-4444-4444-4444-444444444484', v_member, 'proxy_entry', 'v1.0', true, now()-interval '44 days', jsonb_build_object('gym_id',v_gym,'trainer_id',v_trainer), 'GymLink SST test account')
  on conflict (id) do update set granted=true, revoked_at=null, scope=excluded.scope;

  insert into routines(id, author_id, gym_id, title, level, goal, days_per_week, is_template, is_public, origin, body)
  values
    (v_routine, v_trainer, v_gym, '지훈님 주 3회 전신 · 4주차', 1, 'hypertrophy', 3, false, false, 'trainer',
      '{"days":[{"day_index":0,"name":"전신 A · 머신 적응","items":[
        {"code":"LEG_PRESS_EX","name":"레그프레스","sets":3,"reps":12,"rest":90},
        {"code":"CHEST_PRESS_M","name":"체스트 프레스 머신","sets":3,"reps":10,"rest":90},
        {"code":"MACHINE_LAT_PULLDOWN","name":"랫풀다운 머신","sets":3,"reps":10,"rest":90},
        {"code":"LEG_CURL_EX","name":"레그 컬","sets":3,"reps":12,"rest":75},
        {"code":"CABLE_FACE_PULL","name":"케이블 페이스 풀","sets":2,"reps":15,"rest":60}
      ]},{"day_index":1,"name":"전신 B · 프리웨이트 입문","items":[
        {"code":"DB_GOBLET_SQUAT","name":"덤벨 고블릿 스쿼트","sets":3,"reps":10,"rest":90},
        {"code":"DB_BENCH","name":"덤벨 벤치프레스","sets":3,"reps":10,"rest":90},
        {"code":"SEATED_ROW_N","name":"시티드 케이블 로우","sets":3,"reps":12,"rest":90},
        {"code":"DB_RDL","name":"덤벨 루마니안 데드리프트","sets":3,"reps":10,"rest":90},
        {"code":"PLANK","name":"플랭크","sets":3,"reps":30,"rest":45}
      ]}]}'::jsonb),
    ('44444444-4444-4444-4444-444444444431', v_owner, v_gym, '모두의짐 입문자 30분 전신', 1, 'general', 2, true, true, 'owner',
      '{"days":[{"day_index":0,"name":"30분 전신","items":[
        {"code":"TREADMILL_WALK","name":"트레드밀 빠르게 걷기","sets":1,"reps":10,"rest":30},
        {"code":"LEG_PRESS_EX","name":"레그프레스","sets":3,"reps":12,"rest":75},
        {"code":"CHEST_PRESS_M","name":"체스트 프레스 머신","sets":3,"reps":12,"rest":75},
        {"code":"MACHINE_LAT_PULLDOWN","name":"랫풀다운 머신","sets":3,"reps":12,"rest":75},
        {"code":"MACHINE_AB_CRUNCH","name":"복근 머신 크런치","sets":2,"reps":15,"rest":60}
      ]}]}'::jsonb),
    ('44444444-4444-4444-4444-444444444432', v_member, v_gym, '퇴근 후 짧은 상체', 1, 'hypertrophy', 2, false, false, 'member',
      '{"days":[{"day_index":0,"name":"상체 35분","items":[
        {"code":"CHEST_PRESS_M","name":"체스트 프레스 머신","sets":3,"reps":10,"rest":90},
        {"code":"LAT_PULLDOWN_W","name":"케이블 랫 풀다운","sets":3,"reps":10,"rest":90},
        {"code":"CABLE_LATERAL","name":"케이블 레터럴 레이즈","sets":3,"reps":15,"rest":60},
        {"code":"CABLE_TRICEPS","name":"케이블 트라이셉스 푸시다운","sets":3,"reps":12,"rest":60}
      ]}]}'::jsonb)
  on conflict (id) do update set title=excluded.title, level=excluded.level, goal=excluded.goal,
    days_per_week=excluded.days_per_week, is_template=excluded.is_template, is_public=excluded.is_public,
    origin=excluded.origin, body=excluded.body, updated_at=now();

  insert into assignments(id, trainer_id, member_id, routine_id, due_date, note, body)
  values (v_assignment, v_trainer, v_member, v_routine, current_date+5,
    '지난 수업 중량으로 시작하고, 모든 세트를 편한 자세로 마치면 다음 운동 때 2.5~5kg 올려보세요.',
    '{"source":"last_workout","sent_as":"homework"}'::jsonb)
  on conflict (id) do update set due_date=excluded.due_date, note=excluded.note, done_at=null;

  insert into threads(id, kind, gym_id, trainer_id, member_id) values (v_thread, 'pt', v_gym, v_trainer, v_member)
  on conflict (id) do update set gym_id=excluded.gym_id;

  insert into messages(id, thread_id, sender_id, body, created_at) values
    ('44444444-4444-4444-4444-444444444451', v_thread, v_trainer, '지훈님, 오늘 레그프레스는 무릎이 안쪽으로 모이지 않게 발끝 방향을 따라가 주세요. 수업 기록을 기준으로 숙제 루틴을 보냈습니다.', now()-interval '1 day'),
    ('44444444-4444-4444-4444-444444444452', v_thread, v_member, '확인했습니다. 지난 기록 중량부터 시작하고 무릎 상태도 메모할게요.', now()-interval '23 hours 50 minutes'),
    ('44444444-4444-4444-4444-444444444453', v_thread, v_trainer, '좋아요. 통증이 10점 중 3 이상이면 중량을 올리지 말고 바로 알려주세요.', now()-interval '23 hours 40 minutes'),
    ('44444444-4444-4444-4444-444444444454', v_thread, v_member, '오늘은 통증 없이 끝냈고 레그프레스 마지막 세트만 조금 힘들었습니다.', now()-interval '3 hours'),
    ('44444444-4444-4444-4444-444444444455', v_thread, v_trainer, '잘하셨어요. 다음 수업 때 자세를 확인한 뒤 중량을 5kg 올릴지 결정하겠습니다.', now()-interval '2 hours 45 minutes')
  on conflict (id) do update set body=excluded.body, created_at=excluded.created_at;

  insert into bookings(id, ledger_id, trainer_id, member_id, gym_id, starts_at, ends_at, status, member_memo)
  values ('44444444-4444-4444-4444-444444444460', v_ledger, v_trainer, v_member, v_gym,
    date_trunc('day', now()) + interval '2 days 19 hours', date_trunc('day', now()) + interval '2 days 19 hours 50 minutes',
    'confirmed', '스쿼트 자세와 무릎 상태를 봐주세요.')
  on conflict (id) do update set starts_at=excluded.starts_at, ends_at=excluded.ends_at, status='confirmed';

  insert into bookings(id, ledger_id, trainer_id, member_id, gym_id, starts_at, ends_at, status, member_memo)
  values
    ('44444444-4444-4444-4444-444444444461', v_ledger, v_trainer, v_member, v_gym,
      date_trunc('day', now()) + interval '4 days 20 hours', date_trunc('day', now()) + interval '4 days 20 hours 50 minutes',
      'requested', '퇴근이 늦을 수 있어 20시 수업을 요청합니다.'),
    ('44444444-4444-4444-4444-444444444462', v_ledger, v_trainer, v_member, v_gym,
      date_trunc('day', now()) - interval '5 days' + interval '19 hours', date_trunc('day', now()) - interval '5 days' + interval '19 hours 50 minutes',
      'done', '랫풀다운 그립과 견갑 움직임을 다시 확인하고 싶습니다.')
  on conflict (id) do update set starts_at=excluded.starts_at, ends_at=excluded.ends_at,
    status=excluded.status, member_memo=excluded.member_memo;

  insert into body_composition(id, member_id, gym_id, measured_at, source, entered_by,
    weight_kg, skeletal_muscle_kg, body_fat_kg, body_fat_pct, bmr_kcal, height_cm,
    ocr_confidence, verified_by_member)
  values
    ('44444444-4444-4444-4444-444444444491', v_member, v_gym, now()-interval '42 days', 'manual', v_member,
      78.4, 31.2, 18.9, 24.1, 1628, 176.0, null, true),
    ('44444444-4444-4444-4444-444444444492', v_member, v_gym, now()-interval '21 days', 'manual', v_member,
      77.2, 31.6, 17.8, 23.1, 1640, 176.0, null, true),
    ('44444444-4444-4444-4444-444444444493', v_member, v_gym, now()-interval '2 days', 'manual', v_member,
      76.5, 32.0, 16.9, 22.1, 1652, 176.0, null, true)
  on conflict (id) do update set measured_at=excluded.measured_at, weight_kg=excluded.weight_kg,
    skeletal_muscle_kg=excluded.skeletal_muscle_kg, body_fat_kg=excluded.body_fat_kg,
    body_fat_pct=excluded.body_fat_pct, bmr_kcal=excluded.bmr_kcal;

  insert into workout_logs(member_id, log_date, gym_id, payload)
  values
    (v_member, current_date-7, v_gym, jsonb_build_object('sessions', jsonb_build_array(jsonb_build_object(
      'id','sst-session-1','routineId',v_routine,'dayIndex',0,
      'startedAt',(current_date-7)::text || 'T19:05:00+09:00','endedAt',(current_date-7)::text || 'T19:52:00+09:00',
      'exercises',jsonb_build_array(
        jsonb_build_object('code','LEG_PRESS_EX','name','레그프레스','sets',jsonb_build_array(jsonb_build_object('w',60,'reps',12,'done',true),jsonb_build_object('w',70,'reps',12,'done',true),jsonb_build_object('w',70,'reps',10,'done',true))),
        jsonb_build_object('code','CHEST_PRESS_M','name','체스트 프레스 머신','sets',jsonb_build_array(jsonb_build_object('w',25,'reps',12,'done',true),jsonb_build_object('w',30,'reps',10,'done',true),jsonb_build_object('w',30,'reps',9,'done',true))),
        jsonb_build_object('code','MACHINE_LAT_PULLDOWN','name','랫풀다운 머신','sets',jsonb_build_array(jsonb_build_object('w',30,'reps',12,'done',true),jsonb_build_object('w',35,'reps',10,'done',true),jsonb_build_object('w',35,'reps',10,'done',true)))
      ))))),
    (v_member, current_date-3, v_gym, jsonb_build_object('sessions', jsonb_build_array(jsonb_build_object(
      'id','sst-session-2','routineId',v_routine,'dayIndex',1,
      'startedAt',(current_date-3)::text || 'T19:12:00+09:00','endedAt',(current_date-3)::text || 'T20:01:00+09:00',
      'exercises',jsonb_build_array(
        jsonb_build_object('code','DB_GOBLET_SQUAT','name','덤벨 고블릿 스쿼트','sets',jsonb_build_array(jsonb_build_object('w',16,'reps',10,'done',true),jsonb_build_object('w',18,'reps',10,'done',true),jsonb_build_object('w',18,'reps',10,'done',true))),
        jsonb_build_object('code','DB_BENCH','name','덤벨 벤치프레스','sets',jsonb_build_array(jsonb_build_object('w',10,'reps',12,'done',true),jsonb_build_object('w',12,'reps',10,'done',true),jsonb_build_object('w',12,'reps',10,'done',true))),
        jsonb_build_object('code','SEATED_ROW_N','name','시티드 케이블 로우','sets',jsonb_build_array(jsonb_build_object('w',30,'reps',12,'done',true),jsonb_build_object('w',35,'reps',12,'done',true),jsonb_build_object('w',35,'reps',11,'done',true)))
      )))))
  on conflict (member_id, log_date) do update set gym_id=excluded.gym_id, payload=excluded.payload, updated_at=now();

  insert into exercise_stats(member_id, exercise_code, e1rm, best_weight, best_reps, last_done_on)
  values
    (v_member, 'LEG_PRESS_EX', 93.33, 70, 12, current_date-7),
    (v_member, 'CHEST_PRESS_M', 40.00, 30, 10, current_date-7),
    (v_member, 'MACHINE_LAT_PULLDOWN', 46.67, 35, 10, current_date-7),
    (v_member, 'DB_GOBLET_SQUAT', 24.00, 18, 10, current_date-3),
    (v_member, 'DB_BENCH', 16.00, 12, 10, current_date-3),
    (v_member, 'SEATED_ROW_N', 49.00, 35, 12, current_date-3)
  on conflict (member_id, exercise_code) do update set e1rm=excluded.e1rm,
    best_weight=excluded.best_weight, best_reps=excluded.best_reps,
    last_done_on=excluded.last_done_on, updated_at=now();

  insert into notifications(id, user_id, type, title, body, data, read_at, created_at)
  values
    ('44444444-4444-4444-4444-444444444521', v_trainer, 'booking_created', '새 PT 예약 요청', '김지훈 회원이 4일 뒤 20시 수업을 요청했습니다.', jsonb_build_object('booking_id','44444444-4444-4444-4444-444444444461','member_id',v_member), null, now()-interval '1 hour'),
    ('44444444-4444-4444-4444-444444444522', v_member, 'routine_assigned', '새 숙제가 도착했어요', '박서연 트레이너가 4주차 전신 루틴을 보냈습니다.', jsonb_build_object('assignment_id',v_assignment,'routine_id',v_routine), now()-interval '22 hours', now()-interval '1 day')
  on conflict (id) do update set title=excluded.title, body=excluded.body, data=excluded.data,
    read_at=excluded.read_at, created_at=excluded.created_at;

  insert into payment_orders(id, member_id, gym_id, plan_id, order_name, amount, status, provider, provider_order_id, paid_at)
  values ('44444444-4444-4444-4444-444444444470', v_member, v_gym, v_membership_plan,
    '6개월 회원권', 390000, 'paid', 'demo', 'sst_demo_membership', now()-interval '45 days')
  on conflict (id) do update set status='paid', paid_at=excluded.paid_at;
end $$;

select 'GymLink SST demo ready' as result;
