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
import { statsFromSession } from '@gymlink/core/progress';
import { buildRoutine } from '@gymlink/core/routine';
import {
  buildSlots, expandFixedInstances, syncClientNext, dateStrLocal, toLocalISO, formatHM, parseHM,
} from './booking.js';

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

/** 관장이 공개한 추천 루틴 (템플릿) */
export async function listGymTemplates(gymId) {
  if (!sb) {
    await wait();
    const fromOwner = M.OWNER_TEMPLATES.filter((r) => r.gym_id === gymId && r.is_public !== false);
    const fromSaved = M.SAVED_ROUTINES.filter(
      (r) => r.gym_id === gymId && r.origin === 'owner' && r.is_template,
    );
    const seen = new Set();
    const out = [];
    for (const r of [...fromOwner, ...fromSaved]) {
      if (seen.has(r.id) || seen.has(r.title)) continue;
      seen.add(r.id); seen.add(r.title);
      out.push(r);
    }
    return out;
  }
  return [];
}

/** 템플릿 → 내 루틴으로 복사 */
export async function copyRoutine(templateId, gymId) {
  if (!sb) {
    await wait(200);
    const src = M.OWNER_TEMPLATES.find((r) => r.id === templateId)
      || M.SAVED_ROUTINES.find((r) => r.id === templateId)
      || M.TRAINER_ROUTINES.find((r) => r.id === templateId);
    if (!src) throw new Error('루틴을 찾을 수 없습니다');
    const id = `r-${Date.now()}`;
    const row = {
      ...JSON.parse(JSON.stringify(src)),
      id,
      gym_id: gymId || src.gym_id,
      origin: src.origin === 'trainer' ? 'trainer' : 'member',
      is_template: false,
      is_public: false,
      title: src.origin === 'owner' ? `${src.title}` : src.title,
      note: src.origin === 'owner' ? '관장님 추천에서 가져옴' : src.note || null,
      updated: new Date().toISOString().slice(0, 10),
      body: src.body ? JSON.parse(JSON.stringify(src.body)) : null,
    };
    M.SAVED_ROUTINES.unshift(row);
    return id;
  }
  const { data, error } = await sb.rpc('copy_routine', { p_routine_id: templateId });
  if (error) throw error;
  return data;
}

/** 내 헬스장 기구로 자동 루틴 생성·저장 */
export async function createAutoRoutine({
  gymId, days = 3, goal = 'hypertrophy', level = 2, title,
}) {
  if (!sb) {
    await wait(220);
    const gym = M.GYMS.find((g) => g.id === gymId);
    if (!gym) throw new Error('헬스장을 찾을 수 없습니다');
    const available = availableFor(gym.machines, level);
    const body = buildRoutine({ available, daysPerWeek: days, goal, level, stats: {} });
    const id = `r-${Date.now()}`;
    const row = {
      id,
      gym_id: gymId,
      title: title || `기구 맞춤 · 주 ${body.days.length}회`,
      days: body.days.length,
      goal,
      level,
      origin: 'auto',
      body,
      warnings: body.warnings || [],
      updated: new Date().toISOString().slice(0, 10),
    };
    M.SAVED_ROUTINES.unshift(row);
    return row;
  }
  return null;
}

/** 보유 기구 기준으로 자동 루틴 재생성 · 숙제/추천은 경고만 */
export async function reconcileGymRoutines(gymId) {
  if (!sb) {
    await wait(180);
    const gym = M.GYMS.find((g) => g.id === gymId);
    if (!gym) return { rebuilt: 0, flagged: 0 };
    const codes = new Set(
      availableFor(gym.machines, 3).map((e) => e.code || e.exercise_code),
    );
    let rebuilt = 0;
    let flagged = 0;

    for (const r of M.SAVED_ROUTINES) {
      if (r.gym_id !== gymId) continue;
      if (r.origin === 'auto') {
        const body = buildRoutine({
          available: availableFor(gym.machines, r.level || 2),
          daysPerWeek: r.days || 3,
          goal: r.goal || 'hypertrophy',
          level: r.level || 2,
          stats: {},
        });
        r.body = body;
        r.days = body.days.length;
        r.warnings = body.warnings || [];
        r.stale = false;
        r.updated = new Date().toISOString().slice(0, 10);
        rebuilt += 1;
        continue;
      }
      /* trainer/owner/member 사본 — 없는 기구만 표시 */
      const missing = [];
      for (const day of r.body?.days || []) {
        for (const it of day.items || []) {
          const code = it.exercise_code;
          if (!code || it.duration_min) continue;
          if (it.is_freeform) continue;
          if (!codes.has(code)) missing.push(it.name || code);
        }
      }
      if (missing.length) {
        r.stale = true;
        r.warnings = [`이 헬스장에 없는 기구/종목: ${[...new Set(missing)].join(', ')}`];
        flagged += 1;
      } else {
        r.stale = false;
        if (r.warnings?.length && String(r.warnings[0]).startsWith('이 헬스장에 없는')) {
          r.warnings = [];
        }
      }
    }

    /* 관장 템플릿도 기구 변경 시 재생성 */
    for (const t of M.OWNER_TEMPLATES) {
      if (t.gym_id !== gymId) continue;
      const body = buildRoutine({
        available: availableFor(gym.machines, t.level || 1),
        daysPerWeek: t.days || 3,
        goal: t.goal || 'hypertrophy',
        level: t.level || 1,
        stats: {},
      });
      t.body = body;
      t.days = body.days.length;
      t.updated = new Date().toISOString().slice(0, 10);
      rebuilt += 1;
    }
    return { rebuilt, flagged };
  }
  return { rebuilt: 0, flagged: 0 };
}

/** 관장이 추천 루틴 게시 */
export async function saveOwnerTemplate({
  gymId, title, goal = 'hypertrophy', level = 1, days = 3, body, templateId,
}) {
  if (!sb) {
    await wait(200);
    const built = body || buildRoutine({
      available: availableFor(M.GYMS.find((g) => g.id === gymId)?.machines || [], level),
      daysPerWeek: days,
      goal,
      level,
      stats: {},
    });
    const id = templateId || `ot-${Date.now()}`;
    const row = {
      id,
      gym_id: gymId,
      title: title || '관장 추천 루틴',
      days: built.days?.length || days,
      goal,
      level,
      origin: 'owner',
      is_template: true,
      is_public: true,
      body: built,
      updated: new Date().toISOString().slice(0, 10),
    };
    const i = M.OWNER_TEMPLATES.findIndex((t) => t.id === id);
    if (i >= 0) M.OWNER_TEMPLATES[i] = row;
    else M.OWNER_TEMPLATES.unshift(row);
    /* 회원 목록에도 owner 칩으로 보이게 미러 */
    const mirrorId = `r-owner-${id}`;
    const mi = M.SAVED_ROUTINES.findIndex((r) => r.id === mirrorId || (r.origin === 'owner' && r.is_template && r.title === row.title));
    const mirror = { ...row, id: mirrorId, origin: 'owner', is_template: true };
    if (mi >= 0) M.SAVED_ROUTINES[mi] = mirror;
    else M.SAVED_ROUTINES.unshift(mirror);
    return id;
  }
  return null;
}

/* ---------- 루틴 저장 · 송출 ----------
   송출은 "공유"가 아니라 "복사"다. 트레이너가 나중에 자기 루틴을 고쳐도
   회원이 받은 것은 그대로 남아야 한다. PT 기록의 성격이 있어서
   "그때 뭘 시켰는지"가 남아야 하기 때문이다. */

export async function saveRoutine({ gymId, title, body, goal, level, days, routineId, origin = 'member' }) {
  if (!sb) {
    await wait(200);
    const id = routineId ?? `r-${Date.now()}`;
    const row = {
      id, gym_id: gymId, title, days, goal, level, origin, body: body ?? null,
      updated: new Date().toISOString().slice(0, 10),
    };
    const i = M.SAVED_ROUTINES.findIndex((r) => r.id === routineId);
    if (i >= 0) {
      M.SAVED_ROUTINES[i] = { ...M.SAVED_ROUTINES[i], ...row, note: M.SAVED_ROUTINES[i].note };
    } else {
      M.SAVED_ROUTINES.unshift(row);
    }
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

export async function getSavedRoutine(routineId) {
  if (!sb) {
    await wait();
    return M.SAVED_ROUTINES.find((r) => r.id === routineId)
      || M.TRAINER_ROUTINES.find((r) => r.id === routineId)
      || null;
  }
  const { data } = await sb.from('routines').select('*').eq('id', routineId).maybeSingle();
  return data;
}

export async function trainerRoutines() {
  if (!sb) { await wait(); return [...M.TRAINER_ROUTINES]; }
  const { data } = await sb.from('routines').select('*')
    .eq('origin', 'trainer').order('updated_at', { ascending: false });
  return data ?? [];
}

export async function getTrainerRoutine(routineId) {
  if (!sb) {
    await wait();
    return M.TRAINER_ROUTINES.find((r) => r.id === routineId) ?? null;
  }
  return null;
}

/** 트레이너 보관함 루틴 저장(추가·수정). body 를 함께 저장한다. */
export async function saveTrainerRoutine({
  gymId = 'g-1', title, goal = 'hypertrophy', level = 2, days = 3, routineId, body,
}) {
  if (!sb) {
    await wait(200);
    const id = routineId ?? `tr-${Date.now()}`;
    const row = {
      id, gym_id: gymId, title, days: Number(days) || 3,
      goal, level: Number(level) || 2, origin: 'trainer',
      body: body ?? null,
      updated: new Date().toISOString().slice(0, 10),
    };
    const i = M.TRAINER_ROUTINES.findIndex((r) => r.id === id);
    if (i >= 0) M.TRAINER_ROUTINES[i] = { ...M.TRAINER_ROUTINES[i], ...row };
    else M.TRAINER_ROUTINES.unshift(row);
    return id;
  }
  return null;
}

export async function deleteTrainerRoutine(routineId) {
  if (!sb) {
    await wait(120);
    const i = M.TRAINER_ROUTINES.findIndex((r) => r.id === routineId);
    if (i >= 0) M.TRAINER_ROUTINES.splice(i, 1);
    return true;
  }
  return false;
}

/** 이 회원에게 보낸 숙제 기록 */
export async function memberHomework(memberId) {
  if (!sb) {
    await wait();
    return M.HOMEWORK_LOG
      .filter((h) => h.member_id === memberId)
      .sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
  }
  return [];
}

/** 트레이너 → 회원. 담당 회원인지는 서버가 판정한다. */
export async function assignRoutine({ memberId, routineId, note, dueDate }) {
  if (!sb) {
    await wait(250);
    const src = M.TRAINER_ROUTINES.find((r) => r.id === routineId);
    if (!src) throw new Error('루틴을 찾을 수 없습니다.');
    const title = `${src.title} · 숙제`;
    const copy = {
      ...src,
      id: `r-${Date.now()}`,
      origin: 'trainer',
      title,
      note: note || null,
      due: dueDate || null,
      body: src.body ? JSON.parse(JSON.stringify(src.body)) : null,
      updated: new Date().toISOString().slice(0, 10),
    };
    M.SAVED_ROUTINES.unshift(copy);
    M.HOMEWORK_LOG.unshift({
      id: `hw-${Date.now()}`,
      member_id: memberId,
      routine_id: src.id,
      saved_id: copy.id,
      title,
      note: note || null,
      due: dueDate || null,
      sent_at: new Date().toISOString().slice(0, 10),
    });
    return copy.id;
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
  if (!sb) {
    await wait();
    ensureFixedBookings('u-trainer');
    return M.MY_CLIENTS;
  }
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
    await reconcileGymRoutines(gymId);
    return codes;
  }
  await sb.from('gym_machines').delete().eq('gym_id', gymId);
  if (codes.length) {
    await sb.from('gym_machines').insert(codes.map((c) => ({ gym_id: gymId, machine_code: c })));
  }
  return codes;
}

/* ---------- 지역 · PT 역경매 ----------
   회원이 PT 요청을 올리면 트레이너가 이력서(프로필)+제안가로 지원하고,
   회원이 골라 매칭한다. 김과외·카닥 견적 흐름과 같다. */

export async function listAreas() {
  if (!sb) { await wait(40); return [...M.AREAS]; }
  return [];
}

export async function getCurrentArea() {
  if (!sb) {
    await wait(40);
    return M.AREAS.find((a) => a.id === M.LOCATION.areaId) ?? M.AREAS[0];
  }
  return null;
}

export async function setCurrentArea(areaId) {
  if (!sb) {
    await wait(60);
    M.LOCATION.areaId = areaId;
    return M.AREAS.find((a) => a.id === areaId);
  }
  return null;
}

export async function getTrainer(trainerId) {
  if (!sb) {
    await wait();
    return M.TRAINERS.find((t) => t.id === trainerId) ?? null;
  }
  return null;
}

export async function myTrainerProfile() {
  if (!sb) {
    await wait();
    return M.TRAINERS.find((t) => t.id === 'u-trainer') ?? M.TRAINERS[0];
  }
  return null;
}

export async function listSpecialtyTags() {
  if (!sb) { await wait(20); return [...M.SPECIALTY_TAGS]; }
  return [];
}

/** 헬스장 소속 트레이너 */
export async function listTrainersByGym(gymId) {
  if (!sb) {
    await wait();
    return M.TRAINERS
      .filter((t) => t.gym_id === gymId && t.accepts_new !== false)
      .sort((a, b) => b.rating_avg - a.rating_avg);
  }
  return [];
}

/**
 * 동네 트레이너·헬스장 검색.
 * specialties 가 있으면 해당 분야 트레이너가 있는 헬스장만.
 */
export async function searchTrainersAndGyms({ specialties = [], areaId } = {}) {
  if (!sb) {
    await wait();
    const aid = areaId ?? M.LOCATION.areaId;
    const tags = specialties.filter(Boolean);
    let trainers = M.TRAINERS.filter((t) => t.accepts_new !== false);
    if (tags.length) {
      trainers = trainers.filter((t) =>
        tags.some((tag) => (t.specialties || []).includes(tag)),
      );
    }
    trainers = trainers
      .map((t) => ({
        ...t,
        distance_m: t.area_id === aid ? t.distance_m : t.distance_m + 2000,
      }))
      .sort((a, b) => a.distance_m - b.distance_m);

    const gymIds = [...new Set(trainers.map((t) => t.gym_id))];
    const gyms = M.GYMS
      .filter((g) => gymIds.includes(g.id))
      .map((g) => {
        const ts = trainers.filter((t) => t.gym_id === g.id);
        return {
          ...g,
          distance_m: Math.min(...ts.map((t) => t.distance_m)),
          matching_trainers: ts,
          specialty_match: tags,
        };
      })
      .sort((a, b) => a.distance_m - b.distance_m);

    return { trainers, gyms, tags };
  }
  return { trainers: [], gyms: [], tags: [] };
}

/** 트레이너가 본인 이력·포트폴리오 수정 */
export async function updateTrainerProfile(patch) {
  if (!sb) {
    await wait(180);
    const me = M.TRAINERS.find((t) => t.id === 'u-trainer');
    if (!me) throw new Error('프로필 없음');
    Object.assign(me, {
      ...patch,
      specialties: patch.specialties ? [...patch.specialties] : me.specialties,
      certs: patch.certs ? [...patch.certs] : me.certs,
      portfolio: patch.portfolio
        ? patch.portfolio.map((p) => ({ ...p }))
        : me.portfolio,
    });
    return { ...me };
  }
  return null;
}

/** 회원: 내 PT 요청 목록 */
export async function myPtRequests() {
  if (!sb) {
    await wait();
    return M.PT_REQUESTS
      .filter((r) => r.member_id === 'u-member')
      .map((r) => ({
        ...r,
        apply_count: M.PT_APPLICATIONS.filter((a) => a.request_id === r.id).length,
      }))
      .sort((a, b) => (a.created < b.created ? 1 : -1));
  }
  return [];
}

/** 트레이너: 현재 지역 근처 열린 요청 */
export async function listOpenPtRequests(areaId) {
  if (!sb) {
    await wait();
    const aid = areaId ?? M.LOCATION.areaId;
    return M.PT_REQUESTS
      .filter((r) => r.status === 'open')
      .map((r) => ({
        ...r,
        distance_m: r.area_id === aid ? r.distance_m : r.distance_m + 2500,
        apply_count: M.PT_APPLICATIONS.filter((a) => a.request_id === r.id).length,
        already_applied: M.PT_APPLICATIONS.some(
          (a) => a.request_id === r.id && a.trainer_id === 'u-trainer',
        ),
      }))
      .sort((a, b) => a.distance_m - b.distance_m);
  }
  return [];
}

export async function getPtRequest(requestId) {
  if (!sb) {
    await wait();
    const r = M.PT_REQUESTS.find((x) => x.id === requestId);
    if (!r) return null;
    return {
      ...r,
      apply_count: M.PT_APPLICATIONS.filter((a) => a.request_id === r.id).length,
    };
  }
  return null;
}

export async function createPtRequest(payload) {
  if (!sb) {
    await wait(200);
    const area = M.AREAS.find((a) => a.id === (payload.area_id ?? M.LOCATION.areaId));
    const row = {
      id: `req-${Date.now()}`,
      member_id: 'u-member',
      member_name: '김지훈',
      area_id: area?.id ?? M.LOCATION.areaId,
      dong: area?.label ?? '부산',
      distance_m: 0,
      goal: payload.goal,
      sessions: Number(payload.sessions) || 10,
      budget_max: Number(payload.budget_max) || 0,
      schedule: payload.schedule || '',
      note: payload.note || '',
      status: 'open',
      created: new Date().toISOString().slice(0, 10),
    };
    M.PT_REQUESTS.unshift(row);

    /* 연습용: 근처 트레이너 2명이 바로 제안서를 보낸 것처럼 시드 */
    const nearby = M.TRAINERS.filter((t) => t.area_id === row.area_id).slice(0, 2);
    const pool = nearby.length ? nearby : M.TRAINERS.slice(0, 2);
    for (const t of pool) {
      const cut = 0.88 + Math.random() * 0.1;
      const proposed = Math.round((t.price_per_session * row.sessions * cut) / 10000) * 10000;
      M.PT_APPLICATIONS.unshift({
        id: `app-${Date.now()}-${t.id}`,
        request_id: row.id,
        trainer_id: t.id,
        message: `${row.goal} ${row.sessions}회 제안드립니다. ${t.bio}`,
        proposed_price: Math.min(proposed, row.budget_max || proposed),
        proposed_per: Math.round(Math.min(proposed, row.budget_max || proposed) / row.sessions),
        status: 'pending',
        created: row.created,
      });
    }
    return row;
  }
  return null;
}

export async function listApplications(requestId) {
  if (!sb) {
    await wait();
    return M.PT_APPLICATIONS
      .filter((a) => a.request_id === requestId)
      .map((a) => {
        const t = M.TRAINERS.find((x) => x.id === a.trainer_id);
        return { ...a, trainer: t };
      })
      .sort((a, b) => a.proposed_price - b.proposed_price);
  }
  return [];
}

export async function applyToPtRequest({ requestId, message, proposedPrice }) {
  if (!sb) {
    await wait(220);
    const me = M.TRAINERS.find((t) => t.id === 'u-trainer');
    const exists = M.PT_APPLICATIONS.find(
      (a) => a.request_id === requestId && a.trainer_id === 'u-trainer',
    );
    if (exists) return exists;
    const sessions = M.PT_REQUESTS.find((r) => r.id === requestId)?.sessions || 10;
    const price = Number(proposedPrice) || (me.price_per_session * sessions);
    const row = {
      id: `app-${Date.now()}`,
      request_id: requestId,
      trainer_id: 'u-trainer',
      message: message || '',
      proposed_price: price,
      proposed_per: Math.round(price / sessions),
      status: 'pending',
      created: new Date().toISOString().slice(0, 10),
    };
    M.PT_APPLICATIONS.unshift(row);
    return row;
  }
  return null;
}

/** 회원이 트레이너 지원서 하나를 고르면 요청이 matched 가 된다. */
export async function selectPtApplication(requestId, applicationId) {
  if (!sb) {
    await wait(250);
    const req = M.PT_REQUESTS.find((r) => r.id === requestId);
    const app = M.PT_APPLICATIONS.find((a) => a.id === applicationId);
    if (!req || !app) throw new Error('not found');
    req.status = 'matched';
    req.matched_application_id = applicationId;
    for (const a of M.PT_APPLICATIONS.filter((x) => x.request_id === requestId)) {
      a.status = a.id === applicationId ? 'accepted' : 'rejected';
    }
    const trainer = M.TRAINERS.find((t) => t.id === app.trainer_id);
    M.MY_PT.trainer_name = trainer?.name ?? M.MY_PT.trainer_name;
    M.MY_PT.paid_amount = app.proposed_price;
    M.MY_PT.list_price = app.proposed_price;
    M.MY_PT.total_sessions = req.sessions;
    M.MY_PT.used_sessions = 0;
    if (trainer && !M.MY_CLIENTS.some((c) => c.id === 'u-member')) {
      M.MY_CLIENTS.unshift({
        id: 'u-member', name: '김지훈', sessions_left: req.sessions,
        next: null, consent_proxy: true, last_body: null,
      });
    }
    return { request: req, application: app, trainer };
  }
  return null;
}

/* ---------- 운동 기록 (workoutapp 세션 로그 이식) ---------- */

export async function getExerciseStats() {
  if (!sb) { await wait(40); return { ...M.EXERCISE_STATS }; }
  return {};
}

export async function lastSetsForExercise(exerciseCode) {
  if (!sb) {
    await wait(40);
    const dates = Object.keys(M.WORKOUT_LOGS).sort().reverse();
    for (const d of dates) {
      const day = M.WORKOUT_LOGS[d];
      for (const sess of [...(day.sessions || [])].reverse()) {
        const ex = (sess.exercises || []).find(
          (e) => e.code === exerciseCode || e.exercise_code === exerciseCode,
        );
        if (ex?.sets?.some((s) => s.done && +s.w > 0)) return ex.sets;
      }
    }
    return null;
  }
  return null;
}

export async function saveWorkoutSession({
  dateStr, sessionId, routineId, dayIndex, exercises, ended,
}) {
  if (!sb) {
    await wait(150);
    const date = dateStr || new Date().toISOString().slice(0, 10);
    if (!M.WORKOUT_LOGS[date]) M.WORKOUT_LOGS[date] = { date, sessions: [] };
    const day = M.WORKOUT_LOGS[date];
    let sess = day.sessions.find((s) => s.id === sessionId);
    if (!sess) {
      sess = {
        id: sessionId || `s${Date.now()}`,
        routineId: routineId || null,
        dayIndex: dayIndex ?? 0,
        startedAt: Date.now(),
        endedAt: null,
        exercises: [],
      };
      day.sessions.push(sess);
    }
    sess.exercises = exercises;
    if (ended) sess.endedAt = Date.now();

    /* 스탯 갱신 — workoutapp statsFromSession */
    const patch = statsFromSession(exercises);
    for (const [code, st] of Object.entries(patch)) {
      M.EXERCISE_STATS[code] = { ...(M.EXERCISE_STATS[code] || {}), ...st };
    }
    return sess;
  }
  return null;
}

export async function listWorkoutSessions(limit = 20) {
  if (!sb) {
    await wait();
    const rows = [];
    for (const date of Object.keys(M.WORKOUT_LOGS).sort().reverse()) {
      for (const s of M.WORKOUT_LOGS[date].sessions || []) {
        rows.push({ ...s, date });
        if (rows.length >= limit) return rows;
      }
    }
    return rows;
  }
  return [];
}

/* ---------- PT 예약 (캘린더 · 슬롯 · 고정 일정) ---------- */

function ensureFixedBookings(trainerId) {
  const sched = M.TRAINER_SCHEDULES[trainerId];
  const fixed = M.FIXED_SESSIONS.filter((f) => f.trainer_id === trainerId && f.active !== false);
  const duration = sched?.durationMin || 50;
  const extras = expandFixedInstances(fixed, M.PT_BOOKINGS, 8, duration);
  for (const row of extras) {
    if (!M.PT_BOOKINGS.some((b) => b.id === row.id)) M.PT_BOOKINGS.push(row);
  }
  syncClientNext(M.MY_CLIENTS, M.PT_BOOKINGS);
}

export async function getTrainerSchedule(trainerId) {
  if (!sb) {
    await wait();
    const id = trainerId || 'u-trainer';
    const base = M.TRAINER_SCHEDULES[id] || {
      durationMin: 50, slotStepMin: 60,
      weekly: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
      closedDates: [],
    };
    return {
      trainer_id: id,
      ...JSON.parse(JSON.stringify(base)),
      fixed: M.FIXED_SESSIONS.filter((f) => f.trainer_id === id),
    };
  }
  return null;
}

export async function saveTrainerSchedule(trainerId, patch) {
  if (!sb) {
    await wait(120);
    const id = trainerId || 'u-trainer';
    const cur = M.TRAINER_SCHEDULES[id] || {
      durationMin: 50, slotStepMin: 60,
      weekly: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
      closedDates: [],
    };
    M.TRAINER_SCHEDULES[id] = {
      ...cur,
      durationMin: patch.durationMin ?? cur.durationMin,
      slotStepMin: patch.slotStepMin ?? cur.slotStepMin,
      weekly: patch.weekly ?? cur.weekly,
      closedDates: patch.closedDates ?? cur.closedDates,
    };
    return M.TRAINER_SCHEDULES[id];
  }
  return null;
}

export async function listFixedSessions(trainerId) {
  if (!sb) {
    await wait();
    const id = trainerId || 'u-trainer';
    return M.FIXED_SESSIONS.filter((f) => f.trainer_id === id);
  }
  return [];
}

export async function createFixedSession({ memberId, weekday, time, durationMin, note }) {
  if (!sb) {
    await wait(150);
    const client = M.MY_CLIENTS.find((c) => c.id === memberId);
    if (!client) throw new Error('담당 회원이 아닙니다');
    const row = {
      id: `fx-${Date.now()}`,
      trainer_id: 'u-trainer',
      member_id: memberId,
      member_name: client.name,
      weekday: Number(weekday),
      time,
      durationMin: durationMin || M.TRAINER_SCHEDULES['u-trainer']?.durationMin || 50,
      note: note || '고정 PT',
      active: true,
      created: dateStrLocal(new Date()),
    };
    M.FIXED_SESSIONS.push(row);
    ensureFixedBookings('u-trainer');
    return row;
  }
  return null;
}

export async function deleteFixedSession(fixedId) {
  if (!sb) {
    await wait(100);
    const fx = M.FIXED_SESSIONS.find((f) => f.id === fixedId);
    if (!fx) return false;
    fx.active = false;
    for (const b of M.PT_BOOKINGS) {
      if (b.fixed_id === fixedId && b.status === 'booked' && new Date(b.starts_at) > new Date()) {
        b.status = 'cancelled';
      }
    }
    syncClientNext(M.MY_CLIENTS, M.PT_BOOKINGS);
    return true;
  }
  return false;
}

export async function listAvailableSlots(trainerId, fromDate, toDate) {
  if (!sb) {
    await wait(80);
    const id = trainerId || M.MY_PT.trainer_id || 'u-trainer';
    ensureFixedBookings(id);
    const schedule = M.TRAINER_SCHEDULES[id];
    const bookings = M.PT_BOOKINGS.filter((b) => b.trainer_id === id);
    const fixed = M.FIXED_SESSIONS.filter((f) => f.trainer_id === id);
    return buildSlots({
      schedule,
      bookings,
      fixed,
      fromDate: fromDate || dateStrLocal(new Date()),
      toDate: toDate || dateStrLocal(new Date(Date.now() + 28 * 86400000)),
    });
  }
  return [];
}

export async function listMyBookings() {
  if (!sb) {
    await wait();
    ensureFixedBookings(M.MY_PT.trainer_id || 'u-trainer');
    return M.PT_BOOKINGS
      .filter((b) => b.member_id === 'u-member')
      .slice()
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }
  return [];
}

export async function listTrainerBookings({ from, to } = {}) {
  if (!sb) {
    await wait();
    ensureFixedBookings('u-trainer');
    let rows = M.PT_BOOKINGS.filter((b) => b.trainer_id === 'u-trainer');
    if (from) rows = rows.filter((b) => dateStrLocal(new Date(b.starts_at)) >= from);
    if (to) rows = rows.filter((b) => dateStrLocal(new Date(b.starts_at)) <= to);
    return rows.slice().sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }
  return [];
}

export async function createBooking({ trainerId, startsAt, memberId }) {
  if (!sb) {
    await wait(180);
    const tid = trainerId || M.MY_PT.trainer_id || 'u-trainer';
    const mid = memberId || 'u-member';
    const sched = M.TRAINER_SCHEDULES[tid];
    const duration = sched?.durationMin || 50;
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) throw new Error('잘못된 시각입니다');
    const ds = dateStrLocal(start);
    const hm = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    const ends_at = toLocalISO(ds, formatHM(parseHM(hm) + duration));

    const slots = buildSlots({
      schedule: sched,
      bookings: M.PT_BOOKINGS.filter((b) => b.trainer_id === tid),
      fixed: M.FIXED_SESSIONS.filter((f) => f.trainer_id === tid),
      fromDate: ds,
      toDate: ds,
    });
    const slot = slots.find((s) => s.starts_at === toLocalISO(ds, hm) && s.available);
    if (!slot) throw new Error('이미 예약되었거나 예약 불가 시간입니다');

    const left = M.MY_PT.total_sessions - M.MY_PT.used_sessions;
    if (mid === 'u-member' && left <= 0) throw new Error('남은 PT 횟수가 없습니다');

    const client = M.MY_CLIENTS.find((c) => c.id === mid);
    const trainer = M.TRAINERS.find((t) => t.id === tid);
    const row = {
      id: `bk-${Date.now()}`,
      trainer_id: tid,
      member_id: mid,
      member_name: client?.name || '회원',
      trainer_name: trainer?.name,
      starts_at: toLocalISO(ds, hm),
      ends_at,
      status: 'booked',
      kind: 'booked',
      fixed_id: null,
      note: null,
    };
    M.PT_BOOKINGS.push(row);
    syncClientNext(M.MY_CLIENTS, M.PT_BOOKINGS);
    return row;
  }
  return null;
}

export async function cancelBooking(bookingId) {
  if (!sb) {
    await wait(100);
    const row = M.PT_BOOKINGS.find((b) => b.id === bookingId);
    if (!row || row.status === 'cancelled') return null;
    row.status = 'cancelled';
    syncClientNext(M.MY_CLIENTS, M.PT_BOOKINGS);
    return row;
  }
  return null;
}

export async function myBookableTrainers() {
  if (!sb) {
    await wait();
    const ids = new Set();
    if (M.MY_PT.trainer_id) ids.add(M.MY_PT.trainer_id);
    for (const b of M.PT_BOOKINGS) {
      if (b.member_id === 'u-member') ids.add(b.trainer_id);
    }
    const list = M.TRAINERS.filter((t) => ids.has(t.id) || t.gym_id === M.MY_PT.gym_id);
    return list.length ? list : M.TRAINERS.filter((t) => t.accepts_new !== false).slice(0, 3);
  }
  return [];
}
