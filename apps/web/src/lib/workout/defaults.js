import { makeExercise } from '@gymlink/core/catalog';

function ex(name, o = {}) {
  return makeExercise({ name, ...o });
}

/** GymLink용 가벼운 연습 프로그램 (헬스장 기구 루틴과 별개) */
export function defaultPrograms() {
  return [
    {
      id: 'prog_full',
      title: '전신',
      desc: '주 2~3회 · 기구 있을 때',
      dayHint: 0,
      items: [
        ex('바벨 백스쿼트', { equip: '바벨', lift: '스쿼트', sets: 3, repLo: 6, repHi: 10, rir: 2, rest: 150 }),
        ex('바벨 벤치프레스', { equip: '바벨', lift: '벤치프레스', sets: 3, repLo: 6, repHi: 10, rir: 2, rest: 150 }),
        ex('랫풀다운', { equip: '머신', sets: 3, repLo: 8, repHi: 12, rir: 1, rest: 120 }),
        ex('덤벨 숄더프레스', { equip: '덤벨', sets: 3, repLo: 8, repHi: 12, rir: 1, rest: 90 }),
      ],
    },
    {
      id: 'prog_upper',
      title: '상체',
      desc: '밀기·당기기',
      dayHint: 1,
      items: [
        ex('바벨 벤치프레스', { equip: '바벨', lift: '벤치프레스', sets: 3, repLo: 6, repHi: 10, rir: 2, rest: 150 }),
        ex('랫풀다운', { equip: '머신', sets: 3, repLo: 8, repHi: 12, rir: 1, rest: 120 }),
        ex('덤벨 숄더프레스', { equip: '덤벨', sets: 3, repLo: 8, repHi: 12, rir: 1, rest: 90 }),
        ex('케이블 푸시다운', { equip: '케이블', sets: 2, repLo: 10, repHi: 15, rir: 1, rest: 75 }),
      ],
    },
    {
      id: 'prog_lower',
      title: '하체',
      desc: '스쿼트·힌지',
      dayHint: 2,
      items: [
        ex('바벨 백스쿼트', { equip: '바벨', lift: '스쿼트', sets: 3, repLo: 6, repHi: 10, rir: 2, rest: 180 }),
        ex('루마니안 데드리프트', { equip: '바벨', sets: 3, repLo: 8, repHi: 12, rir: 2, rest: 150 }),
        ex('레그프레스', { equip: '머신', sets: 3, repLo: 10, repHi: 15, rir: 1, rest: 120 }),
        ex('시티드 레그컬', { equip: '머신', sets: 3, repLo: 10, repHi: 15, rir: 1, rest: 90 }),
      ],
    },
  ];
}

export function defaultSettings() {
  return {
    isFirstRun: false,
    age: null,
    gender: 'male',
    rhr: 70,
    unit: 'kg',
    unitBar: 2.5,
    unitMachine: 5,
    unitDumbbell: 2,
    capUp: 0.025,
    capDown: 0.03,
    baseline: {
      스쿼트: { w: 0, reps: 1, rir: 0 },
      벤치프레스: { w: 0, reps: 1, rir: 0 },
      데드리프트: { w: 0, reps: 1, rir: 0 },
    },
    autoRest: true,
    defaultRest: 90,
    sound: true,
    vibrate: true,
    notify: false,
    wakelock: true,
    cardioMin: 20,
  };
}

export function defaultState() {
  return {
    version: 7,
    settings: defaultSettings(),
    programs: defaultPrograms(),
    logs: {},
    timer: null,
    session: null,
  };
}

/** makeExercise → targetsForItem 입력 */
export function exerciseToItem(ex) {
  if (ex.type === 'cardio') {
    return {
      id: ex.id,
      exercise_code: ex.id,
      name: ex.name,
      duration_min: ex.targetMin || 20,
      sets: 1,
    };
  }
  const step = ex.equip === '바벨' ? 2.5 : ex.equip === '덤벨' ? 2 : 5;
  return {
    id: ex.id,
    exercise_code: ex.id,
    name: ex.name,
    sets: Number(ex.sets) || 3,
    rep_range: [Number(ex.repLo) || 8, Number(ex.repHi) || 12],
    target_rir: Number(ex.rir) ?? 1,
    rest_sec: Number(ex.rest) || 90,
    mode: ex.mode || 'normal',
    lift: ex.lift || null,
    round: ex.round || 'near',
    min_step_kg: ex.min_step_kg || step,
  };
}
