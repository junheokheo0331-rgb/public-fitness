/* ============================================================
   exercise-catalog.js — workoutapp 운동 카탈로그·검색 이식
   루틴 편집 시 종목 추가 자동완성용.
   ============================================================ */

export const EXERCISE_CATALOG = [
  { name: '바벨 벤치프레스', equip: '바벨', lift: '벤치프레스', alias: ['벤치', 'bench'], muscles: ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'] },
  { name: '인클라인 바벨 벤치프레스', equip: '바벨', lift: '벤치프레스', alias: ['인클벤치'], muscles: ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'] },
  { name: '덤벨 벤치프레스', equip: '덤벨', muscles: ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'] },
  { name: '인클라인 덤벨 프레스', equip: '덤벨', alias: ['인클덤벨'], muscles: ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'] },
  { name: '인클라인 스미스 벤치프레스', equip: '머신', muscles: ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'] },
  { name: '머신 체스트프레스', equip: '머신', muscles: ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'] },
  { name: '펙덱 플라이', equip: '머신', alias: ['팩덱', '펙덱'], muscles: ['pectoralis_major'] },
  { name: '케이블 크로스오버', equip: '케이블', alias: ['케이블플라이'], muscles: ['pectoralis_major'] },
  { name: '딥스', equip: '맨몸', muscles: ['pectoralis_major', 'triceps_brachii', 'anterior_deltoid'] },

  { name: '랫풀다운', equip: '머신', muscles: ['latissimus_dorsi', 'biceps_brachii', 'rhomboids'] },
  { name: '클로스그립 랫풀다운', equip: '머신', muscles: ['latissimus_dorsi', 'biceps_brachii'] },
  { name: '풀업', equip: '맨몸', alias: ['턱걸이', '친업'], muscles: ['latissimus_dorsi', 'biceps_brachii', 'rhomboids'] },
  { name: '바벨 로우', equip: '바벨', alias: ['벤트오버로우'], muscles: ['latissimus_dorsi', 'rhomboids', 'biceps_brachii', 'posterior_deltoid'] },
  { name: '덤벨 원암 로우', equip: '덤벨', alias: ['원암덤벨로우'], muscles: ['latissimus_dorsi', 'rhomboids', 'biceps_brachii'] },
  { name: '시티드 케이블 로우', equip: '케이블', muscles: ['latissimus_dorsi', 'rhomboids', 'biceps_brachii'] },
  { name: '머신 시티드 로우', equip: '머신', muscles: ['latissimus_dorsi', 'rhomboids', 'biceps_brachii'] },
  { name: '케이블 페이스풀', equip: '케이블', alias: ['페이스풀'], muscles: ['posterior_deltoid', 'trapezius'] },
  { name: '리버스 팩덱 플라이', equip: '머신', alias: ['리버스팩덱'], muscles: ['posterior_deltoid', 'rhomboids'] },

  { name: '바벨 오버헤드프레스', equip: '바벨', alias: ['ohp', '밀리터리프레스'], muscles: ['anterior_deltoid', 'lateral_deltoid', 'triceps_brachii'] },
  { name: '덤벨 숄더프레스', equip: '덤벨', muscles: ['anterior_deltoid', 'lateral_deltoid', 'triceps_brachii'] },
  { name: '스미스 숄더프레스', equip: '머신', muscles: ['anterior_deltoid', 'lateral_deltoid', 'triceps_brachii'] },
  { name: '사이드 레터럴 레이즈', equip: '덤벨', alias: ['사레', '측면삼각'], muscles: ['lateral_deltoid'] },
  { name: '프론트 레이즈', equip: '덤벨', muscles: ['anterior_deltoid'] },

  { name: '바벨 백스쿼트', equip: '바벨', lift: '스쿼트', alias: ['백스쿼트', '스쿼트'], muscles: ['quadriceps', 'gluteus_maximus', 'lower_back'] },
  { name: '프론트 스쿼트', equip: '바벨', lift: '스쿼트', muscles: ['quadriceps', 'gluteus_maximus', 'core'] },
  { name: '레그프레스', equip: '머신', muscles: ['quadriceps', 'gluteus_maximus'] },
  { name: '핵스쿼트', equip: '머신', muscles: ['quadriceps', 'gluteus_maximus'] },
  { name: '레그익스텐션', equip: '머신', muscles: ['quadriceps'] },
  { name: '시티드 레그컬', equip: '머신', muscles: ['hamstrings'] },
  { name: '라잉 레그컬', equip: '머신', muscles: ['hamstrings'] },
  { name: '데드리프트', equip: '바벨', lift: '데드리프트', muscles: ['hamstrings', 'gluteus_maximus', 'lower_back', 'latissimus_dorsi'] },
  { name: '루마니안 데드리프트', equip: '바벨', alias: ['rdl'], muscles: ['hamstrings', 'gluteus_maximus', 'lower_back'] },
  { name: '바벨 힙쓰러스트', equip: '바벨', alias: ['힙쓰러스트'], muscles: ['gluteus_maximus', 'hamstrings', 'core'] },
  { name: '덤벨 런지', equip: '덤벨', alias: ['런지'], muscles: ['quadriceps', 'gluteus_maximus'] },
  { name: '스탠딩 카프레이즈', equip: '머신', alias: ['카프레이즈'], muscles: ['calves'] },

  { name: '바벨컬', equip: '바벨', muscles: ['biceps_brachii'] },
  { name: '덤벨컬', equip: '덤벨', muscles: ['biceps_brachii'] },
  { name: '해머컬', equip: '덤벨', muscles: ['biceps_brachii', 'forearms'] },
  { name: '케이블컬', equip: '케이블', muscles: ['biceps_brachii'] },
  { name: '케이블 푸시다운', equip: '케이블', alias: ['푸시다운'], muscles: ['triceps_brachii'] },
  { name: '오버헤드 트라이셉스 익스텐션', equip: '케이블', alias: ['오버헤드익스텐션'], muscles: ['triceps_brachii'] },
  { name: '라잉 트라이셉스 익스텐션', equip: '바벨', alias: ['스컬크러셔'], muscles: ['triceps_brachii'] },

  { name: '크런치', equip: '맨몸', muscles: ['core'] },
  { name: '플랭크', equip: '맨몸', muscles: ['core'] },
  { name: '레그레이즈', equip: '맨몸', muscles: ['core'] },
  { name: '케이블 크런치', equip: '케이블', muscles: ['core'] },
];

export function normalizeExName(s) {
  return String(s || '').toLowerCase().replace(/[\s()·\-_.]/g, '');
}

/** 카탈로그 검색. 앞부분 일치 우선. */
export function searchExerciseCatalog(query, limit = 8) {
  const q = normalizeExName(query);
  if (!q) return [];
  const scored = [];
  for (const c of EXERCISE_CATALOG) {
    const n = normalizeExName(c.name);
    const aliases = (c.alias || []).map(normalizeExName);
    let score = -1;
    if (n === q || aliases.includes(q)) score = 0;
    else if (n.startsWith(q)) score = 1;
    else if (aliases.some((a) => a.startsWith(q))) score = 2;
    else if (n.includes(q)) score = 3;
    else if (aliases.some((a) => a.includes(q))) score = 4;
    if (score >= 0) scored.push({ c, score });
  }
  scored.sort((a, b) => a.score - b.score || a.c.name.length - b.c.name.length);
  return scored.slice(0, limit).map((x) => x.c);
}

/** workoutapp store.ex — 루틴 종목 기본값 */
export function makeExercise(o = {}) {
  return {
    id: 'x' + Math.random().toString(36).slice(2, 9),
    type: 'weight',
    targetMin: 30,
    name: '',
    equip: '머신',
    lift: '',
    sets: 3,
    repLo: 8,
    repHi: 12,
    rir: 1,
    rest: 150,
    mode: 'normal',
    round: 'near',
    note: '',
    muscles: [],
    ...o,
  };
}

export function catalogToRoutineItem(c, overrides = {}) {
  return makeExercise({
    name: c.name,
    equip: c.equip || '머신',
    lift: c.lift || '',
    muscles: c.muscles ? c.muscles.slice() : [],
    ...overrides,
  });
}

/** GymLink buildRoutine item ↔ 편집용 exercise 상호 변환 */
export function itemToEditable(item) {
  return makeExercise({
    id: item.id || item.exercise_code || ('x' + Math.random().toString(36).slice(2, 9)),
    type: item.duration_min ? 'cardio' : 'weight',
    targetMin: item.duration_min || 30,
    name: item.name,
    equip: item.machine_name || item.equip || '',
    lift: item.lift || '',
    sets: item.sets || 3,
    repLo: item.rep_range?.[0] ?? 8,
    repHi: item.rep_range?.[1] ?? 12,
    rir: item.target_rir ?? 1,
    rest: item.rest_sec ?? 150,
    mode: item.mode || 'normal',
    note: item.setup_note || item.note || '',
    exercise_code: item.exercise_code,
    machine_code: item.machine_code,
    machine_name: item.machine_name,
    min_step_kg: item.min_step_kg,
  });
}

export function editableToItem(ex) {
  if (ex.type === 'cardio') {
    return {
      id: ex.id,
      exercise_code: ex.exercise_code || 'CARDIO',
      name: ex.name || '유산소',
      machine_code: ex.machine_code || null,
      machine_name: ex.equip || null,
      sets: 1,
      duration_min: ex.targetMin || 20,
      intensity: null,
      rest_sec: 0,
      note: ex.note || null,
    };
  }
  return {
    id: ex.id,
    exercise_code: ex.exercise_code || ex.id,
    name: ex.name,
    machine_code: ex.machine_code || null,
    machine_name: ex.machine_name || ex.equip || null,
    is_freeform: true,
    setup_note: ex.note || null,
    sets: Number(ex.sets) || 3,
    rep_range: [Number(ex.repLo) || 8, Number(ex.repHi) || 12],
    target_rir: Number(ex.rir) ?? 1,
    suggested_kg: null,
    rest_sec: Number(ex.rest) || 90,
    mode: ex.mode || 'normal',
    lift: ex.lift || null,
    round: ex.round || 'near',
    min_step_kg: ex.min_step_kg || (ex.equip === '바벨' ? 2.5 : ex.equip === '덤벨' ? 2 : 5),
  };
}
