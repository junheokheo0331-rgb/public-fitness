-- GymLink 주문/결제 원장.
-- 카드번호는 절대 저장하지 않으며 PG의 결제 식별자와 상태만 보관한다.

create table if not exists public.payment_orders (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  gym_id uuid not null references public.gyms(id) on delete restrict,
  plan_id uuid not null references public.price_plans(id) on delete restrict,
  order_name text not null,
  amount int not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  provider text not null default 'toss',
  provider_order_id text unique,
  provider_payment_key text,
  failure_code text,
  failure_message text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_orders_member_idx on public.payment_orders(member_id, created_at desc);
create index if not exists payment_orders_gym_idx on public.payment_orders(gym_id, created_at desc);

alter table public.payment_orders enable row level security;
drop policy if exists payment_orders_read on public.payment_orders;
create policy payment_orders_read on public.payment_orders for select using (
  member_id = auth.uid() or public.manages_gym(gym_id) or public.is_admin()
);
drop policy if exists payment_orders_create on public.payment_orders;
create policy payment_orders_create on public.payment_orders for insert with check (
  member_id = auth.uid() and status = 'pending'
);

-- 테스트 계정만 사용할 수 있는 모의 결제 완료 함수.
-- 운영 계정의 실제 결제 완료는 서버가 PG 승인 API를 확인한 뒤 service role로 처리한다.
create or replace function public.complete_demo_payment(p_order_id uuid)
returns public.payment_orders language plpgsql security definer set search_path = public as $$
declare
  v_order public.payment_orders;
  v_plan public.price_plans;
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if v_email not like '%@gymlink.test' then raise exception 'demo accounts only'; end if;
  select * into v_order from payment_orders where id = p_order_id and member_id = auth.uid() for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'pending' then return v_order; end if;
  select * into v_plan from price_plans where id = v_order.plan_id and gym_id = v_order.gym_id and is_active;
  if not found or v_plan.price <> v_order.amount then raise exception 'plan changed'; end if;

  update payment_orders set status='paid', provider='demo', provider_order_id='demo_' || id,
    paid_at=now(), updated_at=now() where id=v_order.id returning * into v_order;

  if v_plan.kind = 'membership' then
    insert into memberships(member_id, gym_id, plan_id, paid_amount, starts_on, ends_on, is_active)
    values (auth.uid(), v_order.gym_id, v_plan.id, v_order.amount, current_date,
      current_date + make_interval(months => greatest(1, coalesce(v_plan.months, 1))), true);
  end if;
  return v_order;
end $$;
revoke all on function public.complete_demo_payment(uuid) from public;
grant execute on function public.complete_demo_payment(uuid) to authenticated;
