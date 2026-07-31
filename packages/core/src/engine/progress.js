/* ============================================================
   progress.js — RIR 기반 자동조절 (workoutapp Engine 이식)

   메인 리프트: e1RM + 상한(세션당 +2.5% / -3%) → 중량·반복 추천
   보조: 세트별 이중 점진 (반복 +1 → 상한이면 증량 후 하한 리셋)
   레스트포즈: 고정 중량에서 총 반복수로 진행
   ============================================================ */

import { e1rm, pct1RM, repsAt, snapWeight } from './routine.js';

/**
 * 기준 e1RM 에 세션 최고치들을 시간순으로 반영.
 * @param {number} baselineE1
 * @param {number[]} sessionBests  오래된 → 최신
 * @param {{ capUp?: number, capDown?: number }} caps
 */
export function appliedE1rm(baselineE1, sessionBests = [], caps = {}) {
  const capUp = caps.capUp ?? 0.025;
  const capDown = caps.capDown ?? 0.03;
  let cur = baselineE1 || 0;
  for (const best of sessionBests) {
    if (!best) continue;
    if (!cur) { cur = best; continue; }
    const up = cur * (1 + capUp);
    const dn = cur * (1 - capDown);
    cur = Math.round(Math.min(Math.max(best, dn), up) * 10) / 10;
  }
  return Math.round(cur * 10) / 10;
}

/** 완료 세트 배열에서 최고 e1RM */
export function bestE1FromSets(sets) {
  let best = 0;
  for (const s of sets || []) {
    if (!s?.done && s?.done !== true) {
      if (!(+s?.w > 0 && +s?.reps > 0)) continue;
    }
    if (!(+s?.w > 0 && +s?.reps > 0)) continue;
    if (s.done === false) continue;
    const v = e1rm(+s.w, +s.reps, +(s.rir ?? 0));
    if (v > best) best = v;
  }
  return best;
}

/**
 * 세트별 목표.
 *
 * @param {Object} ex
 * @param {string}  [ex.mode]     normal | restpause
 * @param {string}  [ex.lift]     메인 리프트 키(있으면 e1RM 경로)
 * @param {number}  ex.sets
 * @param {number}  ex.repLo
 * @param {number}  ex.repHi
 * @param {number}  ex.rir
 * @param {number}  [ex.step]     증량 단위
 * @param {string}  [ex.round]    near | floor
 * @param {string}  [ex.type]     weight | cardio
 * @param {number}  [ex.targetMin]
 * @param {Object}  ctx
 * @param {number}  [ctx.e1rm]           적용 e1RM (메인)
 * @param {Array}   [ctx.prevSets]       지난 수행 [{w,reps,rir,done}]
 * @param {string}  [ctx.unitLabel]
 */
export function setTargets(ex, ctx = {}) {
  const u = ctx.unitLabel || 'kg';
  if (ex.type === 'cardio') {
    return [{ w: '', reps: '', text: `유산소 ${ex.targetMin || 30}분`, kind: 'cardio' }];
  }

  const sets = Math.max(1, Number(ex.sets) || 3);
  const repLo = Number(ex.repLo ?? ex.rep_range?.[0] ?? 8);
  const repHi = Number(ex.repHi ?? ex.rep_range?.[1] ?? 12);
  const rir = Number(ex.rir ?? ex.target_rir ?? 1);
  const step = Number(ex.step || ex.min_step_kg || 2.5);
  const out = [];

  /* ── 메인 리프트 (e1RM) ── */
  if (ex.lift || ctx.e1rm) {
    const e1 = ctx.e1rm || 0;
    if (!e1) {
      for (let i = 0; i < sets; i++) {
        out.push({
          w: '', reps: repLo, kind: 'nobase',
          text: '기준 기록이 없으면 감각으로 시작',
        });
      }
      return out;
    }
    const rpe = 10 - rir;
    let w0 = e1 * pct1RM(repLo, rpe) / 100;
    w0 = ex.round === 'floor'
      ? Math.floor(w0 / step) * step
      : snapWeight(w0, step);
    if (w0 <= 0) w0 = step;
    let r0 = repsAt(w0, e1, rpe);
    if (r0 > repHi) {
      w0 = snapWeight(w0 + step, step);
      r0 = repsAt(w0, e1, rpe);
    }
    const reps = Math.max(repLo, r0);
    for (let i = 0; i < sets; i++) {
      out.push({
        w: w0, reps, kind: 'main', e1,
        text: `${w0}${u} × ${reps}회 @RIR${rir}`,
      });
    }
    return out;
  }

  /* ── 보조 · 레스트포즈 (이중 점진) ── */
  const prev = ctx.prevSets || [];
  for (let i = 0; i < sets; i++) {
    const p = prev[i] && (prev[i].done !== false) && +prev[i].w
      ? prev[i] : null;
    if (!p) {
      out.push({
        w: '', reps: repLo, kind: 'first',
        text: ex.mode === 'restpause'
          ? `무게 자율 · 총 ${repLo}~${repHi}회`
          : `무게 자율 · ${repLo}~${repHi}회 @RIR${rir}`,
      });
      continue;
    }
    const pw = +p.w;
    const pr = +p.reps;
    if (pr >= repHi) {
      const nw = snapWeight(pw + step, step);
      out.push({
        w: nw, reps: repLo, kind: 'up',
        text: `${nw}${u} × ${repLo}회 ▲증량`,
      });
    } else {
      out.push({
        w: pw, reps: pr + 1, kind: 'rep',
        text: `${pw}${u} × ${pr + 1}회` + (ex.mode === 'restpause' ? ' (총합)' : ''),
      });
    }
  }
  return out;
}

/** GymLink 루틴 item + 지난 기록 → 세트 목표 */
export function targetsForItem(item, prevSets = [], stats = {}) {
  const ex = {
    type: item.duration_min ? 'cardio' : 'weight',
    targetMin: item.duration_min,
    sets: item.sets,
    repLo: item.rep_range?.[0],
    repHi: item.rep_range?.[1],
    rir: item.target_rir,
    step: item.min_step_kg || 2.5,
    mode: item.mode || 'normal',
    lift: item.lift || null,
    round: item.round || 'near',
  };
  const e1 = stats[item.exercise_code]?.e1rm
    || (item.lift && stats[item.lift]?.e1rm)
    || 0;
  return setTargets(ex, { e1rm: e1 || undefined, prevSets, unitLabel: 'kg' });
}

/** 빈 세트 행 생성 (기록 UI용) */
export function blankSets(count, targets = []) {
  return Array.from({ length: count }, (_, i) => ({
    w: targets[i]?.w ?? '',
    reps: targets[i]?.reps ?? '',
    rir: targets[i]?.kind === 'cardio' ? null : (targets[i] ? undefined : 1),
    done: false,
    target_text: targets[i]?.text || '',
  }));
}

/**
 * 세션 payload 에서 exercise_stats 갱신 맵을 만든다.
 * @returns {{ [code]: { e1rm, best_weight, best_reps } }}
 */
export function statsFromSession(exercises) {
  const out = {};
  for (const ex of exercises || []) {
    const code = ex.code || ex.exercise_code;
    if (!code) continue;
    let bestW = 0, bestR = 0, bestE = 0;
    for (const s of ex.sets || []) {
      if (!s.done || !(+s.w > 0) || !(+s.reps > 0)) continue;
      const e = e1rm(+s.w, +s.reps, +(s.rir ?? 0));
      if (e > bestE) { bestE = e; bestW = +s.w; bestR = +s.reps; }
    }
    if (bestE) out[code] = { e1rm: bestE, best_weight: bestW, best_reps: bestR };
  }
  return out;
}
