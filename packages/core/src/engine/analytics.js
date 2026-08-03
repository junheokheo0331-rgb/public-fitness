/* workoutapp Analytics · 근육 회복도 · 주간 볼륨 · e1RM 스냅샷 */

import { e1rm } from './routine.js';
import { dateStrOf, weekStart } from './time.js';
import { EXERCISE_CATALOG, normalizeExName } from '../lib/exercise-catalog.js';

export const RECOVERY_TIME_HOURS = {
  quadriceps: 72, hamstrings: 72, gluteus_maximus: 72, lower_back: 72,
  pectoralis_major: 48, latissimus_dorsi: 48, trapezius: 48, rhomboids: 48,
  posterior_deltoid: 48, anterior_deltoid: 48,
  lateral_deltoid: 24, biceps_brachii: 24, triceps_brachii: 24,
  forearms: 24, core: 24, calves: 24,
};

export const MUSCLE_LABEL_KO = {
  quadriceps: '대퇴사두', hamstrings: '햄스트링', gluteus_maximus: '대둔근',
  lower_back: '하부 기립근', pectoralis_major: '대흉근', latissimus_dorsi: '광배근',
  trapezius: '승모근', rhomboids: '능형근', posterior_deltoid: '후면 삼각',
  anterior_deltoid: '전면 삼각', lateral_deltoid: '측면 삼각',
  biceps_brachii: '이두', triceps_brachii: '삼두', forearms: '전완',
  core: '코어', calves: '종아리',
};

export const MUSCLE_REGION_PICKER = [
  { id: 'chest', label: '가슴', muscles: ['pectoralis_major'] },
  { id: 'back', label: '등', muscles: ['latissimus_dorsi', 'rhomboids'] },
  { id: 'shoulders', label: '어깨', muscles: ['anterior_deltoid', 'lateral_deltoid', 'posterior_deltoid'] },
  { id: 'traps', label: '승모', muscles: ['trapezius'] },
  { id: 'quads', label: '대퇴사두', muscles: ['quadriceps'] },
  { id: 'hams', label: '햄스트링', muscles: ['hamstrings'] },
  { id: 'glutes', label: '둔근', muscles: ['gluteus_maximus'] },
  { id: 'lower_back', label: '기립근', muscles: ['lower_back'] },
  { id: 'biceps', label: '이두', muscles: ['biceps_brachii'] },
  { id: 'triceps', label: '삼두', muscles: ['triceps_brachii'] },
  { id: 'forearms', label: '전완', muscles: ['forearms'] },
  { id: 'core', label: '코어', muscles: ['core'] },
  { id: 'calves', label: '종아리', muscles: ['calves'] },
];

export const SLUG_TO_ENGINE_MUSCLES = {
  chest: ['pectoralis_major'], biceps: ['biceps_brachii'], triceps: ['triceps_brachii'],
  quadriceps: ['quadriceps'], hamstring: ['hamstrings'], gluteal: ['gluteus_maximus'],
  calves: ['calves'], forearm: ['forearms'], abs: ['core'], obliques: ['core'],
  trapezius: ['trapezius'],
  deltoids: ['anterior_deltoid', 'lateral_deltoid', 'posterior_deltoid'],
  'upper-back': ['latissimus_dorsi', 'rhomboids'],
  'lower-back': ['lower_back'],
  adductors: ['hamstrings', 'gluteus_maximus'], tibialis: ['calves'],
};

export const EXERCISE_MUSCLE_MAP = {
  '스쿼트': ['quadriceps', 'gluteus_maximus', 'lower_back'],
  '벤치프레스': ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'],
  '데드리프트': ['hamstrings', 'gluteus_maximus', 'lower_back', 'latissimus_dorsi'],
  '백스쿼트': ['quadriceps', 'gluteus_maximus', 'lower_back'],
  '레그프레스': ['quadriceps', 'gluteus_maximus'],
  '루마니안 데드리프트': ['hamstrings', 'gluteus_maximus', 'lower_back'],
  '시티드 레그컬': ['hamstrings'], '라잉 레그컬': ['hamstrings'], '레그컬': ['hamstrings'],
  '레그익스텐션': ['quadriceps'], '힙쓰러스트': ['gluteus_maximus', 'hamstrings', 'core'],
  '카프레이즈': ['calves'], '카프': ['calves'],
  '인클라인 벤치': ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'],
  '인클라인 스미스': ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'],
  '체스트프레스': ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'],
  '케이블 플라이': ['pectoralis_major'], '플라이': ['pectoralis_major'],
  '숄더프레스': ['anterior_deltoid', 'lateral_deltoid', 'triceps_brachii'],
  '사이드레터럴': ['lateral_deltoid'], '사레': ['lateral_deltoid'],
  '프론트': ['anterior_deltoid'], '덤벨 콤보': ['lateral_deltoid', 'anterior_deltoid'],
  '랫풀다운': ['latissimus_dorsi', 'biceps_brachii', 'rhomboids'],
  '풀다운': ['latissimus_dorsi', 'biceps_brachii'],
  '리니어 로우': ['latissimus_dorsi', 'rhomboids', 'biceps_brachii', 'posterior_deltoid'],
  '로우': ['latissimus_dorsi', 'rhomboids', 'biceps_brachii'],
  '리버스 팩덱': ['posterior_deltoid', 'rhomboids'], '페이스풀': ['posterior_deltoid', 'trapezius'],
  '푸시다운': ['triceps_brachii'], '익스텐션': ['triceps_brachii'],
  '프리쳐컬': ['biceps_brachii'], '케이블컬': ['biceps_brachii'],
  '해머컬': ['biceps_brachii', 'forearms'], '컬': ['biceps_brachii'],
};

const FATIGUE_VOLUME_SCALE = 4000;

export function musclesFromRegionIds(ids) {
  const out = [];
  for (const id of ids || []) {
    const r = MUSCLE_REGION_PICKER.find((x) => x.id === id);
    if (!r) continue;
    for (const m of r.muscles) if (!out.includes(m)) out.push(m);
  }
  return out;
}

export function regionIdsFromMuscles(muscles) {
  const set = Object.fromEntries((muscles || []).map((m) => [m, true]));
  return MUSCLE_REGION_PICKER.filter((r) => r.muscles.some((m) => set[m])).map((r) => r.id);
}

function musclesByName(name) {
  const raw = String(name || '');
  const q = normalizeExName(raw);
  if (!q) return [];
  const exact = EXERCISE_CATALOG.find((c) => (
    normalizeExName(c.name) === q || (c.alias || []).some((a) => normalizeExName(a) === q)
  ));
  if (exact) return exact.muscles.slice();
  const byLength = EXERCISE_CATALOG.slice().sort((a, b) => b.name.length - a.name.length);
  const partial = byLength.find((c) => {
    const n = normalizeExName(c.name);
    return n.length >= 2 && q.includes(n);
  });
  if (partial) return partial.muscles.slice();
  const keys = Object.keys(EXERCISE_MUSCLE_MAP).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (raw.includes(k)) return EXERCISE_MUSCLE_MAP[k].slice();
  }
  return [];
}

export function musclesForExercise(e) {
  if (!e || e.type === 'cardio') return [];
  if (Array.isArray(e.muscles) && e.muscles.length) {
    return e.muscles.filter((m) => RECOVERY_TIME_HOURS[m]);
  }
  if (e.lift && EXERCISE_MUSCLE_MAP[e.lift]) return EXERCISE_MUSCLE_MAP[e.lift].slice();
  return musclesByName(e.name);
}

export function setVolume(sets) {
  let v = 0;
  for (const s of sets || []) {
    if (s?.done && +s.w > 0 && +s.reps > 0) v += (+s.w) * (+s.reps);
  }
  return v;
}

export function sessionVolume(sess) {
  if (!sess) return 0;
  if (sess.sets && typeof sess.sets === 'object' && !Array.isArray(sess.sets)) {
    let v = 0;
    for (const arr of Object.values(sess.sets)) v += setVolume(arr);
    return v;
  }
  let v = 0;
  for (const ex of sess.exercises || []) v += setVolume(ex.sets);
  return v;
}

function sessionTime(dateStr, sess) {
  if (sess?.endedAt) {
    const t = new Date(sess.endedAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (sess?.startedAt) {
    const t = new Date(sess.startedAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 20, 0, 0).getTime();
}

function sessionsOf(day, dateStr) {
  if (!day) return [];
  if (Array.isArray(day.sessions)) return day.sessions;
  if (day.sets) {
    return [{
      id: day.id || `smig_${dateStr}`,
      programId: day.programId || null,
      startedAt: day.startedAt || null,
      endedAt: day.endedAt || null,
      sets: day.sets,
    }];
  }
  return [];
}

function volumeToFatigue(volume) {
  if (!volume || volume <= 0) return 0;
  return Math.min(1, 1 - Math.exp(-volume / FATIGUE_VOLUME_SCALE));
}

function findExercise(exId, programs) {
  for (const p of programs || []) {
    const hit = (p.items || []).find((e) => e.id === exId);
    if (hit) return hit;
  }
  return null;
}

/**
 * @param {Object} logs  date → { sessions:[] }
 * @param {Array} programs
 * @param {number} [nowMs]
 */
export function getMuscleRecoveryStatus(logs = {}, programs = [], nowMs = Date.now()) {
  const state = {};
  for (const m of Object.keys(RECOVERY_TIME_HOURS)) {
    state[m] = { fatigue: 0, lastTs: null, lastVolume: 0 };
  }

  const events = [];
  for (const dateStr of Object.keys(logs).sort()) {
    for (const sess of sessionsOf(logs[dateStr], dateStr)) {
      if (!sess?.sets) continue;
      const ts = sessionTime(dateStr, sess);
      const muscleVol = {};
      for (const [exId, arr] of Object.entries(sess.sets)) {
        const e = findExercise(exId, programs) || { id: exId, name: exId };
        const vol = setVolume(arr);
        if (!vol) continue;
        for (const m of musclesForExercise(e)) {
          if (!RECOVERY_TIME_HOURS[m]) continue;
          muscleVol[m] = (muscleVol[m] || 0) + vol;
        }
      }
      if (Object.keys(muscleVol).length) events.push({ ts, muscleVol });
    }
  }
  events.sort((a, b) => a.ts - b.ts);

  for (const ev of events) {
    for (const m of Object.keys(ev.muscleVol)) {
      const half = RECOVERY_TIME_HOURS[m];
      const st = state[m];
      if (st.lastTs != null) {
        const hoursGap = Math.max(0, (ev.ts - st.lastTs) / 3600000);
        st.fatigue *= 0.5 ** (hoursGap / half);
      }
      st.fatigue = Math.min(1, st.fatigue + volumeToFatigue(ev.muscleVol[m]));
      st.lastTs = ev.ts;
      st.lastVolume = ev.muscleVol[m];
    }
  }

  const out = {};
  for (const m of Object.keys(RECOVERY_TIME_HOURS)) {
    const half = RECOVERY_TIME_HOURS[m];
    const st = state[m];
    let fatigue = st.fatigue;
    let hoursSince = null;
    if (st.lastTs != null) {
      hoursSince = Math.max(0, (nowMs - st.lastTs) / 3600000);
      fatigue *= 0.5 ** (hoursSince / half);
    }
    fatigue = Math.min(1, Math.max(0, fatigue));
    out[m] = {
      muscle: m,
      label: MUSCLE_LABEL_KO[m] || m,
      recoveryPct: Math.round((1 - fatigue) * 1000) / 10,
      fatigue: Math.round(fatigue * 1000) / 1000,
      hoursSinceLast: hoursSince == null ? null : Math.round(hoursSince * 10) / 10,
      lastTrainedAt: st.lastTs == null ? null : dateStrOf(new Date(st.lastTs)),
      lastVolume: Math.round(st.lastVolume),
      recoveryHours: half,
    };
  }
  return out;
}

function bestE1ForSession(sess, lift, programs) {
  if (!sess?.sets) return 0;
  let best = 0;
  for (const [exId, arr] of Object.entries(sess.sets)) {
    const e = findExercise(exId, programs);
    if (!e || e.lift !== lift) continue;
    for (const s of arr || []) {
      if (!s?.done) continue;
      const v = e1rm(+s.w, +s.reps, +(s.rir ?? 0));
      if (v > best) best = v;
    }
  }
  return best;
}

function bestE1ForDate(logs, dateStr, lift, programs) {
  let best = 0;
  for (const sess of sessionsOf(logs[dateStr], dateStr)) {
    const v = bestE1ForSession(sess, lift, programs);
    if (v > best) best = v;
  }
  return best;
}

function appliedE1(logs, settings, lift, targetDate, programs, caps = {}) {
  const b = settings?.baseline?.[lift];
  if (!b?.w) return 0;
  const capUp = caps.capUp ?? settings?.capUp ?? 0.025;
  const capDown = caps.capDown ?? settings?.capDown ?? 0.03;
  let cur = e1rm(b.w, b.reps, b.rir);
  const apply = (best) => {
    if (!best) return;
    if (!cur) { cur = best; return; }
    const up = cur * (1 + capUp);
    const dn = cur * (1 - capDown);
    cur = Math.round(Math.min(Math.max(best, dn), up) * 10) / 10;
  };
  for (const d of Object.keys(logs || {}).sort().filter((x) => x < targetDate)) {
    apply(bestE1ForDate(logs, d, lift, programs));
  }
  return Math.round(cur * 10) / 10;
}

export function getMainLiftE1RM(logs = {}, settings = {}, programs = [], asOfDate) {
  const lifts = ['스쿼트', '벤치프레스', '데드리프트'];
  const target = asOfDate || dateStrOf(new Date(Date.now() + 86400000));
  const dates = Object.keys(logs).sort();
  const result = {};
  for (const lift of lifts) {
    const baseline = settings.baseline?.[lift];
    const baselineE1 = baseline?.w ? e1rm(baseline.w, baseline.reps, baseline.rir) : 0;
    const history = [];
    let peak = baselineE1;
    let latest = 0;
    let latestDate = null;
    for (const d of dates) {
      const best = bestE1ForDate(logs, d, lift, programs);
      if (!best) continue;
      history.push({ date: d, e1rm: best });
      if (best > peak) peak = best;
      latest = best;
      latestDate = d;
    }
    const applied = appliedE1(logs, settings, lift, target, programs);
    const weekStartStr = dateStrOf(weekStart(new Date()));
    const e1LastWeek = appliedE1(logs, settings, lift, weekStartStr, programs) || 0;
    const current = applied || latest || baselineE1 || null;
    result[lift] = {
      lift,
      baselineE1: baselineE1 || null,
      currentE1: current,
      peakE1: peak || null,
      latestSessionE1: latest || null,
      latestDate,
      history,
      deltaFromBaseline: baselineE1 && current ? Math.round((current - baselineE1) * 10) / 10 : null,
      deltaFromLastWeek: current != null && e1LastWeek > 0
        ? Math.round((current - e1LastWeek) * 10) / 10 : null,
      e1LastWeek: e1LastWeek || null,
    };
  }
  return result;
}

function volumeBetween(logs, startMs, endMs) {
  let total = 0;
  for (const dateStr of Object.keys(logs || {})) {
    for (const sess of sessionsOf(logs[dateStr], dateStr)) {
      const ts = sessionTime(dateStr, sess);
      if (ts < startMs || ts >= endMs) continue;
      total += sessionVolume(sess);
    }
  }
  return total;
}

export function getWeeklyVolumeComparison(logs = {}, nowDate = new Date()) {
  const now = new Date(nowDate);
  const thisStart = weekStart(now);
  const nextStart = new Date(thisStart); nextStart.setDate(nextStart.getDate() + 7);
  const prevStart = new Date(thisStart); prevStart.setDate(prevStart.getDate() - 7);
  const thisWeek = volumeBetween(logs, thisStart.getTime(), nextStart.getTime());
  const lastWeek = volumeBetween(logs, prevStart.getTime(), thisStart.getTime());
  let changePct = null;
  if (lastWeek > 0) changePct = Math.round(((thisWeek - lastWeek) / lastWeek) * 1000) / 10;
  else if (thisWeek > 0) changePct = 100;
  return {
    thisWeek: Math.round(thisWeek),
    lastWeek: Math.round(lastWeek),
    changePct,
    thisWeekStart: dateStrOf(thisStart),
    lastWeekStart: dateStrOf(prevStart),
  };
}

export function getDailyVolumesThisWeek(logs = {}, nowDate = new Date()) {
  const now = new Date(nowDate);
  const todayStr = dateStrOf(now);
  const thisStart = weekStart(now);
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(thisStart);
    d.setDate(thisStart.getDate() + i);
    const dateStr = dateStrOf(d);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    days.push({
      key: keys[i],
      label: labels[i],
      dateStr,
      volume: Math.round(volumeBetween(logs, d.getTime(), next.getTime())),
      isToday: dateStr === todayStr,
    });
  }
  const cmp = getWeeklyVolumeComparison(logs, now);
  return { days, total: cmp.thisWeek, lastWeek: cmp.lastWeek, changePct: cmp.changePct, ...cmp };
}

export function fillFromRecoveryPct(pct, trained) {
  if (!trained) return '#e5e7eb';
  if (pct >= 80) return '#4ade80';
  if (pct >= 40) return '#facc15';
  return '#f87171';
}

export function colorForSlug(slug, recovery) {
  const keys = SLUG_TO_ENGINE_MUSCLES[slug];
  if (!keys?.length) return '#e5e7eb';
  let lowest = null;
  let trained = false;
  for (const k of keys) {
    const st = recovery?.[k];
    if (!st || st.lastTrainedAt == null) continue;
    trained = true;
    if (lowest == null || st.recoveryPct < lowest) lowest = st.recoveryPct;
  }
  return fillFromRecoveryPct(lowest == null ? 100 : lowest, trained);
}
