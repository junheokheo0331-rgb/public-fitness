-- ============================================================
-- GymLink — 08 앱 알림
-- 예약 생성·취소 등 중요한 상태 변화를 역할별 알림함에 남긴다.
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_booking_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare member_name text;
begin
  select display_name into member_name from profiles where id = new.member_id;
  if tg_op = 'INSERT' then
    insert into notifications (user_id, type, title, body, data)
    values (
      new.trainer_id, 'booking_created', '새 PT 예약',
      coalesce(member_name, '회원') || ' 회원이 새 수업을 예약했습니다.',
      jsonb_build_object('booking_id', new.id, 'starts_at', new.starts_at, 'member_id', new.member_id)
    );
  elsif old.status is distinct from new.status and new.status = 'cancelled' then
    insert into notifications (user_id, type, title, body, data)
    values (
      new.trainer_id, 'booking_cancelled', 'PT 예약 취소',
      coalesce(member_name, '회원') || ' 회원의 예약이 취소됐습니다.',
      jsonb_build_object('booking_id', new.id, 'starts_at', new.starts_at, 'member_id', new.member_id)
    );
  end if;
  return new;
end $$;

drop trigger if exists booking_notification_trg on public.bookings;
create trigger booking_notification_trg
after insert or update of status on public.bookings
for each row execute function public.notify_booking_change();
