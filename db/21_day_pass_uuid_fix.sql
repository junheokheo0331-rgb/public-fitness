-- ============================================================
-- GymLink — 21_day_pass_uuid_fix.sql
-- security definer 함수에서 extensions 스키마에 의존하지 않도록 수정한다.
-- ============================================================

create or replace function public.complete_demo_payment(p_order_id uuid)
returns public.payment_orders language plpgsql security definer set search_path = public as $$
declare
  v_order public.payment_orders;
  v_plan public.price_plans;
  v_membership public.memberships;
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

  if v_plan.kind in ('membership', 'daily') then
    insert into memberships(member_id, gym_id, plan_id, paid_amount, starts_on, ends_on, is_active)
    values (
      auth.uid(), v_order.gym_id, v_plan.id, v_order.amount, current_date,
      case when v_plan.kind = 'daily'
        then current_date + greatest(0, coalesce(v_plan.valid_days, 1) - 1)
        else current_date + make_interval(months => greatest(1, coalesce(v_plan.months, 1))) end,
      true
    ) returning * into v_membership;

    insert into access_credentials(member_id, gym_id, membership_id, qr_secret, sync_method)
    values (auth.uid(), v_order.gym_id, v_membership.id,
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'app')
    on conflict (member_id, gym_id) do update set
      membership_id = excluded.membership_id,
      qr_secret = excluded.qr_secret,
      sync_method = 'app',
      revoked_at = null;

    update profiles set active_gym_id = v_order.gym_id, updated_at = now()
    where id = auth.uid();
  end if;
  return v_order;
end $$;

grant execute on function public.complete_demo_payment(uuid) to authenticated;

select 'GymLink day pass UUID fix ready' as result;
