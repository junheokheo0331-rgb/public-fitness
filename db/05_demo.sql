-- ============================================================
--  GymLink — 05_demo.sql  (선택)
--
--  화면을 확인하기 위한 예시 헬스장 3곳을 만든다.
--  운영을 시작할 거면 이 파일은 실행하지 않으면 그만이다.
--
--  ★ 먼저 앱에서 회원가입을 하세요 ★
--  gyms.owner_id 가 실제 계정(auth.users → profiles)을 참조하므로,
--  계정이 하나도 없으면 이 스크립트는 아무것도 하지 않고 안내만 띄운다.
--
--  기본 동작: 가장 먼저 만들어진 계정을 세 헬스장의 관장으로 지정한다.
--  특정 계정을 쓰고 싶으면 아래 v_owner_email 을 채우세요.
--
--  세 곳의 기구 구성을 일부러 다르게 넣었다.
--    서면  — 프리웨이트 중심
--    전포  — 머신 위주의 작은 동네 헬스장
--    해운대 — 둘 다 갖춘 대형
--  같은 조건으로 루틴을 뽑아도 결과가 달라야 정상이다.
-- ============================================================

do $$
declare
  v_owner_email text := null;      -- ← 특정 계정을 쓰려면 여기에 이메일
  v_owner uuid;
  g1 uuid := '11111111-1111-1111-1111-111111111111';
  g2 uuid := '22222222-2222-2222-2222-222222222222';
  g3 uuid := '33333333-3333-3333-3333-333333333333';
begin
  if v_owner_email is not null then
    select p.id into v_owner from profiles p
      join auth.users u on u.id = p.id
     where u.email = v_owner_email;
  else
    select id into v_owner from profiles order by created_at limit 1;
  end if;

  if v_owner is null then
    raise notice '───────────────────────────────────────────────';
    raise notice ' 계정이 없어서 예시 데이터를 만들지 않았습니다.';
    raise notice ' 앱에서 회원가입을 한 뒤 이 파일을 다시 실행하세요.';
    raise notice '───────────────────────────────────────────────';
    return;
  end if;

  -- 헬스장
  insert into gyms (id, owner_id, name, status, road_address, bcode, dong,
                    lat, lng, phone, intro, amenities, hours)
  values
    (g1, v_owner, '서면 스트렝스짐', 'active', '부산 부산진구 서면로 000', '26230', '부전동',
     35.1579, 129.0594, '051-000-0001',
     '프리웨이트 중심. 파워랙 4대, 조절식 벤치 6대.',
     '{샤워실,주차,운동복}', '{"weekday":"05:30-24:00","weekend":"08:00-20:00"}'),
    (g2, v_owner, '전포 헬스클럽', 'active', '부산 부산진구 전포대로 000', '26230', '전포동',
     35.1521, 129.0631, '051-000-0002',
     '머신 위주의 동네 헬스장. 조용하고 붐비지 않는다.',
     '{샤워실}', '{"weekday":"06:00-23:00","weekend":"09:00-18:00"}'),
    (g3, v_owner, '해운대 바디랩', 'active', '부산 해운대구 센텀중앙로 000', '26350', '우동',
     35.1690, 129.1300, '051-000-0003',
     '24시간 운영. 머신·프리웨이트 모두 갖춤.',
     '{샤워실,주차,운동복,사우나,락커}', '{"all":"24시간"}')
  on conflict (id) do update set owner_id = excluded.owner_id;

  -- 관장 권한
  insert into gym_staff (gym_id, profile_id, can_manage)
  select g, v_owner, true from unnest(array[g1,g2,g3]) as g
  on conflict do nothing;

  -- 보유 기구 — 세 곳을 일부러 다르게
  delete from gym_machines where gym_id in (g1,g2,g3);

  insert into gym_machines (gym_id, machine_id, qty, min_step_kg)
  select g1, mc.id, 1, mc.default_step_kg from machine_catalog mc
   where mc.code = any(array[
     'POWER_RACK','SMITH','BENCH_FLAT','BENCH_ADJ','BARBELL','PLATE_SMALL',
     'EZ_BAR','DUMBBELL','KETTLEBELL','CABLE_CROSS','LAT_PULLDOWN','SEATED_ROW',
     'LEG_PRESS','LEG_EXT','LEG_CURL','HIP_ABD','DIP_STATION','PULLUP_BAR',
     'TREADMILL','CYCLE','MAT','BOX','BAND']);

  insert into gym_machines (gym_id, machine_id, qty, min_step_kg)
  select g2, mc.id, 1, mc.default_step_kg from machine_catalog mc
   where mc.code = any(array[
     'SMITH','BENCH_FLAT','LAT_PULLDOWN','SEATED_ROW','CHEST_PRESS',
     'LEG_PRESS','LEG_EXT','DUMBBELL','TREADMILL','MAT']);

  insert into gym_machines (gym_id, machine_id, qty, min_step_kg)
  select g3, mc.id, 1, mc.default_step_kg from machine_catalog mc
   where mc.category is not null;   -- 해운대는 전부 보유

  -- 가격표
  delete from price_plans where gym_id in (g1,g2,g3);
  insert into price_plans (gym_id, kind, name, months, sessions, price, list_price)
  values
    (g1, 'membership', '6개월 회원권',  6, null,  390000,  480000),
    (g1, 'membership', '3개월 회원권',  3, null,  240000,  270000),
    (g1, 'pt',         'PT 20회',    null,   20, 1200000, 1400000),
    (g2, 'membership', '3개월 회원권',  3, null,  180000,  210000),
    (g3, 'membership', '12개월 회원권',12, null,  690000,  840000),
    (g3, 'pt',         'PT 10회',    null,   10,  700000,  750000);

  raise notice '예시 헬스장 3곳을 만들었습니다. 관장 계정: %', v_owner;
end $$;


-- ─────────────────────────────────────────────────────────────
--  확인 — 세 곳의 가능 종목 수가 서로 달라야 정상이다.
-- ─────────────────────────────────────────────────────────────
select g.name                                        as 헬스장,
       (select count(*) from gym_machines m where m.gym_id = g.id) as 보유기구,
       array_length(public.gym_capabilities(g.id), 1)              as 보유역량,
       (select count(*) from public.available_exercises(g.id))     as 가능종목
from gyms g
where g.id in ('11111111-1111-1111-1111-111111111111',
               '22222222-2222-2222-2222-222222222222',
               '33333333-3333-3333-3333-333333333333')
order by 4 desc;

-- 기구 하나를 더 들이면 뭐가 열리는지:
-- select public.machine_impact('22222222-2222-2222-2222-222222222222', 'BENCH_ADJ');
-- select public.machine_impact('22222222-2222-2222-2222-222222222222', 'CABLE_CROSS');
