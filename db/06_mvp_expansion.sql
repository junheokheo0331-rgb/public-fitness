-- ============================================================
-- GymLink — 06_mvp_expansion.sql
-- 화면에 이미 존재하는 PT 매칭·고정 예약·공지 흐름의 영속 데이터.
-- 01 → 02 → 03 → 04 실행 뒤 마지막에 실행한다.
-- ============================================================

create table if not exists public.pt_requests (
  id          uuid primary key default uuid_generate_v4(),
  member_id   uuid not null references public.profiles(id) on delete cascade,
  bcode       text,
  dong        text not null,
  lat         double precision,
  lng         double precision,
  goal        text not null,
  sessions    int not null check (sessions between 1 and 100),
  budget_max  int not null check (budget_max >= 0),
  schedule    text,
  note        text,
  status      text not null default 'open' check (status in ('open','matched','closed')),
  matched_application_id uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pt_requests_open_idx on public.pt_requests (status, created_at desc);

create table if not exists public.pt_applications (
  id             uuid primary key default uuid_generate_v4(),
  request_id     uuid not null references public.pt_requests(id) on delete cascade,
  trainer_id     uuid not null references public.trainers(profile_id) on delete cascade,
  message        text not null,
  proposed_price int not null check (proposed_price >= 0),
  status         text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at     timestamptz not null default now(),
  unique (request_id, trainer_id)
);
alter table public.pt_requests drop constraint if exists pt_requests_matched_application_fk;
alter table public.pt_requests add constraint pt_requests_matched_application_fk
  foreign key (matched_application_id) references public.pt_applications(id) on delete set null;

create table if not exists public.trainer_recurring_sessions (
  id           uuid primary key default uuid_generate_v4(),
  trainer_id   uuid not null references public.trainers(profile_id) on delete cascade,
  member_id    uuid not null references public.profiles(id) on delete cascade,
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  weekday      int not null check (weekday between 0 and 6),
  start_time   time not null,
  duration_min int not null default 50 check (duration_min between 20 and 180),
  note         text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.gym_announcements (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete restrict,
  title      text not null,
  body       text not null,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  is_public  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.pt_requests enable row level security;
alter table public.pt_applications enable row level security;
alter table public.trainer_recurring_sessions enable row level security;
alter table public.gym_announcements enable row level security;

drop policy if exists pt_requests_read on public.pt_requests;
create policy pt_requests_read on public.pt_requests for select using (
  member_id = auth.uid() or status = 'open'
  or exists (select 1 from public.pt_applications a where a.request_id = pt_requests.id and a.trainer_id = auth.uid())
  or public.is_admin()
);
drop policy if exists pt_requests_insert on public.pt_requests;
create policy pt_requests_insert on public.pt_requests for insert with check (member_id = auth.uid());
drop policy if exists pt_requests_update on public.pt_requests;
create policy pt_requests_update on public.pt_requests for update
  using (member_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or public.is_admin());

drop policy if exists pt_applications_read on public.pt_applications;
create policy pt_applications_read on public.pt_applications for select using (
  trainer_id = auth.uid()
  or exists (select 1 from public.pt_requests r where r.id = request_id and r.member_id = auth.uid())
  or public.is_admin()
);
drop policy if exists pt_applications_insert on public.pt_applications;
create policy pt_applications_insert on public.pt_applications for insert with check (trainer_id = auth.uid());
drop policy if exists pt_applications_update on public.pt_applications;
create policy pt_applications_update on public.pt_applications for update
  using (trainer_id = auth.uid() or public.is_admin())
  with check (trainer_id = auth.uid() or public.is_admin());

drop policy if exists recurring_sessions_rw on public.trainer_recurring_sessions;
create policy recurring_sessions_rw on public.trainer_recurring_sessions for all
  using (trainer_id = auth.uid() or member_id = auth.uid() or public.manages_gym(gym_id) or public.is_admin())
  with check (trainer_id = auth.uid() or public.manages_gym(gym_id) or public.is_admin());

drop policy if exists gym_announcements_read on public.gym_announcements;
create policy gym_announcements_read on public.gym_announcements for select using (
  is_public or public.works_at_gym(gym_id) or public.is_admin()
);
drop policy if exists gym_announcements_write on public.gym_announcements;
create policy gym_announcements_write on public.gym_announcements for all
  using (public.manages_gym(gym_id) or public.is_admin())
  with check (public.manages_gym(gym_id) or public.is_admin());

-- 회원이 제안을 선택하는 순간을 한 트랜잭션으로 묶는다. 화면에서 여러 update를
-- 보내면 중간 실패로 두 명이 accepted가 될 수 있으므로 서버가 판정한다.
create or replace function public.select_pt_application(
  p_request_id uuid,
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r pt_requests%rowtype;
  a pt_applications%rowtype;
  thread_id uuid;
begin
  select * into r from pt_requests where id = p_request_id for update;
  if r.id is null or r.member_id <> auth.uid() or r.status <> 'open' then
    raise exception '선택할 수 없는 PT 요청입니다';
  end if;

  select * into a from pt_applications
    where id = p_application_id and request_id = p_request_id;
  if a.id is null then raise exception '제안서를 찾을 수 없습니다'; end if;

  update pt_applications set status = case when id = a.id then 'accepted' else 'rejected' end
    where request_id = p_request_id and status = 'pending';
  update pt_requests set status = 'matched', matched_application_id = a.id, updated_at = now()
    where id = p_request_id;

  insert into threads (kind, trainer_id, member_id)
  values ('pt', a.trainer_id, r.member_id)
  on conflict (kind, trainer_id, member_id) do update set trainer_id = excluded.trainer_id
  returning id into thread_id;

  return jsonb_build_object('request_id', r.id, 'application_id', a.id, 'thread_id', thread_id);
end $$;

revoke all on function public.select_pt_application(uuid, uuid) from public;
grant execute on function public.select_pt_application(uuid, uuid) to authenticated;
