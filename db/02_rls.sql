-- ============================================================
--  GymLink — 02_rls.sql
--  이 파일이 앱의 실질적인 보안 경계다.
--  anon key 는 공개되어도 무방하다는 전제가 여기서 성립한다.
--  ⚠ 새 테이블을 추가하면 반드시 이 파일에도 정책을 추가할 것.
--    RLS를 켜고 정책을 안 쓰면 "아무도 못 읽는" 상태가 되고,
--    RLS를 안 켜면 "누구나 다 읽는" 상태가 된다. 후자가 사고다.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  헬퍼 함수 — 정책 안에서 재귀 조회가 일어나지 않도록
--  security definer 로 감싼다. (RLS 무한재귀는 흔한 함정이다)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.manages_gym(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from gyms where id = g and owner_id = auth.uid())
      or exists (select 1 from gym_staff where gym_id = g and profile_id = auth.uid() and can_manage);
$$;

create or replace function public.works_at_gym(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.manages_gym(g)
      or exists (select 1 from gym_staff where gym_id = g and profile_id = auth.uid())
      or exists (select 1 from trainers where profile_id = auth.uid() and primary_gym_id = g);
$$;

-- 이 트레이너와 이 회원이 "관계"인가 (PT 원장 또는 예약 이력)
create or replace function public.has_pt_relation(t uuid, m uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pt_ledger where trainer_id = t and member_id = m)
      or exists (select 1 from bookings  where trainer_id = t and member_id = m);
$$;


-- 동의 판정. 체성분 정책이 이 함수에 의존한다.
-- "가장 최근 동의 행이 granted 이고 철회되지 않았는가"
create or replace function public.has_consent(p_subject uuid, p_kind consent_kind)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.granted and c.revoked_at is null
      from consents c
     where c.subject_id = p_subject and c.kind = p_kind
     order by c.granted_at desc
     limit 1
  ), false);
$$;

-- ─────────────────────────────────────────────────────────────
--  RLS 일괄 활성화
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','gyms','gym_photos','gym_staff','machine_catalog','gym_machines',
    'gym_machine_photos','custom_exercises',
    'exercises','trainers','trainer_credentials','trainer_availability','trainer_time_off',
    'price_plans','consents','memberships','pt_ledger',
    'bookings','routines','assignments','workout_logs','exercise_stats','body_composition',
    'threads','messages','reports','reviews','access_credentials','checkins',
    'roster_exports','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
--  1. profiles — 본인 + 관계자만
-- ─────────────────────────────────────────────────────────────
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (
  id = auth.uid()
  or public.is_admin()
  -- 트레이너는 자기 고객만 본다
  or exists (select 1 from trainers t where t.profile_id = auth.uid()
             and public.has_pt_relation(auth.uid(), profiles.id))
  -- 관장은 자기 헬스장 회원만 본다
  or exists (select 1 from memberships ms
             where ms.member_id = profiles.id and public.manages_gym(ms.gym_id))
);
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────
--  2. 공개 카탈로그 — 로그인만 하면 읽을 수 있다
-- ─────────────────────────────────────────────────────────────
drop policy if exists gyms_read on public.gyms;
create policy gyms_read on public.gyms for select
  using (status = 'active' or public.manages_gym(id) or public.is_admin());
drop policy if exists gyms_write on public.gyms;
create policy gyms_write on public.gyms for all
  using (public.manages_gym(id) or public.is_admin())
  with check (public.manages_gym(id) or public.is_admin());
drop policy if exists gyms_insert on public.gyms;
create policy gyms_insert on public.gyms for insert with check (owner_id = auth.uid());

drop policy if exists gym_photos_rw on public.gym_photos;
create policy gym_photos_rw on public.gym_photos for all
  using (true) with check (public.manages_gym(gym_id) or public.is_admin());

drop policy if exists gym_staff_rw on public.gym_staff;
create policy gym_staff_rw on public.gym_staff for all
  using (profile_id = auth.uid() or public.manages_gym(gym_id) or public.is_admin())
  with check (public.manages_gym(gym_id) or public.is_admin());

drop policy if exists machine_catalog_read on public.machine_catalog;
create policy machine_catalog_read on public.machine_catalog for select using (true);
drop policy if exists machine_catalog_write on public.machine_catalog;
create policy machine_catalog_write on public.machine_catalog for all
  using (public.is_admin()) with check (public.is_admin());

-- 머신 목록은 누구나 본다. 이게 회원 유입의 미끼다.
drop policy if exists gym_machines_read on public.gym_machines;
create policy gym_machines_read on public.gym_machines for select using (true);
drop policy if exists gym_machines_write on public.gym_machines;
create policy gym_machines_write on public.gym_machines for all
  using (public.manages_gym(gym_id) or public.is_admin())
  with check (public.manages_gym(gym_id) or public.is_admin());

drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises for select using (true);
drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises for all
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
--  3. 트레이너
-- ─────────────────────────────────────────────────────────────
drop policy if exists trainers_read on public.trainers;
create policy trainers_read on public.trainers for select
  using (is_public or profile_id = auth.uid()
         or public.manages_gym(primary_gym_id) or public.is_admin());
drop policy if exists trainers_write on public.trainers;
create policy trainers_write on public.trainers for all
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists creds_read on public.trainer_credentials;
create policy creds_read on public.trainer_credentials for select using (
  trainer_id = auth.uid() or public.is_admin()
  or exists (select 1 from trainers t where t.profile_id = trainer_credentials.trainer_id and t.is_public)
);
drop policy if exists creds_write on public.trainer_credentials;
create policy creds_write on public.trainer_credentials for all
  using (trainer_id = auth.uid() or public.is_admin())
  with check (trainer_id = auth.uid() or public.is_admin());

drop policy if exists avail_read on public.trainer_availability;
create policy avail_read on public.trainer_availability for select using (true);
drop policy if exists avail_write on public.trainer_availability;
create policy avail_write on public.trainer_availability for all
  using (trainer_id = auth.uid() or public.is_admin())
  with check (trainer_id = auth.uid() or public.is_admin());

drop policy if exists timeoff_rw on public.trainer_time_off;
create policy timeoff_rw on public.trainer_time_off for all
  using (trainer_id = auth.uid() or public.is_admin())
  with check (trainer_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────
--  4. 가격·주문·정산
-- ─────────────────────────────────────────────────────────────
drop policy if exists plans_read on public.price_plans;
create policy plans_read on public.price_plans for select
  using (is_active or public.manages_gym(gym_id) or public.is_admin());
drop policy if exists plans_write on public.price_plans;
create policy plans_write on public.price_plans for all
  using (public.manages_gym(gym_id) or public.is_admin())
  with check (public.manages_gym(gym_id) or public.is_admin());

-- ─────────────────────────────────────────────────────────────
--  4-1. 동의 원장
--     본인 것만 읽는다. 관장·트레이너도 남의 동의 이력은 볼 수 없다.
--     동의는 INSERT 만 되고 UPDATE 는 막는다. 증적은 고쳐지면 증적이 아니다.
--     철회는 revoked_at 을 찍는 것이므로 전용 함수(revoke_consent)로만 한다.
-- ─────────────────────────────────────────────────────────────
drop policy if exists consents_read on public.consents;
create policy consents_read on public.consents for select
  using (subject_id = auth.uid() or public.is_admin());

drop policy if exists consents_insert on public.consents;
create policy consents_insert on public.consents for insert
  with check (subject_id = auth.uid());

drop policy if exists consents_update on public.consents;
create policy consents_update on public.consents for update
  using (false) with check (false);

-- ─────────────────────────────────────────────────────────────
--  5. 회원권 / 원장 / 예약
-- ─────────────────────────────────────────────────────────────
drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select
  using (member_id = auth.uid() or public.works_at_gym(gym_id) or public.is_admin());
drop policy if exists memberships_write on public.memberships;
create policy memberships_write on public.memberships for all
  using (public.manages_gym(gym_id) or public.is_admin())
  with check (public.manages_gym(gym_id) or public.is_admin());

drop policy if exists ledger_read on public.pt_ledger;
create policy ledger_read on public.pt_ledger for select
  using (member_id = auth.uid() or trainer_id = auth.uid()
         or public.manages_gym(gym_id) or public.is_admin());
drop policy if exists ledger_write on public.pt_ledger;
create policy ledger_write on public.pt_ledger for update
  using (trainer_id = auth.uid() or public.manages_gym(gym_id) or public.is_admin())
  with check (trainer_id = auth.uid() or public.manages_gym(gym_id) or public.is_admin());

drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select
  using (member_id = auth.uid() or trainer_id = auth.uid()
         or public.manages_gym(gym_id) or public.is_admin());
drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings for insert
  with check (member_id = auth.uid() or trainer_id = auth.uid());
drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update
  using (member_id = auth.uid() or trainer_id = auth.uid() or public.manages_gym(gym_id))
  with check (member_id = auth.uid() or trainer_id = auth.uid() or public.manages_gym(gym_id));

-- ─────────────────────────────────────────────────────────────
--  6. 루틴 · 숙제 · 로그
-- ─────────────────────────────────────────────────────────────
drop policy if exists routines_read on public.routines;
create policy routines_read on public.routines for select using (
  is_public or author_id = auth.uid() or public.is_admin()
  or (gym_id is not null and public.works_at_gym(gym_id))
  or exists (select 1 from assignments a where a.routine_id = routines.id and a.member_id = auth.uid())
);
drop policy if exists routines_write on public.routines;
create policy routines_write on public.routines for all
  using (author_id = auth.uid() or public.is_admin()
         or (is_template and gym_id is not null and public.manages_gym(gym_id)))
  with check (author_id = auth.uid() or public.is_admin()
         or (is_template and gym_id is not null and public.manages_gym(gym_id)));

drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments for select
  using (member_id = auth.uid() or trainer_id = auth.uid() or public.is_admin());
drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments for all
  using (trainer_id = auth.uid() or public.is_admin())
  with check (trainer_id = auth.uid() and public.has_pt_relation(auth.uid(), member_id));
-- 회원은 읽음/완료 표시만 할 수 있다
drop policy if exists assignments_member_ack on public.assignments;
create policy assignments_member_ack on public.assignments for update
  using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists logs_read on public.workout_logs;
create policy logs_read on public.workout_logs for select using (
  member_id = auth.uid() or public.is_admin()
  or (exists (select 1 from trainers t where t.profile_id = auth.uid())
      and public.has_pt_relation(auth.uid(), workout_logs.member_id))
);
drop policy if exists logs_write on public.workout_logs;
create policy logs_write on public.workout_logs for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists stats_read on public.exercise_stats;
create policy stats_read on public.exercise_stats for select using (
  member_id = auth.uid() or public.is_admin()
  or (exists (select 1 from trainers t where t.profile_id = auth.uid())
      and public.has_pt_relation(auth.uid(), exercise_stats.member_id))
);
drop policy if exists stats_write on public.exercise_stats;
create policy stats_write on public.exercise_stats for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
--  7. 체성분 — 민감정보. 본인 + 담당 트레이너까지만.
--     관장도 못 본다. 이걸 관장에게 열면 개인정보 이슈가 커진다.
-- ─────────────────────────────────────────────────────────────
-- 체성분 읽기: 본인 + 유효한 PT 관계가 있는 트레이너.
-- 관장은 못 본다. 회원 관리에 체성분이 필요한 역할이 아니다.
drop policy if exists body_read on public.body_composition;
create policy body_read on public.body_composition for select using (
  member_id = auth.uid()
  or public.is_admin()
  or (public.has_pt_relation(auth.uid(), body_composition.member_id)
      and public.has_consent(body_composition.member_id, 'proxy_entry'))
);

-- 본인 입력: 민감정보 동의가 살아 있어야 한다.
drop policy if exists body_self_write on public.body_composition;
create policy body_self_write on public.body_composition for insert with check (
  member_id = auth.uid()
  and entered_by = auth.uid()
  and public.has_consent(auth.uid(), 'health_sensitive')
);

-- 트레이너 대리입력: PT 관계 + 대리입력 동의 + consent_id 명시. 셋 다 필요하다.
drop policy if exists body_proxy_write on public.body_composition;
create policy body_proxy_write on public.body_composition for insert with check (
  entered_by = auth.uid()
  and entered_by <> member_id
  and source = 'proxy'
  and public.has_pt_relation(auth.uid(), member_id)
  and public.has_consent(member_id, 'health_sensitive')
  and public.has_consent(member_id, 'proxy_entry')
  and consent_id is not null
);

-- 수정·삭제는 정보주체 본인만. 트레이너는 자기가 넣은 것도 못 고친다.
drop policy if exists body_owner_modify on public.body_composition;
create policy body_owner_modify on public.body_composition for update
  using (member_id = auth.uid()) with check (member_id = auth.uid());
drop policy if exists body_owner_delete on public.body_composition;
create policy body_owner_delete on public.body_composition for delete
  using (member_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────
--  8. 대화 — 당사자 + 신고 처리 시 본사
-- ─────────────────────────────────────────────────────────────
drop policy if exists threads_rw on public.threads;
create policy threads_rw on public.threads for all
  using (member_id = auth.uid() or trainer_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or trainer_id = auth.uid());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select using (
  public.is_admin()
  or exists (select 1 from threads th where th.id = messages.thread_id
             and (th.member_id = auth.uid() or th.trainer_id = auth.uid()))
);
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from threads th where th.id = thread_id
              and (th.member_id = auth.uid() or th.trainer_id = auth.uid()))
);
-- 메시지 수정·삭제 없음. 분쟁 대응을 위해 원본을 보존한다.

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
--  9. 리뷰 — 실제로 등록한 사람만 쓴다
-- ─────────────────────────────────────────────────────────────
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (
  member_id = auth.uid()
  and (
    exists (select 1 from memberships m
            where m.id = membership_id and m.member_id = auth.uid())
    or exists (select 1 from pt_ledger l
               where l.id = ledger_id and l.member_id = auth.uid())
  )
);
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews for update
  using (member_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 10. 출입
-- ─────────────────────────────────────────────────────────────
drop policy if exists access_read on public.access_credentials;
create policy access_read on public.access_credentials for select
  using (member_id = auth.uid() or public.works_at_gym(gym_id) or public.is_admin());
drop policy if exists access_write on public.access_credentials;
create policy access_write on public.access_credentials for all
  using (public.manages_gym(gym_id) or public.is_admin())
  with check (public.manages_gym(gym_id) or public.is_admin());

drop policy if exists checkins_read on public.checkins;
create policy checkins_read on public.checkins for select
  using (member_id = auth.uid() or public.works_at_gym(gym_id) or public.is_admin());
drop policy if exists checkins_insert on public.checkins;
create policy checkins_insert on public.checkins for insert
  with check (member_id = auth.uid() or public.works_at_gym(gym_id));

drop policy if exists roster_rw on public.roster_exports;
create policy roster_rw on public.roster_exports for all
  using (public.manages_gym(gym_id) or public.is_admin())
  with check (public.manages_gym(gym_id) or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 11. 감사 로그 — 본사만
-- ─────────────────────────────────────────────────────────────
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select using (public.is_admin());
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert with check (auth.uid() is not null);


-- ─────────────────────────────────────────────────────────────
-- 15. 기구 사진
--     회원이 헬스장을 고를 때 보는 것이므로 읽기는 전체 공개다.
--     올리고 지우는 건 그 헬스장을 운영하는 사람만.
-- ─────────────────────────────────────────────────────────────
drop policy if exists machine_photos_read on public.gym_machine_photos;
create policy machine_photos_read on public.gym_machine_photos
  for select using (true);

drop policy if exists machine_photos_write on public.gym_machine_photos;
create policy machine_photos_write on public.gym_machine_photos for all
  using (public.manages_gym(gym_id) or public.is_admin())
  with check (public.manages_gym(gym_id) or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 16. 트레이너 변형 종목
--     케이블·프리웨이트는 현장에서 얼마든지 변형된다. 표준 목록에 없다고
--     못 쓰게 하면 트레이너가 앱을 안 쓴다. 본인 것 + 공유분만 보인다.
-- ─────────────────────────────────────────────────────────────
drop policy if exists custom_ex_read on public.custom_exercises;
create policy custom_ex_read on public.custom_exercises for select using (
  author_id = auth.uid()
  or public.is_admin()
  or (is_shared and gym_id is not null and public.works_at_gym(gym_id))
  -- 회원은 자기에게 배정된 루틴에 들어 있는 변형 종목만 본다
  or exists (
    select 1 from assignments a
    join routines r on r.id = a.routine_id
    where a.member_id = auth.uid()
      and r.body::text like '%' || custom_exercises.id::text || '%'
  )
);

drop policy if exists custom_ex_write on public.custom_exercises;
create policy custom_ex_write on public.custom_exercises for all
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid());

-- ═════════════════════════════════════════════════════════════
-- 17. Supabase Storage — 사진 버킷
--
--     이 블록은 storage 스키마를 건드린다. Supabase SQL Editor 에서는
--     그대로 실행되지만, 로컬 postgres 에는 storage 스키마가 없어 실패한다.
--     그래서 예외를 삼키고 넘어가게 감쌌다.
--
--     ※ 체성분 결과지는 여기 올리지 않는다. 이미지 자체를 서버에
--       두지 않는 게 그 기능의 설계 전제다. docs/LEGAL.md 1-2 참고.
-- ═════════════════════════════════════════════════════════════
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('gym-photos', 'gym-photos', true, 5242880,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;

  -- 누구나 본다 (헬스장 고를 때 봐야 하므로)
  execute $p$
    drop policy if exists gym_photos_public_read on storage.objects;
    create policy gym_photos_public_read on storage.objects
      for select using (bucket_id = 'gym-photos');
  $p$;

  -- 경로 첫 칸이 gym_id 다: 'gym-photos/<gym_id>/<uuid>.jpg'
  -- 그 헬스장을 운영하는 사람만 그 폴더에 쓸 수 있다.
  execute $p$
    drop policy if exists gym_photos_owner_write on storage.objects;
    create policy gym_photos_owner_write on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'gym-photos'
        and public.manages_gym((storage.foldername(name))[1]::uuid)
      );
  $p$;

  execute $p$
    drop policy if exists gym_photos_owner_delete on storage.objects;
    create policy gym_photos_owner_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'gym-photos'
        and public.manages_gym((storage.foldername(name))[1]::uuid)
      );
  $p$;
exception
  when undefined_table or invalid_schema_name or undefined_function
       or insufficient_privilege or undefined_object then
    raise notice 'storage 스키마를 찾지 못해 버킷 설정을 건너뜁니다 (Supabase 밖에서 실행 중)';
end $$;
