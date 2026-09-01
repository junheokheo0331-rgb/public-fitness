-- ============================================================
-- GymLink — 14_api_permissions.sql
-- SQL Editor로 만든 테이블도 PostgREST(authenticated/anon)가 접근할 수
-- 있도록 기본 권한을 명시한다. 실제 행 접근은 각 테이블의 RLS가 판정한다.
-- ============================================================

grant usage on schema public to anon, authenticated;

-- 로그인 사용자는 앱 기능을 호출할 수 있어야 한다. 이 GRANT는 RLS를
-- 우회하지 않으며, 행 단위 읽기/쓰기는 02_rls.sql 정책이 계속 차단한다.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- 로그인 전 헬스장 탐색에 필요한 공개 카탈로그만 anon에 연다.
-- 여기에도 RLS가 적용된다.
grant select on table
  public.gyms,
  public.gym_photos,
  public.machine_catalog,
  public.gym_machines,
  public.gym_machine_photos,
  public.exercises,
  public.trainers,
  public.trainer_credentials,
  public.price_plans,
  public.reviews
to anon;

-- 이후 마이그레이션이 새 앱 테이블/함수를 추가해도 같은 장애가 반복되지
-- 않도록 postgres 역할의 기본 권한도 고정한다.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to authenticated;

select 'GymLink API permissions ready' as result;
