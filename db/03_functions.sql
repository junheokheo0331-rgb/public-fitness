-- ============================================================
--  GymLink — 03_functions.sql
--  비즈니스 규칙 중 "절대 클라이언트를 믿으면 안 되는 것"만 DB에 둔다.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  1. lat/lng → geom 자동 동기화
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_gym_geom()
returns trigger language plpgsql as $$
begin
  if new.lat is not null and new.lng is not null then
    new.geom := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists gyms_geom_trg on public.gyms;
create trigger gyms_geom_trg before insert or update on public.gyms
  for each row execute function public.sync_gym_geom();

-- ─────────────────────────────────────────────────────────────
--  2. 지도 기반 헬스장 검색
--     "이 머신이 있는 곳만" 필터가 이 서비스의 차별점이다.
--     p_machines 에 machine_catalog.code 배열을 넘기면
--     그 기구를 전부 보유한 헬스장만 나온다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.search_gyms(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_m   int     default 3000,
  p_machines   text[]  default null,
  p_max_price  int     default null,   -- 1개월 회원권 기준 상한
  p_specialty  text    default null,   -- 트레이너 전문분야 보유 여부
  p_sort       text    default 'distance',  -- distance | price | rating
  p_limit      int     default 30
)
returns table (
  id uuid, name text, road_address text, lat double precision, lng double precision,
  distance_m double precision, rating_avg numeric, rating_count int,
  min_month_price int, machine_count int, thumb_url text
)
language sql stable as $$
  with base as (
    select g.id, g.name, g.road_address, g.lat, g.lng,
           st_distance(g.geom, st_setsrid(st_makepoint(p_lng, p_lat),4326)::geography) as distance_m,
           g.rating_avg, g.rating_count,
           (select min(pp.price) from price_plans pp
              where pp.gym_id = g.id and pp.kind = 'membership'
                and pp.months = 1 and pp.is_active) as min_month_price,
           (select count(*)::int from gym_machines gm where gm.gym_id = g.id) as machine_count,
           (select ph.url from gym_photos ph where ph.gym_id = g.id order by ph.sort limit 1) as thumb_url
    from gyms g
    where g.status = 'active'
      and g.geom is not null
      and st_dwithin(g.geom, st_setsrid(st_makepoint(p_lng, p_lat),4326)::geography, p_radius_m)
  )
  select b.* from base b
  where (p_max_price is null or (b.min_month_price is not null and b.min_month_price <= p_max_price))
    and (p_machines is null or not exists (
          select 1 from unnest(p_machines) code
          where not exists (
            select 1 from gym_machines gm
              join machine_catalog mc on mc.id = gm.machine_id
            where gm.gym_id = b.id and mc.code = code)))
    and (p_specialty is null or exists (
          select 1 from trainers t
          where t.primary_gym_id = b.id and t.is_public
            and p_specialty = any(t.specialties)))
  order by
    case when p_sort = 'price'  then b.min_month_price end asc nulls last,
    case when p_sort = 'rating' then b.rating_avg end desc nulls last,
    b.distance_m asc
  limit p_limit;
$$;

-- ─────────────────────────────────────────────────────────────
--  3. 이 헬스장에서 실제로 가능한 종목만
--     루틴 생성기는 반드시 이 함수를 통과한 목록으로만 처방한다.
--     required_machine_id 가 없으면(맨몸) 항상 포함,
--     주 기구가 없으면 alt_machine_ids 로 대체 가능한지 본다.
-- ─────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────
--  이 헬스장이 보유한 역량의 합집합.
--  기구 하나가 여러 역량을 열어주므로 unnest 후 distinct 한다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.gym_capabilities(p_gym_id uuid)
returns text[]
language sql stable as $$
  select coalesce(array_agg(distinct cap), '{}')
  from gym_machines gm
  join machine_catalog mc on mc.id = gm.machine_id
  cross join lateral unnest(mc.provides) as cap
  where gm.gym_id = p_gym_id;
$$;

-- ─────────────────────────────────────────────────────────────
--  이 헬스장에서 실제로 할 수 있는 종목.
--
--  requires <@ capabilities  — 필요 역량이 보유 역량의 부분집합인가.
--  requires 가 빈 배열이면 언제나 참(맨몸 운동).
--
--  min_step_kg 는 그 종목이 쓰는 기구들 중 가장 큰 단위를 따른다.
--  덤벨(2kg)과 벤치를 같이 쓰면 2kg 단위지만, 레그프레스(10kg)면 10kg다.
--  없는 중량을 안내하면 회원이 현장에서 못 맞춘다.
--
--  trainer 가 만든 변형 종목(custom_exercises)도 같이 나온다.
--  p_author 에 트레이너 id 를 주면 본인 것 + 같은 헬스장 공유분이 포함된다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.available_exercises(
  p_gym_id uuid,
  p_level  int default 3,
  p_author uuid default null
)
returns table (
  code text, name_ko text, pattern text,
  primary_muscles text[], is_compound boolean, skill_level int,
  requires text[], is_freeform boolean, setup_note text,
  machine_code text, machine_name text, min_step_kg numeric,
  avoid_areas text[], is_custom boolean
)
language sql stable as $$
  with caps as (
    select public.gym_capabilities(p_gym_id) as c
  ),
  -- 각 역량을 어느 기구가 채워주는지. 종목 카드에 기구 이름을 띄우는 데 쓴다.
  cap_machine as (
    select distinct on (cap) cap, mc.code as machine_code, mc.name_ko as machine_name,
           coalesce(gm.min_step_kg, mc.default_step_kg) as step
    from gym_machines gm
    join machine_catalog mc on mc.id = gm.machine_id
    cross join lateral unnest(mc.provides) as cap
    where gm.gym_id = p_gym_id
    order by cap, mc.sort
  ),
  std as (
    select e.code, e.name_ko, e.pattern, e.primary_muscles, e.is_compound,
           e.skill_level, e.requires, e.is_freeform, e.setup_note,
           e.avoid_areas, false as is_custom
    from exercises e, caps
    where e.skill_level <= p_level
      and e.requires <@ caps.c
  ),
  cust as (
    select ce.id::text as code, ce.name_ko, ce.pattern,
           '{}'::text[] as primary_muscles, ce.is_compound,
           ce.skill_level, ce.requires, true as is_freeform, ce.setup_note,
           ce.avoid_areas, true as is_custom
    from custom_exercises ce, caps
    where p_author is not null
      and ce.requires <@ caps.c
      and ce.skill_level <= p_level
      and (ce.author_id = p_author
           or (ce.is_shared and ce.gym_id = p_gym_id))
  ),
  merged as (select * from std union all select * from cust)
  select m.code, m.name_ko, m.pattern, m.primary_muscles, m.is_compound,
         m.skill_level, m.requires, m.is_freeform, m.setup_note,
         cm.machine_code, cm.machine_name,
         -- 여러 기구를 쓰면 가장 거친 단위를 따른다
         (select max(x.step) from cap_machine x where x.cap = any(m.requires)) as min_step_kg,
         m.avoid_areas, m.is_custom
  from merged m
  left join lateral (
    select * from cap_machine c where c.cap = m.requires[1]
  ) cm on true
  order by m.is_compound desc, m.pattern, m.name_ko;
$$;

-- ─────────────────────────────────────────────────────────────
--  헬스장이 기구 하나를 더 들이면 종목이 몇 개 열리는가.
--  관장 화면에서 "이거 등록하면 뭐가 좋아지는지"를 보여주는 데 쓴다.
--  관장이 손을 움직이게 만드는 게 이 프로젝트의 데이터 수급 전부다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.machine_impact(p_gym_id uuid, p_machine_code text)
returns jsonb
language sql stable as $$
  with cur as (select public.gym_capabilities(p_gym_id) as c),
       add as (select mc.provides as p from machine_catalog mc where mc.code = p_machine_code),
       nxt as (select array(select distinct unnest(cur.c || add.p)) as c from cur, add)
  select jsonb_build_object(
    'machine', p_machine_code,
    'before',  (select count(*) from exercises e, cur where e.requires <@ cur.c),
    'after',   (select count(*) from exercises e, nxt where e.requires <@ nxt.c),
    'unlocks', coalesce((
      select jsonb_agg(e.name_ko order by e.is_compound desc)
      from exercises e, cur, nxt
      where e.requires <@ nxt.c and not (e.requires <@ cur.c)
    ), '[]'::jsonb)
  );
$$;

-- ─────────────────────────────────────────────────────────────
--  루틴 저장.
--  같은 제목이 있으면 덮어쓰고, 없으면 새로 만든다.
--  클라이언트가 id 를 만들어 보내지 않게 한다 — 충돌 처리를 서버에 둔다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.save_routine(
  p_gym_id  uuid,
  p_title   text,
  p_body    jsonb,
  p_goal    text default 'hypertrophy',
  p_level   int default 1,
  p_days    int default 3,
  p_routine_id uuid default null,
  p_origin  text default 'member'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;

  if p_routine_id is not null then
    update routines
       set title = p_title, body = p_body, goal = p_goal,
           level = p_level, days_per_week = p_days, updated_at = now()
     where id = p_routine_id and author_id = auth.uid()
     returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;

  insert into routines (author_id, gym_id, title, level, goal, days_per_week, body, origin)
  values (auth.uid(), p_gym_id, p_title, p_level, p_goal, p_days, p_body, p_origin)
  returning id into v_id;

  return v_id;
end $$;

-- ─────────────────────────────────────────────────────────────
--  루틴 송출 — 트레이너가 회원에게 보낸다.
--
--  루틴을 "공유"하지 않고 "복사"한다. 트레이너가 나중에 자기 루틴을
--  고쳐도 회원이 받은 것은 그대로 남아야 한다. PT 기록의 성격이 있어서
--  나중에 "그때 뭘 시켰는지"가 남아야 한다.
--
--  담당 회원이 아니면 거부한다. 화면이 아니라 여기서 막는다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.assign_routine(
  p_member_id  uuid,
  p_routine_id uuid,
  p_note       text default null,
  p_due_date   date default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_src   routines%rowtype;
  v_copy  uuid;
  v_asg   uuid;
begin
  if not public.has_pt_relation(auth.uid(), p_member_id) then
    raise exception '담당 회원이 아닙니다';
  end if;

  select * into v_src from routines where id = p_routine_id;
  if not found then raise exception '루틴을 찾을 수 없습니다'; end if;

  -- 회원 소유의 사본을 만든다. 회원이 자기 것으로 고칠 수 있어야 한다.
  insert into routines (author_id, gym_id, title, level, goal, days_per_week,
                        body, origin, source_routine_id)
  values (p_member_id, v_src.gym_id, v_src.title, v_src.level, v_src.goal,
          v_src.days_per_week, v_src.body, 'trainer', v_src.id)
  returning id into v_copy;

  insert into assignments (trainer_id, member_id, routine_id, note, due_date)
  values (auth.uid(), p_member_id, v_copy, p_note, p_due_date)
  returning id into v_asg;

  insert into audit_log (actor_id, action, target, target_id, meta)
  values (auth.uid(), 'routine.assign', 'assignments', v_asg,
          jsonb_build_object('member_id', p_member_id, 'routine_id', v_copy));

  return v_asg;
end $$;

-- ─────────────────────────────────────────────────────────────
--  관장의 추천 루틴을 회원이 자기 것으로 가져오기
-- ─────────────────────────────────────────────────────────────
create or replace function public.copy_routine(p_routine_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_src routines%rowtype; v_id uuid;
begin
  select * into v_src from routines where id = p_routine_id;
  if not found then raise exception '루틴을 찾을 수 없습니다'; end if;
  if not (v_src.is_public or v_src.is_template or v_src.author_id = auth.uid()) then
    raise exception '가져올 수 없는 루틴입니다';
  end if;

  insert into routines (author_id, gym_id, title, level, goal, days_per_week,
                        body, origin, source_routine_id)
  values (auth.uid(), v_src.gym_id, v_src.title, v_src.level, v_src.goal,
          v_src.days_per_week, v_src.body, 'copy', v_src.id)
  returning id into v_id;

  return v_id;
end $$;


-- ─────────────────────────────────────────────────────────────
--  4. 환불 계산 — 방문판매법 제31·32조 + 소비자분쟁해결기준
--     기간제: 환급액 = 총액 − (이용일수분) − (총액의 10%)
--     횟수제: 환급액 = 총액 − (사용횟수 × 회당 정가) − (총액의 10%)
--     ※ 위약금 10%는 "소비자 사정"일 때만. 사업자 귀책(폐업 등)이면 전액.
--     ※ 회당 정가는 "할인 전 정가" 기준이라는 게 사업자 관행이나,
--       분쟁 시 다투어지는 지점이다. calc_basis 에 근거를 남긴다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.calc_refund(
  p_membership_id uuid default null,
  p_ledger_id     uuid default null,
  p_as_of         date default current_date,
  p_fault         text default 'consumer'   -- consumer | business
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_total     int;
  v_from      date;
  v_to        date;
  v_gym       uuid;
  v_used_days int := 0;
  v_used_amt  int := 0;
  v_used_sess int := 0;
  v_total_sess int := 0;
  v_unit      int := 0;
  v_penalty   int := 0;
  v_refund    int;
  v_span      int;
  v_mode      text;
  v_list      int;
begin
  if (p_membership_id is null) = (p_ledger_id is null) then
    raise exception '회원권 또는 PT 원장 중 정확히 하나를 지정하세요';
  end if;

  if p_membership_id is not null then
    -- ── 기간제 (회원권) ──
    v_mode := 'period';
    select m.paid_amount, m.starts_on, m.ends_on, m.gym_id
      into v_total, v_from, v_to, v_gym
      from memberships m where m.id = p_membership_id;
    if not found then raise exception 'membership not found'; end if;

    v_span      := greatest((v_to - v_from) + 1, 1);
    v_used_days := least(greatest((p_as_of - v_from) + 1, 0), v_span);
    v_used_amt  := round(v_total::numeric * v_used_days / v_span)::int;
  else
    -- ── 횟수제 (PT) ──
    v_mode := 'sessions';
    select l.paid_amount, l.total_sessions, l.used_sessions, l.gym_id,
           pp.list_price
      into v_total, v_total_sess, v_used_sess, v_gym, v_list
      from pt_ledger l
      left join price_plans pp on pp.id = l.plan_id
      where l.id = p_ledger_id;
    if not found then raise exception 'pt_ledger not found'; end if;

    -- 회당 단가: 할인 전 정가가 있으면 정가 기준이 사업자 관행이나
    -- 분쟁에서 다투어지는 지점이다. 둘 다 계산해 근거에 남긴다.
    v_unit     := coalesce(v_list, v_total) / greatest(v_total_sess, 1);
    v_used_amt := v_used_sess * v_unit;
  end if;

  if p_fault = 'consumer' then
    v_penalty := round(v_total * 0.10)::int;
  else
    v_penalty := 0;   -- 사업자 귀책(폐업·시설 하자 등)이면 위약금 없음
  end if;

  v_refund := greatest(v_total - v_used_amt - v_penalty, 0);

  return jsonb_build_object(
    'mode',           v_mode,
    'gym_id',         v_gym,
    'total',          v_total,
    'fault',          p_fault,
    'as_of',          p_as_of,
    'used_days',      v_used_days,
    'used_sessions',  v_used_sess,
    'unit_price',     v_unit,
    'unit_basis',     case when v_list is not null then 'list_price' else 'paid_amount' end,
    'used_amount',    v_used_amt,
    'penalty',        v_penalty,
    'refund',         v_refund,
    'legal_basis',    jsonb_build_array(
      '방문판매법 제31조 (계속거래 해지권)',
      '방문판매법 제32조 (위약금 과다청구 금지 · 강행규정)',
      '소비자분쟁해결기준 체육시설업 — 이용일수 공제 후 총액의 10% 공제'
    ),
    'disclaimer',     '참고용 계산입니다. 실제 환불액은 계약 조건과 사업자 협의에 따라 달라질 수 있습니다.',
    'calculated_at',  now()
  );
end $$;

-- ─────────────────────────────────────────────────────────────
--  4-1. 동의 확인 · 철회
--     RLS 정책에서 부르므로 stable + security definer 여야 한다.
--     "가장 최근 동의 행이 granted 이고 revoked_at 이 비어 있는가"로 판정한다.
-- ─────────────────────────────────────────────────────────────
-- has_consent() 는 RLS 정책이 참조하므로 02_rls.sql 에 정의되어 있다.


-- 철회. UPDATE 정책이 막혀 있으므로 이 함수로만 가능하다.
-- 민감정보 동의를 철회하면 체성분 기록도 함께 지운다.
-- 동의 없이 보관하는 순간 위법이므로, 유예를 두지 않는다.
create or replace function public.revoke_consent(p_kind consent_kind)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_deleted int := 0;
begin
  update consents
     set revoked_at = now()
   where subject_id = auth.uid() and kind = p_kind and revoked_at is null;

  if p_kind = 'health_sensitive' then
    delete from body_composition where member_id = auth.uid();
    get diagnostics v_deleted = row_count;
  elsif p_kind = 'proxy_entry' then
    delete from body_composition
     where member_id = auth.uid() and source = 'proxy';
    get diagnostics v_deleted = row_count;
  end if;

  insert into audit_log (actor_id, action, target_table, payload)
  values (auth.uid(), 'consent.revoke', 'consents',
          jsonb_build_object('kind', p_kind, 'purged_rows', v_deleted));

  return jsonb_build_object('kind', p_kind, 'purged_rows', v_deleted);
end $$;

-- ─────────────────────────────────────────────────────────────
--  5. 개인 연락처 우회 차단
--     "010 1234 5678", "카톡 abc", "@insta" 같은 패턴을 마스킹한다.
--     완벽한 차단은 불가능하다. 목적은 (a) 마찰을 만들고 (b) 시도한
--     사실을 로그로 남겨 신고 처리 근거를 확보하는 것이다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.mask_contacts()
returns trigger language plpgsql as $$
declare v0 text; v1 text;
begin
  v0 := coalesce(new.body, '');
  v1 := v0;
  -- 숫자 사이 구분자를 허용한 휴대폰 패턴
  v1 := regexp_replace(v1, '01[016789][^0-9a-zA-Z]{0,3}[0-9]{3,4}[^0-9a-zA-Z]{0,3}[0-9]{4}',
                       '[연락처 차단]', 'g');
  -- 카톡/인스타 아이디 유도
  v1 := regexp_replace(v1, '(카톡|카카오톡|카카오|kakao|오픈챗|텔레|텔레그램|telegram|인스타|insta)[^\n]{0,20}',
                       '[외부채널 차단]', 'gi');
  v1 := regexp_replace(v1, '@[A-Za-z0-9._]{4,30}', '[아이디 차단]', 'g');

  if v1 <> v0 then
    new.body   := v1;
    new.masked := true;
    insert into audit_log(actor_id, action, target, target_id, meta)
    values (new.sender_id, 'message.masked', 'messages', new.id,
            jsonb_build_object('thread_id', new.thread_id));
  end if;
  return new;
end $$;

drop trigger if exists messages_mask_trg on public.messages;
create trigger messages_mask_trg before insert on public.messages
  for each row execute function public.mask_contacts();

-- ─────────────────────────────────────────────────────────────
--  6. 예약 확정 시 PT 원장 차감 (원자적으로)
-- ─────────────────────────────────────────────────────────────
create or replace function public.consume_session()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' and new.ledger_id is not null then
    update pt_ledger
       set used_sessions = used_sessions + 1
     where id = new.ledger_id and used_sessions < total_sessions;
    if not found then
      raise exception '잔여 세션이 없습니다';
    end if;
  end if;
  -- no_show 도 차감한다. 단, 취소정책은 gym 별로 다르므로 여기선 기본값만.
  return new;
end $$;

drop trigger if exists bookings_consume_trg on public.bookings;
create trigger bookings_consume_trg after update on public.bookings
  for each row execute function public.consume_session();

-- ─────────────────────────────────────────────────────────────
--  7. 예약 가능 슬롯 조회
-- ─────────────────────────────────────────────────────────────
create or replace function public.open_slots(
  p_trainer_id uuid,
  p_from date,
  p_to   date
)
returns table (slot_start timestamptz, slot_end timestamptz)
language sql stable as $$
  with days as (
    select d::date as d from generate_series(p_from, p_to, interval '1 day') d
  ),
  grid as (
    select (d.d + a.start_time)::timestamptz
             + (n * make_interval(mins => a.slot_minutes)) as s,
           a.slot_minutes
    from days d
    join trainer_availability a
      on a.trainer_id = p_trainer_id and a.weekday = extract(dow from d.d)
    cross join lateral generate_series(
      0,
      (extract(epoch from (a.end_time - a.start_time)) / (a.slot_minutes*60))::int - 1
    ) n
  )
  select g.s, g.s + make_interval(mins => g.slot_minutes)
  from grid g
  where g.s > now()
    and not exists (
      select 1 from bookings b
      where b.trainer_id = p_trainer_id
        and b.status in ('requested','confirmed')
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(g.s, g.s + make_interval(mins => g.slot_minutes)))
    and not exists (
      select 1 from trainer_time_off t
      where t.trainer_id = p_trainer_id
        and tstzrange(t.starts_at, t.ends_at) && tstzrange(g.s, g.s + make_interval(mins => g.slot_minutes)))
  order by 1;
$$;

-- ─────────────────────────────────────────────────────────────
--  8. 회원가입 시 profiles 자동 생성
--     클라이언트 metadata의 role은 절대 신뢰하지 않는다. 모든 신규 계정은
--     member로 시작하고 trainer/owner/admin 승격은 본사 심사 후 서버에서만 한다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'display_name', '회원'),
          'member')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
--  9. 평점 재계산
-- ─────────────────────────────────────────────────────────────
create or replace function public.recalc_rating()
returns trigger language plpgsql as $$
declare g uuid; t uuid;
begin
  g := coalesce(new.gym_id, old.gym_id);
  t := coalesce(new.trainer_id, old.trainer_id);
  if g is not null then
    update gyms set
      rating_avg   = coalesce((select round(avg(rating),2) from reviews where gym_id = g),0),
      rating_count = (select count(*) from reviews where gym_id = g)
    where id = g;
  end if;
  if t is not null then
    update trainers set
      rating_avg   = coalesce((select round(avg(rating),2) from reviews where trainer_id = t),0),
      rating_count = (select count(*) from reviews where trainer_id = t)
    where profile_id = t;
  end if;
  return null;
end $$;

drop trigger if exists reviews_rating_trg on public.reviews;
create trigger reviews_rating_trg after insert or update or delete on public.reviews
  for each row execute function public.recalc_rating();
