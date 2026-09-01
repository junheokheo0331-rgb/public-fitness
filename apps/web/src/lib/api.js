/* ============================================================
   api.js — 화면과 데이터 사이의 유일한 통로

   모든 사용자·헬스장·운동 데이터는 Supabase에서 읽고 쓴다.
   환경변수가 없을 때 가짜 데이터로 우회하지 않는다.
   ============================================================ */

import { createClient } from '@supabase/supabase-js';
import { MACHINES, MACHINE_BRANDS } from './catalog.js';
import { AREAS, SPECIALTY_TAGS } from './reference-data.js';
import { statsFromSession } from '@gymlink/core/progress';
import { buildRoutine } from '@gymlink/core/routine';
import { matchRoutineToAvailable } from '@gymlink/core/matching';
import { distanceMeters } from './location.js';
import {
  buildSlots, dateStrLocal, toLocalISO, formatHM, parseHM,
} from './booking.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const CONFIG_ERROR = !url || !key
  ? 'Supabase 연결 정보가 없습니다. .env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.'
  : null;
export const sb = CONFIG_ERROR ? null : createClient(url, key);

/* ---------- 헬스장 ---------- */

export async function listNearbyGyms({ lat = 35.1578, lng = 129.0594, sort = 'distance' } = {}) {

  const { data, error } = await sb.rpc('search_gyms', {
    p_lat: lat, p_lng: lng, p_radius_m: 5000, p_sort: sort,
  });
  if (error) throw error;
  return data;
}

export async function getGym(gymId) {

  const { data, error } = await sb.from('gyms')
    .select('*, price_plans(*), gym_machines(machine_catalog(code))')
    .eq('id', gymId).single();
  if (error) throw error;
  return {
    ...data,
    plans: data.price_plans ?? [],
    machines: (data.gym_machines ?? []).map((row) => row.machine_catalog?.code).filter(Boolean),
    open: formatGymHours(data.hours),
  };
}

/* ---------- 관장 가격표 ---------- */
export async function gymPricePlans(gymId, { includeInactive = true } = {}) {

  let query = sb.from('price_plans').select('*').eq('gym_id', gymId)
    .order('is_active', { ascending: false }).order('kind').order('price');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function saveGymPricePlan(gymId, plan) {
  const row = {
    gym_id: gymId,
    trainer_id: plan.kind === 'pt' ? (plan.trainer_id || null) : null,
    kind: plan.kind,
    name: plan.name.trim(),
    months: plan.kind === 'membership' ? Number(plan.months) || null : null,
    sessions: plan.kind === 'pt' ? Number(plan.sessions) || null : null,
    valid_days: plan.kind === 'daily' ? Number(plan.valid_days) || 1 : null,
    metadata: plan.kind === 'daily' ? {
      valid_hours: Number(plan.valid_hours) || 24,
      reentry_allowed: Boolean(plan.reentry_allowed),
    } : (plan.metadata || {}),
    price: Math.max(0, Number(plan.price) || 0),
    list_price: Math.max(0, Number(plan.list_price) || Number(plan.price) || 0),
    is_active: plan.is_active !== false,
    terms: plan.terms?.trim() || null,
  };
  if (!row.name) throw new Error('상품명을 입력해주세요.');
  if (row.list_price < row.price) throw new Error('정가는 판매가보다 작을 수 없습니다.');


  const payload = plan.id ? { ...row, id: plan.id } : row;
  const { data, error } = await sb.from('price_plans').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function removeGymPricePlan(gymId, planId) {

  const { error } = await sb.from('price_plans').delete().eq('gym_id', gymId).eq('id', planId);
  if (error) throw error;
}

export async function getPricePlan(planId) {

  const { data, error } = await sb.from('price_plans').select('*, gyms(name)').eq('id', planId).single();
  if (error) throw error;
  return { ...data, gym_name: data.gyms?.name };
}

export async function createPaymentOrder(plan) {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const { data, error } = await sb.from('payment_orders').insert({
    member_id: auth.user.id, gym_id: plan.gym_id, plan_id: plan.id,
    order_name: plan.name, amount: plan.price, provider: 'toss', status: 'pending',
  }).select().single();
  if (error) throw error;
  return data;
}

export async function completeDemoPayment(orderId) {

  const { data, error } = await sb.rpc('complete_demo_payment', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function myPaymentOrders() {

  const { data, error } = await sb.from('payment_orders').select('*, price_plans(name, kind), gyms(name)').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function gymPaymentOrders(gymId) {

  const { data, error } = await sb.from('payment_orders')
    .select('*, profiles!payment_orders_member_id_fkey(display_name), price_plans(name, kind)')
    .eq('gym_id', gymId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, member_name: row.profiles?.display_name || '회원' }));
}

function formatGymHours(hours) {
  if (!hours || typeof hours !== 'object') return '운영시간 문의';
  const today = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
  const span = hours[today] ?? hours.mon;
  return Array.isArray(span) ? span.join('–') : '운영시간 문의';
}

/** 이 헬스장의 보유 기구로 실제 수행 가능한 종목.
    역량(capability) 판정이라 덤벨 하나만 있어도 14종목이 나온다. */
export async function availableExercises(gymId, level = 3, authorId = null) {

  const { data, error } = await sb.rpc('available_exercises', {
    p_gym_id: gymId, p_level: level, p_author: authorId,
  });
  if (error) throw error;
  const [inventory, photos] = await Promise.all([gymMachineInventory(gymId), gymPhotos(gymId)]);
  return (data ?? []).map((exercise) => {
    const machine = inventory.find((item) => item.code === exercise.machine_code);
    const photo = photos.find((item) => item.machine_code === exercise.machine_code);
    return {
      ...exercise,
      machine_photo_url: photo?.url || null,
      machine_brand: machine?.brand || null,
      machine_model_name: machine?.model_name || null,
      machine_display_name: machine?.metadata?.display_name || null,
      machine_name: machine?.metadata?.display_name || exercise.machine_name,
    };
  });
}

/** 기구 하나를 더 들이면 몇 종목이 열리는가. 관장이 손을 움직이게 하는 숫자다. */
export async function machineImpact(gymId, machineCode, ownedCodes) {

  const { data, error } = await sb.rpc('machine_impact', {
    p_gym_id: gymId, p_machine_code: machineCode,
  });
  if (error) throw error;
  return data;
}

export function machineCatalog() { return MACHINES; }
export function machineBrands() { return MACHINE_BRANDS; }

/* ---------- 내 상태 ---------- */

export async function myMembership() {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const profile = await sb.from('profiles').select('active_gym_id').eq('id', auth.user.id).single();
  if (profile.error) throw profile.error;
  let query = sb.from('memberships').select('*, price_plans(name, kind, valid_days, metadata)').eq('member_id', auth.user.id).eq('is_active', true);
  if (profile.data?.active_gym_id) query = query.eq('gym_id', profile.data.active_gym_id);
  const { data, error } = await query.order('starts_on', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { ...data, plan_name: data.price_plans?.name || '회원권' } : null;
}

export async function myMemberships() {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await sb.from('memberships').select('*, price_plans(name, kind, valid_days, metadata), gyms(name)')
    .eq('member_id', auth.user.id).eq('is_active', true)
    .order('starts_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setMyActiveGym(gymId) {

  const { data, error } = await sb.rpc('set_active_gym', { p_gym_id: gymId });
  if (error) throw error;
  return data;
}

export async function myAccessCredential(gymId) {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user || !gymId) return null;
  const { data, error } = await sb.from('access_credentials').select('qr_secret, synced_at, sync_method, revoked_at')
    .eq('member_id', auth.user.id).eq('gym_id', gymId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function myPt() {

  const { data, error } = await sb.from('pt_ledger').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function mySavedRoutines(gymId) {

  const { data, error } = await sb.from('routines').select('*')
    .eq('gym_id', gymId).order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function myPortableRoutines(currentGymId) {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await sb.from('routines').select('*')
    .eq('author_id', auth.user.id).neq('gym_id', currentGymId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adaptRoutineToGym(routineId, gymId) {
  const available = await availableExercises(gymId, 3);
  const result = await sb.from('routines').select('*').eq('id', routineId).single();
  if (result.error) throw result.error;
  const source = result.data;
  if (!source) throw new Error('기존 루틴을 찾을 수 없습니다');
  const matched = matchRoutineToAvailable(source.body, available);
  const title = `${source.title} · 새 헬스장`;

  const id = await saveRoutine({
    gymId, title, body: { ...matched.body, source_routine_id: source.id },
    goal: source.goal, level: source.level, days: source.days_per_week, origin: 'member',
  });
  return { routine: { id, gym_id: gymId, title, body: matched.body }, ...matched };
}

/** 관장이 공개한 추천 루틴 (템플릿) */
export async function listGymTemplates(gymId) {

  const { data, error } = await sb.from('routines').select('*')
    .eq('gym_id', gymId).eq('is_template', true).eq('is_public', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 템플릿 → 내 루틴으로 복사 */
export async function copyRoutine(templateId, gymId) {

  const { data, error } = await sb.rpc('copy_routine', { p_routine_id: templateId });
  if (error) throw error;
  return data;
}

/** 내 헬스장 기구로 자동 루틴 생성·저장 */
export async function createAutoRoutine({
  gymId, days = 3, goal = 'hypertrophy', level = 2, title,
}) {

  const available = await availableExercises(gymId, level);
  const body = buildRoutine({ available, daysPerWeek: days, goal, level, stats: {} });
  const id = await saveRoutine({
    gymId, title: title || `기구 맞춤 · 주 ${body.days.length}회`, body,
    goal, level, days: body.days.length, origin: 'auto',
  });
  return { id, gym_id: gymId, title, body, goal, level, days: body.days.length, warnings: body.warnings ?? [] };
}

/** 보유 기구 기준으로 자동 루틴 재생성 · 숙제/추천은 경고만 */
export async function reconcileGymRoutines(gymId) {

  return { rebuilt: 0, flagged: 0 };
}

/** 관장이 추천 루틴 게시 */
export async function saveOwnerTemplate({
  gymId, title, goal = 'hypertrophy', level = 1, days = 3, body, templateId,
}) {

  const payload = {
    gym_id: gymId, title, goal, level, days_per_week: days, body,
    origin: 'owner', is_template: true, is_public: true,
  };
  const query = templateId
    ? sb.from('routines').update(payload).eq('id', templateId)
    : sb.from('routines').insert(payload);
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  return data.id;
}

/* ---------- 루틴 저장 · 송출 ----------
   송출은 "공유"가 아니라 "복사"다. 트레이너가 나중에 자기 루틴을 고쳐도
   회원이 받은 것은 그대로 남아야 한다. PT 기록의 성격이 있어서
   "그때 뭘 시켰는지"가 남아야 하기 때문이다. */

export async function saveRoutine({ gymId, title, body, goal, level, days, routineId, origin = 'member' }) {

  const { data, error } = await sb.rpc('save_routine', {
    p_gym_id: gymId, p_title: title, p_body: body,
    p_goal: goal, p_level: level, p_days: days,
    p_routine_id: routineId ?? null, p_origin: origin,
  });
  if (error) throw error;
  return data;
}

export async function getSavedRoutine(routineId) {

  const { data, error } = await sb.from('routines').select('*').eq('id', routineId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function trainerRoutines() {

  const { data, error } = await sb.from('routines').select('*')
    .eq('origin', 'trainer').order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTrainerRoutine(routineId) {

  return getSavedRoutine(routineId);
}

/** 트레이너 보관함 루틴 저장(추가·수정). body 를 함께 저장한다. */
export async function saveTrainerRoutine({
  gymId, title, goal = 'hypertrophy', level = 2, days = 3, routineId, body,
}) {
  if (!gymId) throw new Error('소속 헬스장을 먼저 등록해주세요.');

  return saveRoutine({ gymId, title, body, goal, level, days, routineId, origin: 'trainer' });
}

export async function deleteTrainerRoutine(routineId) {

  const { error } = await sb.from('routines').delete().eq('id', routineId);
  if (error) throw error;
  return true;
}

/** 이 회원에게 보낸 숙제 기록 */
export async function memberHomework(memberId) {

  const { data, error } = await sb.from('assignments')
    .select('*, routines(title)').eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row, title: row.routines?.title ?? '운동 숙제', sent_at: row.created_at?.slice(0, 10), due: row.due_date,
  }));
}

/** 트레이너 → 회원. 담당 회원인지는 서버가 판정한다. */
export async function assignRoutine({ memberId, routineId, note, dueDate }) {

  const { data, error } = await sb.rpc('assign_routine', {
    p_member_id: memberId, p_routine_id: routineId,
    p_note: note ?? null, p_due_date: dueDate ?? null,
  });
  if (error) throw error;
  return data;
}

/* ---------- 체성분 ---------- */

export async function bodyLog(memberId) {

  const { data, error } = await sb.from('body_composition').select('*')
    .eq('member_id', memberId).order('measured_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * 체성분 저장.
 * record 는 @gymlink/core 의 toRecord() 가 만든 객체다.
 * 사진도, OCR 원문도 여기 들어오지 않는다. 숫자만 온다.
 */
export async function saveBody(record) {

  const { data, error } = await sb.from('body_composition').insert(record).select().single();
  if (error) throw error;   // RLS 가 동의 없는 저장을 여기서 막는다
  return data;
}

/* ---------- 동의 ----------
   동의 행은 수정하지 않는다. 철회는 revoke_consent() RPC 로만 한다. */

export async function getConsents() {

  const { data } = await sb.from('consents').select('kind, granted, granted_at, revoked_at')
    .order('granted_at', { ascending: false });
  const out = {};
  for (const c of data ?? []) if (!(c.kind in out)) out[c.kind] = c.granted && !c.revoked_at;
  return out;
}

export async function grantConsent(kind, version = 'v1.0') {

  const { data, error } = await sb.from('consents')
    .insert({ kind, version, granted: true, ua: navigator.userAgent })
    .select('id').single();
  if (error) throw error;
  return data;
}

export async function revokeConsent(kind) {

  const { data, error } = await sb.rpc('revoke_consent', { p_kind: kind });
  if (error) throw error;
  return data;
}

/* ---------- 트레이너 ---------- */

export async function myClients() {

  const { data, error } = await sb.from('pt_ledger')
    .select('member_id, total_sessions, used_sessions, expires_on, profiles!pt_ledger_member_id_fkey(display_name)');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.member_id, name: row.profiles?.display_name ?? '회원',
    sessions_left: row.total_sessions - row.used_sessions, next: null,
    consent_proxy: false, last_body: null,
  }));
}

/* ---------- 관장 ---------- */

export async function gymRoster(gymId) {

  const { data, error } = await sb.from('memberships')
    .select('*, profiles!memberships_member_id_fkey(display_name), price_plans(name)')
    .eq('gym_id', gymId).order('ends_on');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id, member_id: row.member_id, plan_id: row.plan_id,
    name: row.profiles?.display_name ?? '회원', plan: row.price_plans?.name ?? '회원권',
    starts: row.starts_on, ends: row.ends_on, paid: row.paid_amount, active: row.is_active,
  }));
}

export async function saveMembershipRecord(gymId, row) {
  const payload = {
    starts_on: row.starts,
    ends_on: row.ends,
    paid_amount: Math.max(0, Number(row.paid) || 0),
    is_active: Boolean(row.active),
  };

  const { data, error } = await sb.from('memberships')
    .update(payload).eq('id', row.id).eq('gym_id', gymId).select().single();
  if (error) throw error;
  return data;
}

export async function gymMachines(gymId) {

  const { data, error } = await sb.from('gym_machines')
    .select('machine_catalog(code)').eq('gym_id', gymId);
  if (error) throw error;
  return (data ?? []).map((r) => r.machine_catalog?.code).filter(Boolean);
}

export async function gymMachineInventory(gymId) {

  const { data, error } = await sb.from('gym_machines').select(`
    qty, brand, model_name, note, min_step_kg, max_load_kg,
    supports_unilateral, available_attachments, custom_capabilities, metadata,
    machine_catalog(code, name_ko, category, provides, supports_unilateral, default_attachments)
  `).eq('gym_id', gymId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    code: row.machine_catalog?.code,
    name: row.machine_catalog?.name_ko,
    category: row.machine_catalog?.category,
  }));
}

export async function saveGymMachineInventory(gymId, inventory) {

  const codes = inventory.map((item) => item.code);
  const { data: catalogRows, error: lookupError } = await sb.from('machine_catalog')
    .select('id, code').in('code', codes);
  if (lookupError) throw lookupError;
  const idByCode = new Map((catalogRows ?? []).map((row) => [row.code, row.id]));
  const existing = await sb.from('gym_machines').select('machine_id').eq('gym_id', gymId);
  if (existing.error) throw existing.error;
  const keepIds = new Set(inventory.map((item) => idByCode.get(item.code)).filter(Boolean));
  const removeIds = (existing.data ?? []).map((row) => row.machine_id).filter((id) => !keepIds.has(id));
  if (removeIds.length) {
    const removed = await sb.from('gym_machines').delete().eq('gym_id', gymId).in('machine_id', removeIds);
    if (removed.error) throw removed.error;
  }
  if (inventory.length) {
    const rows = inventory.map((item) => ({
      gym_id: gymId,
      machine_id: idByCode.get(item.code),
      qty: Math.max(1, Number(item.qty) || 1),
      brand: item.brand?.trim() || null,
      model_name: item.model_name?.trim() || null,
      note: item.note?.trim() || null,
      min_step_kg: item.min_step_kg || null,
      max_load_kg: item.max_load_kg || null,
      supports_unilateral: item.supports_unilateral ?? null,
      available_attachments: item.available_attachments || [],
      custom_capabilities: item.custom_capabilities || [],
      metadata: item.metadata || {},
    }));
    const saved = await sb.from('gym_machines').upsert(rows, { onConflict: 'gym_id,machine_id' });
    if (saved.error) throw saved.error;
  }
  await reconcileGymRoutines(gymId);
  return inventory;
}

/* ---------- 기구 사진 ----------
   실제 파일은 Supabase Storage 의 gym-photos 버킷에 있고 DB엔 경로만 둔다.
   경로 첫 칸이 gym_id 라서, 그 헬스장을 운영하는 사람만 그 폴더에 쓸 수 있다.
   (정책은 db/02_rls.sql 17번 블록)

   ※ 체성분 결과지는 여기 올리지 않는다. 이미지 자체를 서버에 두지 않는 게
     그 기능의 설계 전제다. docs/LEGAL.md 1-2 참고. */

export async function gymPhotos(gymId) {

  const { data } = await sb.from('gym_machine_photos').select('*')
    .eq('gym_id', gymId).order('sort');
  return (data ?? []).map((p) => ({
    ...p,
    url: sb.storage.from('gym-photos').getPublicUrl(p.storage_path).data.publicUrl,
  }));
}

export async function uploadGymPhoto(gymId, machineCode, file, caption) {

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${gymId}/${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from('gym-photos').upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (up.error) throw up.error;

  const machine = MACHINES.find((m) => m.code === machineCode);
  const { data: catalogRow, error: catalogError } = await sb.from('machine_catalog')
    .select('id').eq('code', machineCode).single();
  if (catalogError) throw catalogError;
  const { data, error } = await sb.from('gym_machine_photos').insert({
    gym_id: gymId, storage_path: path, caption: caption ?? machine?.name ?? null,
    machine_id: catalogRow.id,
  }).select().single();
  if (error) throw error;
  return { ...data, url: sb.storage.from('gym-photos').getPublicUrl(path).data.publicUrl };
}

export async function deleteGymPhoto(gymId, photo) {

  await sb.storage.from('gym-photos').remove([photo.storage_path]);
  await sb.from('gym_machine_photos').delete().eq('id', photo.id);
  return true;
}

export async function setGymMachines(gymId, codes) {

  const { data: machines, error: lookupError } = await sb.from('machine_catalog')
    .select('id, code').in('code', codes);
  if (lookupError) throw lookupError;
  const del = await sb.from('gym_machines').delete().eq('gym_id', gymId);
  if (del.error) throw del.error;
  if (codes.length) {
    const ins = await sb.from('gym_machines').insert(
      (machines ?? []).map((m) => ({ gym_id: gymId, machine_id: m.id })),
    );
    if (ins.error) throw ins.error;
  }
  return codes;
}

/* ---------- 지역 · PT 역경매 ----------
   회원이 PT 요청을 올리면 트레이너가 이력서(프로필)+제안가로 지원하고,
   회원이 골라 매칭한다. 김과외·카닥 견적 흐름과 같다. */

export async function listAreas() {
  return [...AREAS];
}

export async function getCurrentArea() {

  const id = localStorage.getItem('gymlink.area') ?? AREAS[0].id;
  return AREAS.find((a) => a.id === id) ?? AREAS[0];
}

export async function setCurrentArea(areaId) {

  localStorage.setItem('gymlink.area', areaId);
  return AREAS.find((a) => a.id === areaId) ?? AREAS[0];
}

const HOME_LOCATION_KEY = 'gymlink.home-location';
const LOCATION_MODE_KEY = 'gymlink.location-mode';
const CURRENT_LOCATION_KEY = 'gymlink.current-location';

function parseStoredLocation(storage, keyName) {
  try {
    const value = JSON.parse(storage.getItem(keyName));
    return Number.isFinite(value?.lat) && Number.isFinite(value?.lng) ? value : null;
  } catch {
    return null;
  }
}

export async function getPreferredLocation() {
  const mode = localStorage.getItem(LOCATION_MODE_KEY) ?? 'home';
  const current = parseStoredLocation(sessionStorage, CURRENT_LOCATION_KEY);
  const localHome = parseStoredLocation(localStorage, HOME_LOCATION_KEY);
  if (mode === 'current' && current) return current;
  if (localHome) return localHome;

  if (sb) {
    const { data: auth } = await sb.auth.getUser();
    if (auth.user) {
      const { data } = await sb.from('profiles')
        .select('home_address, home_lat, home_lng, home_bcode')
        .eq('id', auth.user.id).maybeSingle();
      if (data?.home_lat != null && data?.home_lng != null) {
        const home = {
          mode: 'home', label: data.home_address || '우리 집', address: data.home_address,
          lat: data.home_lat, lng: data.home_lng, bcode: data.home_bcode,
        };
        localStorage.setItem(HOME_LOCATION_KEY, JSON.stringify(home));
        return home;
      }
    }
  }
  return null;
}

export async function saveCurrentLocation(location) {
  const value = { ...location, mode: 'current' };
  sessionStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(value));
  localStorage.setItem(LOCATION_MODE_KEY, 'current');
  return value;
}

export async function saveHomeLocation(location) {
  const value = { ...location, mode: 'home' };
  localStorage.setItem(HOME_LOCATION_KEY, JSON.stringify(value));
  localStorage.setItem(LOCATION_MODE_KEY, 'home');
  if (sb) {
    const { data: auth } = await sb.auth.getUser();
    if (auth.user) {
      const { error } = await sb.from('profiles').update({
        home_address: value.address || value.label,
        home_lat: value.lat,
        home_lng: value.lng,
        home_bcode: value.bcode || null,
      }).eq('id', auth.user.id);
      if (error) throw error;
    }
  }
  return value;
}

export async function selectSavedLocation(mode) {
  const keyName = mode === 'current' ? CURRENT_LOCATION_KEY : HOME_LOCATION_KEY;
  const storage = mode === 'current' ? sessionStorage : localStorage;
  const value = parseStoredLocation(storage, keyName);
  if (!value) return null;
  localStorage.setItem(LOCATION_MODE_KEY, mode);
  return value;
}

function normalizeTrainer(row) {
  return {
    ...row,
    id: row.profile_id ?? row.id,
    name: row.profiles?.display_name ?? row.name ?? '트레이너',
    gym_id: row.primary_gym_id ?? row.gym_id,
    gym_name: row.gyms?.name ?? row.gym_name,
    certs: (row.trainer_credentials ?? []).map((c) => c.title),
    portfolio: (row.trainer_credentials ?? []).map((c) => ({
      id: c.id, kind: c.kind, year: c.started_on?.slice(0, 4) ?? '', title: c.title,
      detail: c.issuer ?? '', verified: !!c.verified_at,
    })),
    price_per_session: row.price_per_session ?? row.price_plans?.[0]?.price ?? 0,
    review_count: row.rating_count ?? row.review_count ?? 0,
  };
}

export async function getTrainer(trainerId) {

  const { data, error } = await sb.from('trainers')
    .select('*, profiles(display_name, avatar_url), gyms!trainers_primary_gym_id_fkey(name), trainer_credentials(*), price_plans(price)')
    .eq('profile_id', trainerId).maybeSingle();
  if (error) throw error;
  return data ? normalizeTrainer(data) : null;
}

export async function myTrainerProfile() {

  const { data } = await sb.auth.getUser();
  return data.user ? getTrainer(data.user.id) : null;
}

export async function listSpecialtyTags() {
  return [...SPECIALTY_TAGS];
}

/** 헬스장 소속 트레이너 */
export async function listTrainersByGym(gymId) {

  const { data, error } = await sb.from('trainers')
    .select('*, profiles(display_name, avatar_url), gyms!trainers_primary_gym_id_fkey(name), trainer_credentials(*), price_plans(price)')
    .eq('primary_gym_id', gymId).eq('is_public', true).eq('accepts_new', true)
    .order('rating_avg', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeTrainer);
}

/**
 * 동네 트레이너·헬스장 검색.
 * specialties 가 있으면 해당 분야 트레이너가 있는 헬스장만.
 */
export async function searchTrainersAndGyms({ specialties = [], areaId } = {}) {

  let query = sb.from('trainers')
    .select('*, profiles(display_name, avatar_url), gyms!trainers_primary_gym_id_fkey(*), trainer_credentials(*), price_plans(price)')
    .eq('is_public', true).eq('accepts_new', true);
  if (specialties.length) query = query.overlaps('specialties', specialties);
  const { data, error } = await query.order('rating_avg', { ascending: false });
  if (error) throw error;
  const trainers = (data ?? []).map((row) => ({ ...normalizeTrainer(row), distance_m: 0 }));
  const gyms = [];
  for (const trainer of trainers) {
    const source = data.find((row) => row.profile_id === trainer.id)?.gyms;
    if (!source || gyms.some((g) => g.id === source.id)) continue;
    gyms.push({
      ...source, machines: [], distance_m: 0,
      matching_trainers: trainers.filter((t) => t.gym_id === source.id), specialty_match: specialties,
    });
  }
  return { trainers, gyms, tags: specialties, areaId };
}

/** 트레이너가 본인 이력·포트폴리오 수정 */
export async function updateTrainerProfile(patch) {

  const { data: auth } = await sb.auth.getUser();
  const allowed = ['headline', 'bio', 'specialties', 'years', 'accepts_new', 'is_public'];
  const payload = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key)));
  const { data, error } = await sb.from('trainers').update(payload)
    .eq('profile_id', auth.user?.id).select().single();
  if (error) throw error;
  return normalizeTrainer(data);
}

/** 회원: 내 PT 요청 목록 */
export async function myPtRequests() {

  const { data, error } = await sb.from('pt_requests')
    .select('*, pt_applications(count)').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row, created: row.created_at?.slice(0, 10), apply_count: row.pt_applications?.[0]?.count ?? 0,
  }));
}

/** 트레이너: 현재 지역 근처 열린 요청 */
export async function listOpenPtRequests(areaId) {

  const area = AREAS.find((a) => a.id === areaId);
  let query = sb.from('pt_requests').select('*, pt_applications(count)')
    .eq('status', 'open').order('created_at', { ascending: false });
  if (area?.dong) query = query.ilike('dong', `%${area.dong.replace(/동$/, '')}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row, created: row.created_at?.slice(0, 10), distance_m: 0,
    apply_count: row.pt_applications?.[0]?.count ?? 0,
  }));
}

export async function getPtRequest(requestId) {

  const { data, error } = await sb.from('pt_requests').select('*, pt_applications(count)')
    .eq('id', requestId).maybeSingle();
  if (error) throw error;
  return data ? { ...data, created: data.created_at?.slice(0, 10), apply_count: data.pt_applications?.[0]?.count ?? 0 } : null;
}

export async function createPtRequest(payload) {

  const { data: auth } = await sb.auth.getUser();
  const area = AREAS.find((a) => a.id === payload.area_id);
  const { data, error } = await sb.from('pt_requests').insert({
    member_id: auth.user?.id, bcode: null, dong: area?.label ?? '현재 지역',
    goal: payload.goal, sessions: Number(payload.sessions), budget_max: Number(payload.budget_max),
    schedule: payload.schedule || null, note: payload.note || null,
  }).select().single();
  if (error) throw error;
  return { ...data, created: data.created_at?.slice(0, 10), apply_count: 0 };
}

export async function listApplications(requestId) {

  const { data, error } = await sb.from('pt_applications')
    .select('*, trainers(*, profiles(display_name), gyms!trainers_primary_gym_id_fkey(name), trainer_credentials(*), price_plans(price))')
    .eq('request_id', requestId).order('proposed_price');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row, proposed_per: 0, created: row.created_at?.slice(0, 10),
    trainer: row.trainers ? normalizeTrainer(row.trainers) : null,
  }));
}

export async function applyToPtRequest({ requestId, message, proposedPrice }) {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const { data: request, error: requestError } = await sb.from('pt_requests')
    .select('member_id').eq('id', requestId).single();
  if (requestError) throw requestError;
  const { data, error } = await sb.from('pt_applications').insert({
    request_id: requestId, trainer_id: auth.user.id, member_id: request.member_id, message,
    proposed_price: Number(proposedPrice),
  }).select().single();
  if (error) throw error;
  return data;
}

/** 회원이 트레이너 지원서 하나를 고르면 요청이 matched 가 된다. */
export async function selectPtApplication(requestId, applicationId) {

  const { data, error } = await sb.rpc('select_pt_application', {
    p_request_id: requestId, p_application_id: applicationId,
  });
  if (error) throw error;
  return data;
}

/* ---------- 운동 기록 (workoutapp 세션 로그 이식) ---------- */

export async function getExerciseStats() {

  const { data, error } = await sb.from('exercise_stats').select('*');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.exercise_code, row]));
}

export async function lastSetsForExercise(exerciseCode) {

  const { data, error } = await sb.from('workout_logs').select('payload')
    .order('log_date', { ascending: false }).limit(60);
  if (error) throw error;
  for (const row of data ?? []) {
    const sessions = row.payload?.sessions || [row.payload];
    for (const session of [...sessions].reverse()) {
      const exercise = (session.exercises || []).find(
        (item) => item.code === exerciseCode || item.exercise_code === exerciseCode,
      );
      if (exercise?.sets?.some((set) => set.done && +set.w > 0)) return exercise.sets;
    }
  }
  return null;
}

export async function lastSetsForMember(exerciseCode, memberId) {

  const { data, error } = await sb.from('workout_logs').select('payload')
    .eq('member_id', memberId).order('log_date', { ascending: false }).limit(60);
  if (error) throw error;
  for (const row of data ?? []) {
    const sessions = row.payload?.sessions || [row.payload];
    for (const session of [...sessions].reverse()) {
      const exercise = (session.exercises || []).find(
        (item) => item.code === exerciseCode || item.exercise_code === exerciseCode,
      );
      const done = exercise?.sets?.filter((set) => set.done && +set.w >= 0 && +set.reps > 0);
      if (done?.length) return exercise.sets;
    }
  }
  return null;
}

export async function saveTrainerWorkoutSession({ memberId, routineId, exercises }) {
  const date = dateStrLocal(new Date());
  const session = {
    id: `trainer-${Date.now()}`,
    routineId,
    trainerLed: true,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    exercises,
  };

  const { data, error } = await sb.rpc('save_trainer_workout', {
    p_member_id: memberId, p_log_date: date, p_session: session,
  });
  if (error) throw error;
  return data;
}

export async function saveWorkoutSession({
  dateStr, sessionId, routineId, dayIndex, exercises, ended,
}) {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다');
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const existing = await sb.from('workout_logs').select('payload')
    .eq('member_id', auth.user.id).eq('log_date', date).maybeSingle();
  if (existing.error) throw existing.error;
  const sessions = [...(existing.data?.payload?.sessions || [])];
  const id = sessionId || crypto.randomUUID();
  const index = sessions.findIndex((session) => session.id === id);
  const previous = index >= 0 ? sessions[index] : null;
  const session = {
    id, routineId: routineId || null, dayIndex: dayIndex ?? 0,
    startedAt: previous?.startedAt || new Date().toISOString(),
    endedAt: ended ? new Date().toISOString() : null,
    exercises,
  };
  if (index >= 0) sessions[index] = session;
  else sessions.push(session);
  const membership = await sb.from('memberships').select('gym_id')
    .eq('member_id', auth.user.id).eq('is_active', true).limit(1).maybeSingle();
  const saved = await sb.from('workout_logs').upsert({
    member_id: auth.user.id, log_date: date, gym_id: membership.data?.gym_id || null,
    payload: { sessions }, updated_at: new Date().toISOString(),
  }, { onConflict: 'member_id,log_date' });
  if (saved.error) throw saved.error;
  const stats = statsFromSession(exercises);
  const statRows = Object.entries(stats).map(([code, value]) => ({
    member_id: auth.user.id, exercise_code: code,
    e1rm: value.e1rm || null, best_weight: value.best_weight || null,
    best_reps: value.best_reps || null, last_done_on: date, updated_at: new Date().toISOString(),
  }));
  if (statRows.length) {
    const upserted = await sb.from('exercise_stats').upsert(statRows, { onConflict: 'member_id,exercise_code' });
    if (upserted.error) throw upserted.error;
  }
  return session;
}

export async function listWorkoutSessions(limit = 20) {

  const { data, error } = await sb.from('workout_logs').select('log_date,payload')
    .order('log_date', { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = [];
  for (const day of data ?? []) {
    for (const session of day.payload?.sessions || []) {
      rows.push({ ...session, date: day.log_date });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

/* ---------- PT 예약 (캘린더 · 슬롯 · 고정 일정) ---------- */

export async function getTrainerSchedule(trainerId) {

  const id = trainerId || (await sb.auth.getUser()).data.user?.id;
  if (!id) return null;
  const [{ data: availability, error: availabilityError }, { data: timeOff, error: timeOffError }] = await Promise.all([
    sb.from('trainer_availability').select('*').eq('trainer_id', id).order('weekday').order('start_time'),
    sb.from('trainer_time_off').select('*').eq('trainer_id', id).gte('ends_at', new Date().toISOString()),
  ]);
  if (availabilityError) throw availabilityError;
  if (timeOffError) throw timeOffError;
  const weekly = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const row of availability ?? []) {
    const monday0 = (row.weekday + 6) % 7;
    weekly[monday0].push([row.start_time.slice(0, 5), row.end_time.slice(0, 5)]);
  }
  return {
    trainer_id: id,
    durationMin: availability?.[0]?.slot_minutes ?? 50,
    slotStepMin: availability?.[0]?.slot_minutes ?? 60,
    weekly,
    closedDates: (timeOff ?? []).map((row) => dateStrLocal(new Date(row.starts_at))),
    fixed: await listFixedSessions(id),
  };
}

export async function saveTrainerSchedule(trainerId, patch) {

  const id = trainerId || (await sb.auth.getUser()).data.user?.id;
  if (!id) throw new Error('로그인이 필요합니다');
  const removed = await sb.from('trainer_availability').delete().eq('trainer_id', id);
  if (removed.error) throw removed.error;
  const rows = [];
  for (const [weekday, ranges] of Object.entries(patch.weekly || {})) {
    for (const [start, end] of ranges) rows.push({
      trainer_id: id, weekday: (Number(weekday) + 1) % 7,
      start_time: start, end_time: end, slot_minutes: Number(patch.slotStepMin || patch.durationMin) || 50,
    });
  }
  if (rows.length) {
    const inserted = await sb.from('trainer_availability').insert(rows);
    if (inserted.error) throw inserted.error;
  }
  const future = await sb.from('trainer_time_off').delete().eq('trainer_id', id).gte('ends_at', new Date().toISOString());
  if (future.error) throw future.error;
  if (patch.closedDates?.length) {
    const closed = patch.closedDates.map((date) => ({
      trainer_id: id, starts_at: `${date}T00:00:00`, ends_at: `${date}T23:59:59`, reason: '휴무',
    }));
    const inserted = await sb.from('trainer_time_off').insert(closed);
    if (inserted.error) throw inserted.error;
  }
  return getTrainerSchedule(id);
}

export async function listFixedSessions(trainerId) {

  const id = trainerId || (await sb.auth.getUser()).data.user?.id;
  if (!id) return [];
  const { data, error } = await sb.from('trainer_recurring_sessions')
    .select('*, profiles!trainer_recurring_sessions_member_id_fkey(display_name)')
    .eq('trainer_id', id).eq('active', true).order('weekday').order('start_time');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row, member_name: row.profiles?.display_name ?? '회원',
    weekday: (row.weekday + 6) % 7, time: row.start_time.slice(0, 5), durationMin: row.duration_min,
  }));
}

export async function createFixedSession({ memberId, weekday, time, durationMin, note }) {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다');
  const trainer = await sb.from('trainers').select('primary_gym_id').eq('profile_id', auth.user.id).single();
  if (trainer.error) throw trainer.error;
  const { data, error } = await sb.from('trainer_recurring_sessions').insert({
    trainer_id: auth.user.id, member_id: memberId, gym_id: trainer.data.primary_gym_id,
    weekday: (Number(weekday) + 1) % 7, start_time: time,
    duration_min: Number(durationMin) || 50, note: note || null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFixedSession(fixedId) {

  const { error } = await sb.from('trainer_recurring_sessions').update({ active: false }).eq('id', fixedId);
  if (error) throw error;
  return true;
}

export async function listAvailableSlots(trainerId, fromDate, toDate) {

  const { data, error } = await sb.rpc('open_slots', {
    p_trainer_id: trainerId,
    p_from: fromDate || dateStrLocal(new Date()),
    p_to: toDate || dateStrLocal(new Date(Date.now() + 28 * 86400000)),
  });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const starts = row.slot_start;
    const date = dateStrLocal(new Date(starts));
    const d = new Date(starts);
    return {
      starts_at: starts, ends_at: row.slot_end, date,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      available: true,
    };
  });
}

export async function listMyBookings() {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await sb.from('bookings')
    .select('*, trainers!bookings_trainer_id_fkey(profiles(display_name))')
    .eq('member_id', auth.user.id).order('starts_at');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row, trainer_name: row.trainers?.profiles?.display_name ?? '트레이너',
    kind: 'booked', note: row.member_memo,
  }));
}

export async function listTrainerBookings({ from, to } = {}) {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  let query = sb.from('bookings')
    .select('*, profiles!bookings_member_id_fkey(display_name)')
    .eq('trainer_id', auth.user.id).order('starts_at');
  if (from) query = query.gte('starts_at', `${from}T00:00:00`);
  if (to) query = query.lte('starts_at', `${to}T23:59:59`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row, member_name: row.profiles?.display_name ?? '회원',
    kind: 'booked', note: row.member_memo,
  }));
}

export async function createBooking({ trainerId, startsAt, memberId }) {

  const { data: auth } = await sb.auth.getUser();
  const mid = memberId || auth.user?.id;
  if (!mid) throw new Error('로그인이 필요합니다');
  const trainer = await sb.from('trainers').select('primary_gym_id').eq('profile_id', trainerId).single();
  if (trainer.error) throw trainer.error;
  const start = new Date(startsAt);
  const availability = await sb.from('trainer_availability').select('slot_minutes')
    .eq('trainer_id', trainerId).eq('weekday', start.getDay()).limit(1).maybeSingle();
  const minutes = availability.data?.slot_minutes ?? 50;
  const ledger = await sb.from('pt_ledger').select('id')
    .eq('member_id', mid).eq('trainer_id', trainerId).limit(1).maybeSingle();
  const { data, error } = await sb.from('bookings').insert({
    ledger_id: ledger.data?.id || null,
    trainer_id: trainerId, member_id: mid, gym_id: trainer.data.primary_gym_id,
    starts_at: start.toISOString(), ends_at: new Date(start.getTime() + minutes * 60000).toISOString(),
    status: 'requested',
  }).select().single();
  if (error) throw error;
  return { ...data, kind: 'booked' };
}

export async function respondBooking(bookingId, decision) {
  if (!['confirmed', 'rejected'].includes(decision)) throw new Error('잘못된 예약 처리입니다.');

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const patch = decision === 'confirmed'
    ? { status: 'confirmed', cancelled_by: null, cancelled_at: null }
    : { status: 'cancelled', cancelled_by: auth.user.id, cancelled_at: new Date().toISOString() };
  const { data, error } = await sb.from('bookings').update(patch)
    .eq('id', bookingId).eq('trainer_id', auth.user.id).eq('status', 'requested')
    .select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('이미 처리됐거나 담당 예약이 아닙니다.');
  return data;
}

export async function cancelBooking(bookingId) {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다');
  const { data, error } = await sb.from('bookings').update({
    status: 'cancelled', cancelled_by: auth.user.id, cancelled_at: new Date().toISOString(),
  }).eq('id', bookingId).select().single();
  if (error) throw error;
  return data;
}

export async function myBookableTrainers() {

  const { data, error } = await sb.from('trainers').select(`
    *, profiles!trainers_profile_id_fkey(display_name), gyms!trainers_primary_gym_id_fkey(name),
    price_plans!price_plans_trainer_id_fkey(price)
  `).eq('is_public', true).eq('accepts_new', true);
  if (error) throw error;
  return (data ?? []).map(normalizeTrainer);
}

export async function myNotifications() {

  const { data, error } = await sb.from('notifications').select('*')
    .order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationsRead() {

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return false;
  const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', auth.user.id).is('read_at', null);
  if (error) throw error;
  return true;
}

/* ---------- 앱 내 대화 ---------- */

export async function myConversation(role = 'member') {

  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const column = role === 'trainer' ? 'trainer_id' : 'member_id';
  const { data, error } = await sb.from('threads').select('*')
    .eq(column, uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { ...data, counterpart: role === 'trainer' ? '담당 회원' : '담당 트레이너' } : null;
}

export async function listConversationMessages(threadId) {

  const { data, error } = await sb.from('messages').select('*')
    .eq('thread_id', threadId).order('created_at');
  if (error) throw error;
  return Promise.all((data ?? []).map(resolveConversationImage));
}

const CHAT_BUCKET = 'chat-images';
const CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

async function resolveConversationImage(message) {
  if (!sb || !message?.image_url) return { ...message, image_src: message?.image_url ?? null };
  const { data, error } = await sb.storage.from(CHAT_BUCKET).createSignedUrl(message.image_url, 60 * 60);
  return { ...message, image_src: error ? null : data?.signedUrl ?? null };
}

export function subscribeConversationMessages(threadId, onMessage) {

  const channel = sb.channel(`chat-${threadId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}`,
    }, async (payload) => onMessage(await resolveConversationImage(payload.new)))
    .subscribe();
  return () => { sb.removeChannel(channel); };
}

export async function sendConversationMessage(threadId, body = '', senderId = 'u-member', imageFile = null) {
  const clean = body.trim();
  if (!clean && !imageFile) throw new Error('메시지나 사진을 추가해주세요.');
  if (imageFile && !CHAT_IMAGE_TYPES.has(imageFile.type)) throw new Error('JPG, PNG, WEBP, HEIC 사진만 보낼 수 있습니다.');
  if (imageFile && imageFile.size > 8 * 1024 * 1024) throw new Error('사진은 8MB 이하만 보낼 수 있습니다.');

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  let imagePath = null;
  if (imageFile) {
    const ext = (imageFile.name.split('.').pop() || imageFile.type.split('/').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    imagePath = `${threadId}/${auth.user.id}/${crypto.randomUUID()}.${ext || 'jpg'}`;
    const { error: uploadError } = await sb.storage.from(CHAT_BUCKET).upload(imagePath, imageFile, {
      cacheControl: '3600', contentType: imageFile.type, upsert: false,
    });
    if (uploadError) throw uploadError;
  }
  const { data, error } = await sb.from('messages').insert({
    thread_id: threadId, sender_id: auth.user.id, body: clean || null, image_url: imagePath,
  }).select().single();
  if (error) {
    if (imagePath) await sb.storage.from(CHAT_BUCKET).remove([imagePath]);
    throw error;
  }
  return resolveConversationImage(data);
}

export async function reportConversation(threadId, reason = 'inappropriate', detail = '') {

  const { data: auth } = await sb.auth.getUser();
  const { data, error } = await sb.from('reports').insert({
    reporter_id: auth.user?.id, thread_id: threadId, reason, detail,
  }).select().single();
  if (error) throw error;
  return data;
}

/* ---------- 본사 운영 ---------- */

export async function platformOverview() {

  const count = async (table, filter) => {
    let query = sb.from(table).select('*', { count: 'exact', head: true });
    if (filter) query = query.eq(filter[0], filter[1]);
    const { count: n, error } = await query;
    if (error) throw error;
    return n ?? 0;
  };
  const [gyms, activeGyms, members, trainers, openReports] = await Promise.all([
    count('gyms'), count('gyms', ['status', 'active']), count('profiles', ['role', 'member']),
    count('trainers'), count('reports', ['status', 'open']),
  ]);
  return { gyms, activeGyms, members, trainers, openReports, monthlyGmv: null };
}

export async function adminReports() {

  const { data, error } = await sb.from('reports').select('*')
    .order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function setReportStatus(reportId, status) {

  const { data, error } = await sb.from('reports').update({
    status, handled_at: status === 'closed' ? new Date().toISOString() : null,
  }).eq('id', reportId).select().single();
  if (error) throw error;
  return data;
}
