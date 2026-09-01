/** 새 계정은 빈 상태에서 시작한다. 루틴은 사용자 또는 Supabase 데이터로 채운다. */
export function defaultPrograms() {
  return [];
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
      스쿼트: { w: 0, reps: 1 },
      벤치프레스: { w: 0, reps: 1 },
      데드리프트: { w: 0, reps: 1 },
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
    version: 8,
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
    rest_sec: Number(ex.rest) || 90,
    mode: ex.mode || 'normal',
    lift: ex.lift || null,
    round: ex.round || 'near',
    min_step_kg: ex.min_step_kg || step,
  };
}
