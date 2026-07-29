/* Supabase 클라이언트. URL/anon key 는 공개되어도 되는 값이다.
   실제 보안은 02_rls.sql 이 담당한다. service_role 키는 절대 클라이언트에 두지 않는다. */
import { createClient } from '@supabase/supabase-js';

export function makeClient(url, anonKey, opts = {}) {
  if (!url || !anonKey) {
    console.warn('[gymlink] Supabase 환경변수가 없습니다. 로컬 전용 모드로 동작합니다.');
    return null;
  }
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, ...(opts.auth || {}) },
    ...opts,
  });
}

/* ── 자주 쓰는 조회를 여기 모아 세 앱이 같은 쿼리를 쓰게 한다 ── */
export const q = {
  searchGyms: (sb, params) => sb.rpc('search_gyms', params),
  availableExercises: (sb, gymId, level = 3) =>
    sb.rpc('available_exercises', { p_gym_id: gymId, p_level: level }),
  openSlots: (sb, trainerId, from, to) =>
    sb.rpc('open_slots', { p_trainer_id: trainerId, p_from: from, p_to: to }),
  calcRefund: (sb, orderId, fault = 'consumer') =>
    sb.rpc('calc_refund', { p_order_id: orderId, p_fault: fault }),
  gymMachines: (sb, gymId) =>
    sb.from('gym_machines').select('qty,brand,note,min_step_kg,machine:machine_catalog(*)').eq('gym_id', gymId),
  myAssignments: (sb) =>
    sb.from('assignments').select('*,routine:routines(*)').order('created_at', { ascending: false }),
};
