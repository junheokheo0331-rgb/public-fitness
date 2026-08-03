/* ============================================================
   routine.js — 루틴 생성 엔진
   이 파일이 GymLink 의 차별점 전부다.
   다른 루틴 앱과의 유일한 구조적 차이: "이 헬스장에 실제로 있는 기구"
   목록을 입력으로 받고, 없는 기구는 절대 추천하지 않는다.

   RPE/e1RM 로직에 (1) 머신 제약 (2) 최소 증량 단위 (3) 회피 필터를 더했다.

   ★ 용어 주의 ★
   "처방(prescription)"이라는 말을 쓰지 않는다. 기능이 같아도 이름 때문에
   불리해진다. 의료법상 처방은 의료인의 행위를 가리키고, 비의료기관이
   대상자의 상태에 따른 처방을 수반하는 서비스를 제공하면 의료행위로
   판단될 수 있다. 이 엔진은 "추천(suggestion)"만 한다.
   docs/LEGAL.md 2장 참고.
   ============================================================ */

/* ---------- RPE ↔ %1RM (Zourdos et al. 2016 / RTS 차트) ---------- */
const RPE_COLS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];
const RPE_TABLE = [
  [100.0, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3],
  [95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7],
  [92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1],
  [89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6],
  [86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2],
  [83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9],
  [81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7],
  [78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0],
  [76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3],
  [73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6],
  [70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9],
  [68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9, 58.6, 57.2],
];

function rpeColIdx(rpe) {
  let best = 0, bd = Infinity;
  RPE_COLS.forEach((v, i) => { const d = Math.abs(v - rpe); if (d < bd) { bd = d; best = i; } });
  return best;
}

export function pct1RM(reps, rpe) {
  const r = Math.min(12, Math.max(1, Math.round(reps)));
  return RPE_TABLE[r - 1][rpeColIdx(rpe)];
}

/** 무게·반복·RIR → 추정 1RM */
export function e1rm(weight, reps, rir = 0) {
  if (!weight || !reps) return 0;
  const p = pct1RM(reps, 10 - rir);
  return Math.round((weight / (p / 100)) * 10) / 10;
}

/** 이 e1RM 을 가진 사람이 이 무게로 이 RPE까지 하면 몇 회인가 */
export function repsAt(load, est1rm, rpe) {
  if (!est1rm || !load) return 0;
  const target = (load / est1rm) * 100;
  const col = rpeColIdx(rpe);
  let out = 1;
  for (let r = 1; r <= 12; r++) if (RPE_TABLE[r - 1][col] >= target) out = r;
  return out;
}

/* ---------- 중량 반올림 ----------
   현장 문제: 헬스장에 2.5kg 원판이 없으면 이론상 최적 중량은 무의미하다.
   gym_machines.min_step_kg 를 받아 실제로 세팅 가능한 값으로 내린다.
   기본값 2.5kg, 머신 스택은 보통 5kg. 관장이 등록할 때 넣게 되어 있다. */
export function snapWeight(kg, step = 2.5) {
  if (!kg) return 0;
  const s = step > 0 ? step : 2.5;
  return Math.max(s, Math.floor(kg / s) * s);
}

/* ============================================================
   1. 머신 제약 필터
   ============================================================ */

/**
 * @param {Array} available  available_exercises() RPC 결과
 * @param {Object} opts
 * @param {number} opts.level         1~3
 * @param {string[]} opts.avoid       회피 태그 ['shoulder', 'knee', ...] — 통증 부위 자가신고
 * @param {string[]} opts.excludeCodes 회원이 싫어하는 종목 코드
 */
export function filterExercises(available, opts = {}) {
  const { level = 2, avoid = [], excludeCodes = [] } = opts;
  return available.filter((e) => {
    if (e.skill_level > level) return false;
    if (excludeCodes.includes(e.code)) return false;
    if (avoid.length && (e.avoid_areas || e.contraindications || []).some((c) => avoid.includes(c))) return false;
    return true;
  });
}

/* ============================================================
   2. 분할 템플릿
   초보에게 5분할을 주면 안 된다. 주당 빈도로 분할을 강제한다.
   ============================================================ */
const SPLITS = {
  2: [{ name: '전신 A', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'core'] },
      { name: '전신 B', patterns: ['hinge', 'vertical_push', 'vertical_pull', 'squat', 'core'] }],
  3: [{ name: '전신 A', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'core'] },
      { name: '전신 B', patterns: ['hinge', 'vertical_push', 'vertical_pull', 'core'] },
      { name: '전신 C', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'abduction'] }],
  4: [{ name: '상체 A', patterns: ['horizontal_push', 'horizontal_pull', 'abduction', 'elbow_extension'] },
      { name: '하체 A', patterns: ['squat', 'flexion', 'extension', 'plantarflexion'] },
      { name: '상체 B', patterns: ['vertical_push', 'vertical_pull', 'horizontal_abduction', 'elbow_flexion'] },
      { name: '하체 B', patterns: ['hinge', 'squat', 'abduction', 'core'] }],
  5: [{ name: '가슴',   patterns: ['horizontal_push', 'horizontal_adduction', 'elbow_extension'] },
      { name: '등',     patterns: ['vertical_pull', 'horizontal_pull', 'elbow_flexion'] },
      { name: '하체 A', patterns: ['squat', 'extension', 'plantarflexion'] },
      { name: '어깨',   patterns: ['vertical_push', 'abduction', 'horizontal_abduction'] },
      { name: '하체 B', patterns: ['hinge', 'flexion', 'abduction'] }],
  6: [{ name: '상체 A', patterns: ['horizontal_push', 'horizontal_pull', 'abduction'] },
      { name: '하체 A', patterns: ['squat', 'extension', 'flexion'] },
      { name: '상체 B', patterns: ['vertical_push', 'vertical_pull', 'elbow_flexion', 'elbow_extension'] },
      { name: '하체 B', patterns: ['hinge', 'squat', 'abduction'] },
      { name: '상체 C', patterns: ['horizontal_push', 'horizontal_pull', 'horizontal_abduction'] },
      { name: '하체 C', patterns: ['hinge', 'extension', 'plantarflexion'] }],
};

/* 목표별 세트·반복·RIR 기본값 */
const GOAL_RX = {
  strength:    { compound: { sets: 4, reps: [3, 5],   rir: 2 }, isolation: { sets: 3, reps: [6, 8],   rir: 2 } },
  hypertrophy: { compound: { sets: 3, reps: [6, 10],  rir: 2 }, isolation: { sets: 3, reps: [10, 15], rir: 1 } },
  fatloss:     { compound: { sets: 3, reps: [8, 12],  rir: 3 }, isolation: { sets: 2, reps: [12, 20], rir: 2 } },
  conditioning:{ compound: { sets: 2, reps: [10, 15], rir: 4 }, isolation: { sets: 3, reps: [12, 20], rir: 4 } },
};

/* 휴식시간 (초). 상급자는 복합운동 휴식을 길게 가져간다. */
function restFor(ex, goal) {
  if (ex.pattern === 'cardio') return 0;
  if (goal === 'strength' && ex.is_compound) return 240;
  if (ex.is_compound) return 180;
  return 90;
}

/* ============================================================
   3. 루틴 생성
   ============================================================ */

/**
 * 헬스장 머신 제약을 지키는 루틴을 만든다.
 *
 * @param {Object} p
 * @param {Array}  p.available   available_exercises(gym_id) 결과
 * @param {number} p.daysPerWeek 2~6
 * @param {string} p.goal        strength|hypertrophy|fatloss|conditioning
 * @param {number} p.level       1~3
 * @param {string[]} p.avoid     회피 부위
 * @param {string[]} p.excludeCodes
 * @param {Object} p.stats       { [exercise_code]: { e1rm } }
 * @param {boolean} p.zone2      매 세션 끝에 가벼운 유산소 추가 (기본 off)
 * @returns {{days: Array, warnings: string[]}}
 */
export function buildRoutine(p) {
  const {
    available = [], daysPerWeek = 3, goal = 'hypertrophy', level = 2,
    avoid = [], excludeCodes = [], stats = {}, zone2 = false,
  } = p;

  const warnings = [];
  const pool = filterExercises(available, { level, avoid, excludeCodes });

  if (!pool.length) {
    return { days: [], warnings: ['이 헬스장에 등록된 기구로 만들 수 있는 종목이 없습니다. 관장님께 머신 등록을 요청하세요.'] };
  }

  const d = Math.min(6, Math.max(2, daysPerWeek));
  const template = SPLITS[d];
  const rx = GOAL_RX[goal] || GOAL_RX.hypertrophy;

  const byPattern = pool.reduce((acc, e) => {
    (acc[e.pattern] = acc[e.pattern] || []).push(e);
    return acc;
  }, {});

  // 같은 주에 같은 종목이 과도하게 반복되지 않도록 사용 횟수를 센다
  const used = {};
  const pick = (pattern) => {
    const cands = (byPattern[pattern] || []).slice()
      .sort((a, b) => (used[a.code] || 0) - (used[b.code] || 0)
                   || (b.is_compound - a.is_compound));
    if (!cands.length) return null;
    const chosen = cands[0];
    used[chosen.code] = (used[chosen.code] || 0) + 1;
    return chosen;
  };

  const days = template.map((day, i) => {
    const items = [];
    for (const pattern of day.patterns) {
      const ex = pick(pattern);
      if (!ex) { warnings.push(`${day.name}: '${pattern}' 을(를) 수행할 기구가 이 헬스장에 없습니다.`); continue; }
      const spec = ex.is_compound ? rx.compound : rx.isolation;
      const est = stats[ex.code]?.e1rm || 0;
      const targetReps = Math.round((spec.reps[0] + spec.reps[1]) / 2);
      const load = est
        ? snapWeight(est * (pct1RM(targetReps, 10 - spec.rir) / 100), ex.min_step_kg || 2.5)
        : null;

      items.push({
        exercise_code: ex.code,
        name: ex.name_ko,
        machine_code: ex.machine_code,
        machine_name: ex.machine_name,
        // 케이블·프리웨이트 종목은 현장에서 얼마든지 변형된다.
        // 앱이 '변형 가능' 배지를 띄우고 트레이너가 자기 버전을 만들 수 있게 한다.
        is_freeform: !!ex.is_freeform,
        setup_note: ex.setup_note || null,
        is_substitute: ex.is_substitute,   // 대체 기구로 배정됐다는 표시
        sets: spec.sets,
        rep_range: spec.reps,
        target_rir: spec.rir,
        suggested_kg: load,                // null 이면 "첫 세션은 가볍게 감 잡기"
        rest_sec: restFor(ex, goal),
      });

      if (ex.is_substitute) {
        warnings.push(`${ex.name_ko}: 원래 기구가 없어 대체 기구로 배정했습니다.`);
      }
    }

    if (zone2) {
      const cardio = (byPattern.cardio || [])[0];
      if (cardio) {
        items.push({
          exercise_code: cardio.code, name: cardio.name_ko,
          machine_code: cardio.machine_code, machine_name: cardio.machine_name,
          is_freeform: false, setup_note: cardio.setup_note || null,
          sets: 1, duration_min: 20,
          intensity: '가볍게', rest_sec: 0,
        });
      }
    }

    return { day_index: i, name: day.name, items };
  });

  return { days, warnings: [...new Set(warnings)] };
}

/* ============================================================
   4. 자동조절 — 지난 수행 기록으로 이번 주 목표 중량을 갱신
   회원 입장에서 "지난번 무게가 아래 뜨고 이번 목표가 자동 계산되는 것"이
   앱을 계속 쓰게 만드는 지점이다.
   ============================================================ */

/**
 * @param {Object} last  { weight, reps, rir }
 * @param {Object} spec  { reps:[lo,hi], rir }
 * @param {number} step  최소 증량 단위
 */
export function nextTarget(last, spec, step = 2.5) {
  if (!last || !last.weight) return { weight: null, reps: spec.reps[0], note: '감각으로 시작' };

  const est = e1rm(last.weight, last.reps, last.rir ?? 0);
  const targetReps = Math.round((spec.reps[0] + spec.reps[1]) / 2);
  const raw = est * (pct1RM(targetReps, 10 - spec.rir) / 100);
  const weight = snapWeight(raw, step);

  let note = '유지';
  if (weight > last.weight) note = `+${(weight - last.weight).toFixed(1)}kg 증량`;
  else if (weight < last.weight) note = `−${(last.weight - weight).toFixed(1)}kg 감량 (지난 세션 RIR 기준)`;
  else if (last.reps >= spec.reps[1]) note = '중량 동일, 반복 1회 추가 목표';

  return { weight, reps: targetReps, est1rm: est, note };
}

export const _internal = { SPLITS, GOAL_RX, RPE_TABLE, RPE_COLS };
