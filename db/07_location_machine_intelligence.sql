-- ============================================================
-- GymLink — 07 위치 저장·머신 상세·루틴 이동 매칭
-- 01 → 02 → 03 → 04 → 06 실행 뒤 적용한다.
-- ============================================================

-- 사용자가 명시적으로 저장한 집만 보관한다. 현재 GPS는 세션 전용이다.
alter table public.profiles add column if not exists home_address text;
alter table public.profiles add column if not exists home_lat double precision;
alter table public.profiles add column if not exists home_lng double precision;

-- 기구 종류의 기본 능력. 같은 카탈로그 기구에 공통으로 적용한다.
alter table public.machine_catalog add column if not exists movement_patterns text[] not null default '{}';
alter table public.machine_catalog add column if not exists target_muscles text[] not null default '{}';
alter table public.machine_catalog add column if not exists supports_unilateral boolean not null default false;
alter table public.machine_catalog add column if not exists grip_options text[] not null default '{}';
alter table public.machine_catalog add column if not exists adjustment_axes text[] not null default '{}';
alter table public.machine_catalog add column if not exists default_attachments text[] not null default '{}';

-- 실제 지점에 설치된 기구의 사양. 카탈로그 기본값을 지점별로 덮어쓴다.
alter table public.gym_machines add column if not exists model_name text;
alter table public.gym_machines add column if not exists supports_unilateral boolean;
alter table public.gym_machines add column if not exists custom_capabilities text[] not null default '{}';
alter table public.gym_machines add column if not exists available_attachments text[] not null default '{}';
alter table public.gym_machines add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 운동 의도를 보존해야 다른 헬스장에서 같은 의도의 종목으로 바꿀 수 있다.
alter table public.exercises add column if not exists laterality text not null default 'bilateral'
  check (laterality in ('bilateral','unilateral','either','alternating'));
alter table public.exercises add column if not exists grip_options text[] not null default '{}';
alter table public.exercises add column if not exists force_path text
  check (force_path is null or force_path in ('vertical','horizontal','diagonal','rotation','carry'));
alter table public.exercises add column if not exists body_position text;
alter table public.exercises add column if not exists substitution_group text;
alter table public.routines add column if not exists source_routine_id uuid references public.routines(id) on delete set null;
alter table public.routines add column if not exists intent_version int not null default 1;

create index if not exists machine_catalog_patterns_idx on public.machine_catalog using gin (movement_patterns);
create index if not exists machine_catalog_targets_idx on public.machine_catalog using gin (target_muscles);
create index if not exists exercises_substitution_idx on public.exercises (substitution_group);

-- 지점별 추가 능력까지 합쳐 실제 가능한 운동을 계산한다.
create or replace function public.gym_capabilities(p_gym_id uuid)
returns text[]
language sql stable as $$
  select coalesce(array_agg(distinct cap), '{}')
  from gym_machines gm
  join machine_catalog mc on mc.id = gm.machine_id
  cross join lateral unnest(mc.provides || gm.custom_capabilities) as cap
  where gm.gym_id = p_gym_id;
$$;

comment on column public.gym_machines.metadata is
  '지점 실물 사양: 좌우 독립, 가동범위, 시트/패드 조절, 케이블 높이, 그립 등 비정형 정보';
