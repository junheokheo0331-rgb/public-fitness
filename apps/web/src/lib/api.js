/* ============================================================
   api.js — 화면과 데이터 사이의 유일한 통로

   .env 에 VITE_SUPABASE_URL 이 없으면 목 데이터로 돈다.
   그래서 클론 직후 npm run dev 만으로 전 화면을 볼 수 있다.

   Supabase 를 붙일 때는 각 함수의 `if (!sb)` 아래쪽만 채우면 된다.
   화면 코드는 한 줄도 안 바뀐다.
   ============================================================ */

import { createClient } from '@supabase/supabase-js';
import * as M from './mock.js';
import { MACHINES, availableFor, machineImpact as mockImpact } from './catalog.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sb = url && key ? createClient(url, key) : null;
export const IS_MOCK = !sb;

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));

/* ---------- 헬스장 ---------- */

export async function listNearbyGyms() {
  if (!sb) { await wait(); return [...M.GYMS].sort((a, b) => a.distance_m - b.distance_m); }
  // 실제 구현: nearby_gyms(lat, lng, radius_m) RPC — PostGIS 로 거리순 정렬
  const { data, error } = await sb.rpc('nearby_gyms', { radius_m: 5000 });
  if (error) throw error;
  return data;
}

export async function getGym(gymId) {
  if (!sb) { await wait(); return M.GYMS.find((g) => g.id === gymId) ?? null; }
  const { data, error } = await sb.from('gyms').select('*, price_plans(*), gym_machines(machine_code)').eq('id', gymId).single();
  if (error) throw error;
  return data;
}

/** 이 헬스장의 보유 기구로 실제 수행 가능한 종목.
    역량(capability) 판정이라 덤벨 하나만 있어도 14종목이 나온다. */
export async function availableExercises(gymId, level = 3, authorId = null) {
  if (!sb) {
    await wait();
    const gym = M.GYMS.find((g) => g.id === gymId);
    return gym ? availableFor(gym.machines, level) : [];
  }
  const { data, error } = await sb.rpc('available_exercises', {
    p_gym_id: gymId, p_level: level, p_author: authorId,
  });
  if (error) throw error;
  return data;
}

/** 기구 하나를 더 들이면 몇 종목이 열리는가. 관장이 손을 움직이게 하는 숫자다. */
export async function machineImpact(gymId, machineCode, ownedCodes) {
  if (!sb) { await wait(40); return mockImpact(ownedCodes, machineCode); }
  const { data, error } = await sb.rpc('machine_impact', {
    p_gym_id: gymId, p_machine_code: machineCode,
  });
  if (error) throw error;
  return data;
}

export function machineCatalog() { return MACHINES; }

/* ---------- 내 상태 ---------- */

export async function myMembership() {
  if (!sb) { await wait(); return M.MY_MEMBERSHIP; }
  const { data } = await sb.from('memberships').select('*').eq('is_active', true).maybeSingle();
  return data;
}

export async function myPt() {
  if (!sb) { await wait(); return M.MY_PT; }
  const { data } = await sb.from('pt_ledger').select('*').maybeSingle();
  return data;
}

export async function mySavedRoutines(gymId) {
  if (!sb) { await wait(); return M.SAVED_ROUTINES.filter((r) => !gymId || r.gym_id === gymId); }
  const { data } = await sb.from('routines').select('*')
    .eq('gym_id', gymId).order('updated_at', { ascending: false });
  return data ?? [];
}

/* ---------- 루틴 저장 · 송출 ----------
   송출은 "공유"가 아니라 "복사"다. 트레이너가 나중에 자기 루틴을 고쳐도
   회원이 받은 것은 그대로 남아야 한다. PT 기록의 성격이 있어서
   "그때 뭘 시켰는지"가 남아야 하기 때문이다. */

export async function saveRoutine({ gymId, title, body, goal, level, days, routineId, origin = 'member' }) {
  if (!sb) {
    await wait(200);
    const id = routineId ?? `r-${Date.now()}`;
    const row = { id, gym_id: gymId, title, days, goal, origin,
                  updated: new Date().toISOString().slice(0, 10) };
    const i = M.SAVED_ROUTINES.findIndex((r) => r.id === routineId);
    if (i >= 0) M.SAVED_ROUTINES[i] = row; else M.SAVED_ROUTINES.unshift(row);
    return id;
  }
  const { data, error } = await sb.rpc('save_routine', {
    p_gym_id: gymId, p_title: title, p_body: body,
    p_goal: goal, p_level: level, p_days: days,
    p_routine_id: routineId ?? null, p_origin: origin,
  });
  if (error) throw error;
  return data;
}

export async function trainerRoutines() {
  if (!sb) { await wait(); return M.TRAINER_ROUTINES; }
  const { data } = await sb.from('routines').select('*')
    .eq('origin', 'trainer').order('updated_at', { ascending: false });
  return data ?? [];
}

/** 트레이너 → 회원. 담당 회원이 아니면 서버가 거부한다. */
export async function assignRoutine({ memberId, routineId, note, dueDate }) {
  if (!sb) {
    await wait(250);
    const src = M.TRAINER_ROUTINES.find((r) => r.id === routineId);
    M.SAVED_ROUTINES.unshift({
      ...src, id: `r-${Date.now()}`, origin: 'trainer', note,
      updated: new Date().toISOString().slice(0, 10),
    });
    return `asg-${Date.now()}`;
  }
  const { data, error } = await sb.rpc('assign_routine', {
    p_member_id: memberId, p_routine_id: routineId,
    p_note: note ?? null, p_due_date: dueDate ?? null,
  });
  if (error) throw error;
  return data;
}

/* ---------- 체성분 ---------- */

export async function bodyLog(memberId) {
  if (!sb) { await wait(); return M.BODY_LOG; }
  const { data } = await sb.from('body_composition').select('*')
    .eq('member_id', memberId).order('measured_at', { ascending: false });
  return data ?? [];
}

/**
 * 체성분 저장.
 * record 는 @gymlink/core 의 toRecord() 가 만든 객체다.
 * 사진도, OCR 원문도 여기 들어오지 않는다. 숫자만 온다.
 */
export async function saveBody(record) {
  if (!sb) {
    await wait(200);
    const row = { id: `b-${Date.now()}`, measured_at: record.measured_at.slice(0, 10),
                  source: record.source, weight_kg: record.weight_kg,
                  skeletal_muscle_kg: record.skeletal_muscle_kg,
                  body_fat_pct: record.body_fat_pct, verified: true };
    M.BODY_LOG.unshift(row);
    return row;
  }
  const { data, error } = await sb.from('body_composition').insert(record).select().single();
  if (error) throw error;   // RLS 가 동의 없는 저장을 여기서 막는다
  return data;
}

/* ---------- 동의 ----------
   목 모드에서는 메모리에만 남는다. 실제로는 consents 테이블에 INSERT 한다.
   동의 행은 수정하지 않는다. 철회는 revoke_consent() RPC 로만 한다. */

const mockConsents = { tos: true, privacy: true, health_sensitive: true, proxy_entry: true, marketing: false };

export async function getConsents() {
  if (!sb) { await wait(60); return { ...mockConsents }; }
  const { data } = await sb.from('consents').select('kind, granted, granted_at, revoked_at')
    .order('granted_at', { ascending: false });
  const out = {};
  for (const c of data ?? []) if (!(c.kind in out)) out[c.kind] = c.granted && !c.revoked_at;
  return out;
}

export async function grantConsent(kind, version = 'v1.0') {
  if (!sb) { await wait(80); mockConsents[kind] = true; return { id: `c-${kind}` }; }
  const { data, error } = await sb.from('consents')
    .insert({ kind, version, granted: true, ua: navigator.userAgent })
    .select('id').single();
  if (error) throw error;
  return data;
}

export async function revokeConsent(kind) {
  if (!sb) {
    await wait(120);
    mockConsents[kind] = false;
    if (kind === 'health_sensitive') M.BODY_LOG.length = 0;
    if (kind === 'proxy_entry') {
      for (let i = M.BODY_LOG.length - 1; i >= 0; i--) if (M.BODY_LOG[i].source === 'proxy') M.BODY_LOG.splice(i, 1);
    }
    return { purged_rows: 0 };
  }
  const { data, error } = await sb.rpc('revoke_consent', { p_kind: kind });
  if (error) throw error;
  return data;
}

/* ---------- 트레이너 ---------- */

export async function myClients() {
  if (!sb) { await wait(); return M.MY_CLIENTS; }
  const { data } = await sb.from('pt_ledger').select('member_id, total_sessions, used_sessions, profiles(name)');
  return data ?? [];
}

/* ---------- 관장 ---------- */

export async function gymRoster(gymId) {
  if (!sb) { await wait(); return M.GYM_ROSTER; }
  const { data } = await sb.from('memberships').select('*, profiles(name), price_plans(name)').eq('gym_id', gymId);
  return data ?? [];
}

export async function gymMachines(gymId) {
  if (!sb) {
    await wait();
    return M.GYMS.find((g) => g.id === gymId)?.machines ?? [];
  }
  const { data } = await sb.from('gym_machines').select('machine_code').eq('gym_id', gymId);
  return (data ?? []).map((r) => r.machine_code);
}

/* ---------- 기구 사진 ----------
   실제 파일은 Supabase Storage 의 gym-photos 버킷에 있고 DB엔 경로만 둔다.
   경로 첫 칸이 gym_id 라서, 그 헬스장을 운영하는 사람만 그 폴더에 쓸 수 있다.
   (정책은 db/02_rls.sql 17번 블록)

   ※ 체성분 결과지는 여기 올리지 않는다. 이미지 자체를 서버에 두지 않는 게
     그 기능의 설계 전제다. docs/LEGAL.md 1-2 참고. */

export async function gymPhotos(gymId) {
  if (!sb) { await wait(); return M.GYMS.find((g) => g.id === gymId)?.photos ?? []; }
  const { data } = await sb.from('gym_machine_photos').select('*')
    .eq('gym_id', gymId).order('sort');
  return (data ?? []).map((p) => ({
    ...p,
    url: sb.storage.from('gym-photos').getPublicUrl(p.storage_path).data.publicUrl,
  }));
}

export async function uploadGymPhoto(gymId, machineCode, file, caption) {
  if (!sb) {
    await wait(400);
    const gym = M.GYMS.find((g) => g.id === gymId);
    const row = { id: `ph-${Date.now()}`, machine_code: machineCode, caption,
                  url: URL.createObjectURL(file), tone: '#444C58' };
    gym.photos = [...(gym.photos ?? []), row];
    return row;
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${gymId}/${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from('gym-photos').upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (up.error) throw up.error;

  const machine = MACHINES.find((m) => m.code === machineCode);
  const { data, error } = await sb.from('gym_machine_photos').insert({
    gym_id: gymId, storage_path: path, caption: caption ?? machine?.name ?? null,
    machine_id: null,   // 실제로는 machine_catalog.id 를 조회해 넣는다
  }).select().single();
  if (error) throw error;
  return { ...data, url: sb.storage.from('gym-photos').getPublicUrl(path).data.publicUrl };
}

export async function deleteGymPhoto(gymId, photo) {
  if (!sb) {
    await wait(150);
    const gym = M.GYMS.find((g) => g.id === gymId);
    gym.photos = (gym.photos ?? []).filter((p) => p.id !== photo.id);
    return true;
  }
  await sb.storage.from('gym-photos').remove([photo.storage_path]);
  await sb.from('gym_machine_photos').delete().eq('id', photo.id);
  return true;
}

export async function setGymMachines(gymId, codes) {
  if (!sb) {
    await wait(150);
    const g = M.GYMS.find((x) => x.id === gymId);
    if (g) g.machines = [...codes];
    return codes;
  }
  await sb.from('gym_machines').delete().eq('gym_id', gymId);
  if (codes.length) {
    await sb.from('gym_machines').insert(codes.map((c) => ({ gym_id: gymId, machine_code: c })));
  }
  return codes;
}
