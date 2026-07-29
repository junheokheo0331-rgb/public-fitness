-- ============================================================
--  GymLink — 01_schema.sql
--  Supabase SQL Editor 에 01 → 02 → 03 → 04 순서로 실행한다.
--  설계 원칙
--   1) 헬스장이 등록한 "실제 머신"이 루틴 생성의 1급 객체다. (핵심 차별점)
--   2) 환불액 계산은 방문판매법 계속거래 규정을 코드로 강제한다. (결제는 앱 밖)
--   3) 트레이너-회원 소통은 앱 안에 가둔다. (개인연락 우회 방지)
--   4) 회원/트레이너/관장/본사 4개 역할이 같은 DB를 다른 뷰로 본다.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis;      -- 지도 반경검색용. 미지원 시 03의 fallback 사용
create extension if not exists pg_trgm;      -- 헬스장/트레이너 이름 검색

-- ─────────────────────────────────────────────────────────────
--  0. ENUM
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type user_role      as enum ('member','trainer','owner','admin');
  create type gym_status     as enum ('draft','pending','active','suspended','closed');
  create type plan_kind      as enum ('daily','membership','pt','locker','rental');
  create type booking_status as enum ('requested','confirmed','done','cancelled','no_show');
  create type thread_kind    as enum ('pt','support','gym_notice');
  create type report_reason  as enum ('harassment','private_contact','no_show','fraud','inappropriate','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type consent_kind as enum (
    'tos',                -- 이용약관
    'privacy',            -- 개인정보 수집·이용
    'health_sensitive',   -- 민감정보(체성분) 처리 — 법 제23조 별도 동의
    'proxy_entry',        -- 트레이너 대리입력 (제3자 제공)
    'marketing'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type bc_source as enum ('manual','photo_ocr','proxy','lb_csv','api');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
--  1. 사용자
--     auth.users 는 Supabase가 관리한다. 여기엔 앱 도메인 정보만 둔다.
--     한 사람이 회원이면서 트레이너일 수 있으므로 role 은 "기본 진입 화면"을
--     결정할 뿐이고, 실제 권한은 gym_staff / trainers 행의 존재로 판정한다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role   not null default 'member',
  display_name  text        not null,
  phone         text,                     -- E.164. 노출 금지, 매칭·본인확인용
  birth_year    int,                      -- 생년월일 대신 연도만. 운동처방에 필요한 최소 정보
  sex           text check (sex in ('M','F','NA')),
  avatar_url    text,
  home_bcode    text,                     -- 행안부 법정동코드 10자리
  marketing_opt boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
--  2. 헬스장
-- ─────────────────────────────────────────────────────────────
create table if not exists public.gyms (
  id             uuid primary key default uuid_generate_v4(),
  owner_id       uuid not null references public.profiles(id) on delete restrict,
  name           text not null,
  biz_reg_no     text,                    -- 사업자등록번호. 입점 심사용
  status         gym_status not null default 'draft',
  road_address   text,
  jibun_address  text,
  detail_address text,
  bcode          text,                    -- 법정동 코드
  dong           text,                    -- '부전동' — 목록에 띄우는 동 이름                    -- 법정동코드 → 지역 필터
  lat            double precision,
  lng            double precision,
  geom           geography(Point,4326),   -- 트리거로 lat/lng에서 채운다
  phone          text,
  intro          text,
  amenities      text[] default '{}',     -- 샤워실/주차/락커/무인운영 ...
  hours          jsonb  default '{}'::jsonb,  -- {"mon":["06:00","23:00"], "hol":null}
  rating_avg     numeric(3,2) default 0,
  rating_count   int default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists gyms_geom_idx   on public.gyms using gist (geom);
create index if not exists gyms_bcode_idx  on public.gyms (bcode);
create index if not exists gyms_name_trgm  on public.gyms using gin (name gin_trgm_ops);

create table if not exists public.gym_photos (
  id        uuid primary key default uuid_generate_v4(),
  gym_id    uuid not null references public.gyms(id) on delete cascade,
  url       text not null,
  sort      int  not null default 0,
  caption   text
);

-- 관장 외 직원(데스크 등)에게 헬스장 관리 권한을 주는 테이블
create table if not exists public.gym_staff (
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  can_manage boolean not null default false,  -- 가격·머신 수정 권한
  primary key (gym_id, profile_id)
);

-- ─────────────────────────────────────────────────────────────
--  3. 기구 — 이 프로젝트의 심장
--
--     핵심 개념: 기구는 "역량(capability)"을 제공한다.
--
--     처음에는 종목마다 필요한 기구를 하나씩 못박았는데, 그러면 현실과
--     안 맞는다. 덤벨과 벤치만 있어도 수십 가지를 할 수 있고, 케이블
--     타워 하나로 핸들과 높이만 바꿔 가며 얼마든지 변형이 나온다.
--     "레그컬 머신이 있는가"는 이진값이지만 "덤벨이 있는가"는 그렇지 않다.
--
--     그래서 machine_catalog.provides 에 그 기구가 열어주는 역량을 담고,
--     exercises.requires 에 그 종목이 필요로 하는 역량을 담는다.
--     requires ⊆ (헬스장이 보유한 모든 기구의 provides 합집합) 이면 가능.
--
--     예)
--       조절식 벤치  → provides {bench_flat, bench_incline, bench_decline}
--       케이블 타워  → provides {cable_low, cable_mid, cable_high, cable_single}
--       덤벨 랙      → provides {dumbbell}
--       덤벨 벤치프레스 → requires {dumbbell, bench_flat}
--       인클라인 덤벨   → requires {dumbbell, bench_incline}
--
--     덤벨 하나 등록하면 20개 종목이 열린다. 그게 맞다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.machine_catalog (
  id            uuid primary key default uuid_generate_v4(),
  code          text unique not null,      -- 'LAT_PULLDOWN', 'DUMBBELL'
  name_ko       text not null,
  name_en       text,
  category      text not null,             -- rack/bench/cable/machine/free/cardio/etc
  provides      text[] not null default '{}',  -- 이 기구가 열어주는 역량
  is_free_weight boolean not null default false,
  -- 자유도가 높은 기구(케이블·프리웨이트)는 정해진 종목 외의 변형도 가능하다.
  -- 앱이 "변형 가능" 표시를 띄우고, 트레이너가 직접 종목을 추가할 수 있게 한다.
  is_generative boolean not null default false,
  default_step_kg numeric(5,2),            -- 보통의 최소 증량 단위 (관장이 덮어쓸 수 있다)
  aliases       text[] default '{}',       -- '랫풀다운','랫풀','풀다운'
  sort          int not null default 100
);
create index if not exists machine_catalog_cat_idx on public.machine_catalog (category);
create index if not exists machine_catalog_provides_idx
  on public.machine_catalog using gin (provides);

create table if not exists public.gym_machines (
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  machine_id uuid not null references public.machine_catalog(id) on delete restrict,
  qty        int  not null default 1 check (qty > 0),
  brand      text,                          -- 'Hammer Strength', 'Cybex'
  note       text,                          -- '중량 5kg 단위', '2.5kg 원판 없음'
  min_step_kg numeric(5,2),                 -- 이 기구의 최소 증량 단위
  max_load_kg numeric(6,2),
  updated_at timestamptz not null default now(),
  primary key (gym_id, machine_id)
);

-- ─────────────────────────────────────────────────────────────
--  3-1. 기구 사진
--     관장이 올리고 회원이 본다. 회원이 헬스장을 고를 때 "레그컬 있음"보다
--     실제 사진 한 장이 더 많은 걸 말해준다. 브랜드도, 상태도, 개수도.
--
--     실제 파일은 Supabase Storage 의 gym-photos 버킷에 있고,
--     여기엔 경로만 둔다. 정책은 02_rls.sql 아래쪽에 있다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.gym_machine_photos (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  machine_id uuid references public.machine_catalog(id) on delete cascade,
  storage_path text not null,               -- 'gym-photos/<gym_id>/<uuid>.jpg'
  caption    text,
  sort       int not null default 0,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gym_machine_photos_idx
  on public.gym_machine_photos (gym_id, machine_id, sort);

-- ─────────────────────────────────────────────────────────────
--  4. 운동 종목 — 역량에 종속된다
--
--     requires 가 빈 배열이면 맨몸 운동(어디서나 가능).
--     requires 의 역량을 헬스장이 전부 갖췄을 때만 추천된다.
--
--     is_freeform 은 "이 종목은 정해진 세팅 없이 변형해도 된다"는 표시다.
--     케이블·덤벨 종목이 여기 해당한다. 앱은 이 종목에 '변형 가능' 배지를
--     붙이고, 트레이너가 자기 버전을 만들어 회원에게 보낼 수 있게 한다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.exercises (
  id                 uuid primary key default uuid_generate_v4(),
  code               text unique not null,
  name_ko            text not null,
  name_en            text,
  pattern            text not null,  -- horizontal_push / vertical_pull / hinge / squat ...
  primary_muscles    text[] not null default '{}',
  secondary_muscles  text[] not null default '{}',

  -- 필요한 역량. machine_catalog.provides 의 값들과 맞춘다.
  requires           text[] not null default '{}',
  is_freeform        boolean not null default false,
  setup_note         text,           -- '벤치 30도', '케이블 최고 높이'

  is_compound        boolean not null default false,
  skill_level        int not null default 1 check (skill_level between 1 and 3),
  -- 통증·불편 부위. 진단명이 아니라 부위다. 병명을 받으면 의학적 판단이
  -- 개입하고 의료행위 판단 기준에 걸린다. docs/LEGAL.md 2장.
  avoid_areas        text[] default '{}',   -- 'shoulder','low_back','knee' ...
  video_url          text,
  cue_text           text
);
create index if not exists exercises_requires_idx on public.exercises using gin (requires);
create index if not exists exercises_level_idx    on public.exercises (skill_level);
create index if not exists exercises_pattern_idx  on public.exercises (pattern);

-- 트레이너가 직접 만든 변형 종목.
-- 케이블·프리웨이트는 현장에서 얼마든지 변형된다. 표준 목록에 없다고
-- 못 쓰게 하면 트레이너가 앱을 안 쓴다.
create table if not exists public.custom_exercises (
  id          uuid primary key default uuid_generate_v4(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  gym_id      uuid references public.gyms(id) on delete set null,
  base_code   text,                  -- 원본 종목 코드 (있으면)
  name_ko     text not null,
  pattern     text not null,
  requires    text[] not null default '{}',
  setup_note  text,
  is_compound boolean not null default false,
  skill_level int not null default 2 check (skill_level between 1 and 3),
  avoid_areas text[] default '{}',
  is_shared   boolean not null default false,   -- 같은 헬스장 트레이너와 공유
  created_at  timestamptz not null default now()
);
create index if not exists custom_exercises_author_idx
  on public.custom_exercises (author_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
--  5. 트레이너
-- ─────────────────────────────────────────────────────────────
create table if not exists public.trainers (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  primary_gym_id uuid references public.gyms(id) on delete set null,
  headline      text,                       -- '재활 전문 8년차'
  bio           text,
  specialties   text[] not null default '{}', -- rehab / diet / contest / posture / senior / rehab_ortho
  years         int default 0,
  is_public     boolean not null default false,
  accepts_new   boolean not null default true,
  rating_avg    numeric(3,2) default 0,
  rating_count  int default 0,
  created_at    timestamptz not null default now()
);
create index if not exists trainers_spec_idx on public.trainers using gin (specialties);

-- 포트폴리오 = 자격증 / 경력 / 대회 / 사례. 본사 검증 플래그가 붙는다.
create table if not exists public.trainer_credentials (
  id          uuid primary key default uuid_generate_v4(),
  trainer_id  uuid not null references public.trainers(profile_id) on delete cascade,
  kind        text not null check (kind in ('cert','career','award','education','case')),
  title       text not null,
  issuer      text,
  started_on  date,
  ended_on    date,
  file_url    text,
  verified_at timestamptz,                 -- 본사가 원본 확인한 시각. NULL이면 '미검증' 배지
  verified_by uuid references public.profiles(id),
  sort        int not null default 0
);

-- 예약 가능 시간대 (미용실 예약 방식). weekday 0=일
create table if not exists public.trainer_availability (
  id           uuid primary key default uuid_generate_v4(),
  trainer_id   uuid not null references public.trainers(profile_id) on delete cascade,
  weekday      int  not null check (weekday between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  slot_minutes int  not null default 50,
  check (start_time < end_time)
);
create table if not exists public.trainer_time_off (
  id         uuid primary key default uuid_generate_v4(),
  trainer_id uuid not null references public.trainers(profile_id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text
);

-- ─────────────────────────────────────────────────────────────
--  6. 가격 정보 · 계약
--     ※ MVP는 앱에서 결제를 받지 않는다. 결제는 헬스장에서 대면으로
--       이뤄지고, 앱은 (1) 가격을 투명하게 보여주고 (2) 계약 조건을
--       기록해 (3) 해지 시 환불액을 계산해주는 역할만 한다.
--       근거: docs/RESEARCH.pdf 3장(전자금융거래법), 6장(MVP 범위).
--     ※ 플랫폼이 대금을 직접 수취해 수수료를 떼고 정산하면 전자금융거래법상
--       전자지급결제대행업 등록 대상이 된다. 그 구조를 아예 만들지 않는다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.price_plans (
  id          uuid primary key default uuid_generate_v4(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  trainer_id  uuid references public.trainers(profile_id) on delete cascade, -- PT면 채움
  kind        plan_kind not null,
  name        text not null,
  months      int,                  -- 회원권
  sessions    int,                  -- PT 횟수
  price       int  not null check (price >= 0),   -- 원 단위 정수. 부동소수 금지
  list_price  int,                  -- 정가(할인 표기용)
  is_active   boolean not null default true,
  terms       text,                 -- 이 상품 고유 약관
  created_at  timestamptz not null default now()
);
create index if not exists price_plans_gym_idx on public.price_plans (gym_id, kind, is_active);

-- ─────────────────────────────────────────────────────────────
--  6-1. 동의 원장
--     개인정보보호법 제23조: 건강에 관한 정보(체성분)는 민감정보이고,
--     다른 개인정보 처리 동의와 "별도로" 동의를 받아야 한다.
--     트레이너 대리입력은 회원 → 헬스장 → 우리로 정보가 흐르므로
--     제3자 제공 동의가 하나 더 필요하다. 그 증적을 여기에 남긴다.
--     동의는 수정하지 않는다. 철회하면 revoked_at 을 찍고 새 행을 만든다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.consents (
  id          uuid primary key default uuid_generate_v4(),
  subject_id  uuid not null references public.profiles(id) on delete cascade, -- 정보주체
  kind        consent_kind not null,
  version     text not null,            -- 'v1.0' — 약관 개정 시 재동의 판정용
  granted     boolean not null,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  scope       jsonb not null default '{}'::jsonb,  -- { gym_id, trainer_id, purpose }
  ua          text,                     -- 동의 시점 User-Agent (증적)
  created_at  timestamptz not null default now()
);
create index if not exists consents_subject_idx
  on public.consents (subject_id, kind, granted_at desc);

-- ─────────────────────────────────────────────────────────────
--  7. 회원권 / PT 세션 원장
--     결제가 앱 밖에서 일어나므로, 관장이 콘솔에서 등록한다.
--     "언제부터 언제까지 얼마짜리를 끊었다"는 환불 계산의 입력값이라
--     금액과 시작일은 반드시 받는다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.memberships (
  id         uuid primary key default uuid_generate_v4(),
  member_id  uuid not null references public.profiles(id) on delete cascade,
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  plan_id    uuid references public.price_plans(id) on delete set null,
  registered_by uuid references public.profiles(id),   -- 등록한 관장/직원
  paid_amount int not null default 0,       -- 실제 결제액(현장). 환불 계산 기준
  starts_on  date not null,
  ends_on    date not null,
  is_active  boolean not null default true,
  paused_days int not null default 0,       -- 홀딩
  terminated_on date,
  created_at timestamptz not null default now()
);
create index if not exists memberships_member_idx on public.memberships (member_id, is_active);

create table if not exists public.pt_ledger (
  id            uuid primary key default uuid_generate_v4(),
  plan_id       uuid references public.price_plans(id) on delete set null,
  paid_amount   int not null default 0,
  registered_by uuid references public.profiles(id),
  member_id     uuid not null references public.profiles(id) on delete cascade,
  trainer_id    uuid not null references public.trainers(profile_id) on delete restrict,
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  total_sessions int not null,
  used_sessions  int not null default 0,
  expires_on     date,
  check (used_sessions <= total_sessions)
);

-- ─────────────────────────────────────────────────────────────
--  8. 예약
-- ─────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id          uuid primary key default uuid_generate_v4(),
  ledger_id   uuid references public.pt_ledger(id) on delete set null,
  trainer_id  uuid not null references public.trainers(profile_id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      booking_status not null default 'requested',
  member_memo text,
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  created_at  timestamptz not null default now(),
  check (starts_at < ends_at)
);
-- 같은 트레이너의 시간 겹침을 DB가 막는다. 앱 로직을 믿지 않는다.
create extension if not exists btree_gist;
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    trainer_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('requested','confirmed'));

-- ─────────────────────────────────────────────────────────────
--  9. 루틴 · 기록
--     기존 workoutapp 의 jsonb payload 구조를 계승하되,
--     "이 루틴이 어느 헬스장 머신 기준인가"를 gym_id 로 못박는다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.routines (
  id           uuid primary key default uuid_generate_v4(),
  author_id    uuid not null references public.profiles(id) on delete cascade,
  gym_id       uuid references public.gyms(id) on delete set null,  -- 머신 기준 헬스장
  title        text not null,
  level        int  not null default 1 check (level between 1 and 3),
  goal         text,                       -- strength / hypertrophy / fatloss / rehab
  days_per_week int default 3,
  is_template  boolean not null default false,  -- 관장의 '추천 운동 오마카세'
  is_public    boolean not null default false,
  -- 이 루틴이 어디서 왔는가. 회원이 "누가 짜준 건지" 알아야 한다.
  origin       text not null default 'auto'
               check (origin in ('auto','trainer','owner','member','copy')),
  source_routine_id uuid references public.routines(id) on delete set null,
  body         jsonb not null default '{}'::jsonb,  -- 일자별 종목/세트 구조
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists routines_author_idx on public.routines (author_id, updated_at desc);
create index if not exists routines_gym_idx on public.routines (gym_id, is_template, is_public);

-- 트레이너가 회원에게 보내는 숙제/알림장
create table if not exists public.assignments (
  id          uuid primary key default uuid_generate_v4(),
  trainer_id  uuid not null references public.trainers(profile_id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  routine_id  uuid references public.routines(id) on delete set null,
  booking_id  uuid references public.bookings(id) on delete set null, -- PT 직후 알림장
  due_date    date,
  note        text,
  body        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists assignments_member_idx on public.assignments (member_id, created_at desc);

-- 날짜 단위 운동 로그. 기기 두 대를 써도 충돌하지 않는 구조.
create table if not exists public.workout_logs (
  member_id  uuid not null references public.profiles(id) on delete cascade,
  log_date   date not null,
  gym_id     uuid references public.gyms(id) on delete set null,
  payload    jsonb not null,      -- { "exercises":[{code,sets:[{w,reps,rir}]}] }
  updated_at timestamptz not null default now(),
  primary key (member_id, log_date)
);
create index if not exists workout_logs_date_idx on public.workout_logs (member_id, log_date desc);

-- 종목별 최신 추정 1RM. 루틴 생성기가 매번 전체 로그를 훑지 않도록 캐시한다.
create table if not exists public.exercise_stats (
  member_id     uuid not null references public.profiles(id) on delete cascade,
  exercise_code text not null,
  e1rm          numeric(6,2),
  best_weight   numeric(6,2),
  best_reps     int,
  last_done_on  date,
  updated_at    timestamptz not null default now(),
  primary key (member_id, exercise_code)
);

-- ─────────────────────────────────────────────────────────────
-- 10. 체성분
--
--     ★ 결과지 이미지는 서버에 저장하지 않는다. ★
--     사진은 사용자 기기 안에서만 OCR 로 읽고, 숫자만 여기에 들어온다.
--     이미지를 보관하지 않으면 유출 시 노출되는 민감정보의 양이
--     "숫자 몇 개"로 줄어든다. 저장할 이유가 없으므로 컬럼을 두지 않았다.
--
--     source 값의 의미
--       manual    회원이 숫자를 직접 입력
--       photo_ocr 회원이 결과지를 촬영 → 기기 내 OCR → 숫자만 전송
--       proxy     트레이너가 회원 대신 입력 (제3자 제공 동의 필수)
--       lb_csv    헬스장 PC의 LB120 CSV 폴더 감시 에이전트
--       api       LookinBody Web API (유료. 미사용)
--
--     특정 제조사명을 컬럼·값·UI 어디에도 쓰지 않는다.
--     "인바디 연동"이라고 표기하면 제휴 관계 오인으로 상표 문제가 된다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.body_composition (
  id           uuid primary key default uuid_generate_v4(),
  member_id    uuid not null references public.profiles(id) on delete cascade,
  gym_id       uuid references public.gyms(id) on delete set null,
  measured_at  timestamptz not null,
  source       bc_source not null default 'manual',

  -- 대리입력 추적. entered_by 가 member_id 와 다르면 반드시 consent_id 가 있어야 한다.
  entered_by   uuid references public.profiles(id) on delete set null,
  consent_id   uuid references public.consents(id) on delete set null,

  weight_kg          numeric(5,2),
  skeletal_muscle_kg numeric(5,2),
  body_fat_kg        numeric(5,2),
  body_fat_pct       numeric(4,1),
  bmr_kcal           int,
  height_cm          numeric(5,1),

  -- OCR 신뢰도. 낮으면 앱이 "확인해주세요"를 띄운다.
  ocr_confidence numeric(3,2),
  verified_by_member boolean not null default false,

  created_at   timestamptz not null default now(),
  unique (member_id, measured_at, source),

  -- 대리입력인데 동의 근거가 없으면 아예 안 들어간다. 앱 로직을 믿지 않는다.
  constraint bc_proxy_needs_consent check (
    entered_by is null or entered_by = member_id or consent_id is not null
  ),
  check (weight_kg  is null or weight_kg  between 20 and 300),
  check (body_fat_pct is null or body_fat_pct between 1 and 70)
);
create index if not exists body_composition_member_idx
  on public.body_composition (member_id, measured_at desc);

-- ─────────────────────────────────────────────────────────────
-- 11. 앱 내 소통 — 개인연락 우회 방지의 핵심
--     번호/카톡ID 패턴은 03_functions.sql 의 트리거가 마스킹한다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.threads (
  id         uuid primary key default uuid_generate_v4(),
  kind       thread_kind not null default 'pt',
  gym_id     uuid references public.gyms(id) on delete cascade,
  trainer_id uuid references public.trainers(profile_id) on delete cascade,
  member_id  uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (kind, trainer_id, member_id)
);
create table if not exists public.messages (
  id         uuid primary key default uuid_generate_v4(),
  thread_id  uuid not null references public.threads(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text,
  image_url  text,
  meal_analysis jsonb,      -- Gemini 식이분석 결과
  masked     boolean not null default false,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists messages_thread_idx on public.messages (thread_id, created_at desc);

create table if not exists public.reports (
  id          uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_id   uuid references public.profiles(id) on delete set null,
  thread_id   uuid references public.threads(id) on delete set null,
  reason      report_reason not null,
  detail      text,
  status      text not null default 'open',
  handled_by  uuid references public.profiles(id),
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 12. 리뷰 — 실제 등록 이력이 있는 회원만 쓸 수 있다 (02_rls.sql 에서 강제)
--     다짐의 "결제 회원만 후기"에 대응하는 장치다. 결제를 안 받으므로
--     memberships / pt_ledger 행의 존재로 자격을 판정한다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id         uuid primary key default uuid_generate_v4(),
  membership_id uuid references public.memberships(id) on delete cascade,
  ledger_id  uuid references public.pt_ledger(id) on delete cascade,
  member_id  uuid not null references public.profiles(id) on delete cascade,
  gym_id     uuid references public.gyms(id) on delete cascade,
  trainer_id uuid references public.trainers(profile_id) on delete cascade,
  rating     int  not null check (rating between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  check (membership_id is not null or ledger_id is not null),
  unique (member_id, gym_id, trainer_id)
);

-- ─────────────────────────────────────────────────────────────
-- 13. 출입 관리 연동
--     기존 헬스장은 이미 바디코디/다짐매니저/엔트로FIT 등 CRM+출입기를 쓴다.
--     우리가 출입기를 대체하려 들면 입점이 막힌다. "우리가 판 회원권을
--     그쪽 시스템에 넣어주는" 방향이 현실적이다. RESEARCH.pdf 4장.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.access_credentials (
  id          uuid primary key default uuid_generate_v4(),
  member_id   uuid not null references public.profiles(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete cascade,
  qr_secret   text not null,               -- TOTP seed. 화면 캡처 재사용 방지
  external_id text,                        -- 헬스장 CRM 측 회원번호
  synced_at   timestamptz,
  sync_method text,                        -- 'csv' | 'webhook' | 'manual'
  revoked_at  timestamptz,
  unique (member_id, gym_id)
);

create table if not exists public.checkins (
  id         uuid primary key default uuid_generate_v4(),
  member_id  uuid not null references public.profiles(id) on delete cascade,
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  entered_at timestamptz not null default now(),
  method     text not null default 'qr'
);
create index if not exists checkins_gym_idx on public.checkins (gym_id, entered_at desc);

-- 헬스장 CRM 으로 내보낸 명세 (엑셀 연동의 감사 로그)
create table if not exists public.roster_exports (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  row_count  int not null,
  file_url   text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 14. 감사 로그 (본사 화면용)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id         bigserial primary key,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  target     text,
  target_id  uuid,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
