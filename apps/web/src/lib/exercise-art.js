import { getAssetUrl, getExercise } from '@bryllim/workout-guide';

/*
 * 실제 지점 머신 사진이 없을 때 쓰는 공개 운동 일러스트 매칭.
 * Workout Guide의 시각 자료는 CC BY-SA 4.0이며, 화면과 문서에 출처를 표시한다.
 * 종목명이 늘어나도 동작 패턴과 기구 요구조건으로 안전한 대표 동작을 찾는다.
 */
const PATTERN_SLUG = {
  horizontal_push: 'machine-chest-press',
  horizontal_pull: 'machine-row',
  vertical_push: 'seated-dumbbell-shoulder-press',
  vertical_pull: 'lat-pulldown',
  horizontal_adduction: 'pec-deck',
  horizontal_abduction: 'reverse-pec-deck',
  squat: 'squat',
  hinge: 'romanian-deadlift',
  extension: 'leg-extension',
  flexion: 'seated-leg-curl',
  abduction: 'hip-abduction-machine',
  adduction: 'hip-adduction-machine',
  plantarflexion: 'standing-calf-raise',
  elbow_flexion: 'bicep-curl',
  elbow_extension: 'tricep-pushdown',
  core: 'plank',
  rotation: 'cable-woodchop',
  carry: 'farmers-walk',
  cardio: 'treadmill-incline-walk',
};

function byIdentity(exercise) {
  const code = String(exercise?.code || exercise?.exercise_code || '').toUpperCase();
  const name = String(exercise?.name || exercise?.name_ko || '');
  const machine = String(exercise?.machineName || exercise?.machine_name || exercise?.equip || '');
  const text = `${code} ${name} ${machine}`;

  if (/LAT|랫|PULLDOWN|풀다운/.test(text)) return 'lat-pulldown';
  if (/PULLUP|풀업|턱걸이/.test(text)) return 'pull-up';
  if (/PEC|FLY|플라이|펙덱/.test(text) && /REAR|리어|후면/.test(text)) return 'reverse-pec-deck';
  if (/PEC|FLY|플라이|펙덱/.test(text)) return 'pec-deck';
  if (/HIGH_ROW|LOW_ROW|SEATED_ROW|MACHINE_ROW|로우|로우 머신|시티드/.test(text)) return 'machine-row';
  if (/BARBELL.*ROW|BB_ROW|바벨.*로우/.test(text)) return 'barbell-row';
  if (/DUMBBELL.*ROW|DB_.*ROW|덤벨.*로우/.test(text)) return 'dumbbell-row';
  if (/LEG_PRESS|레그 ?프레스/.test(text)) return 'leg-press';
  if (/LEG_EXT|레그 ?익스텐션/.test(text)) return 'leg-extension';
  if (/LEG_CURL|레그 ?컬/.test(text)) return /SEATED|시티드/.test(text) ? 'seated-leg-curl' : 'lying-leg-curl';
  if (/HACK|핵 ?스쿼트/.test(text)) return 'hack-squat';
  if (/BULGARIAN|불가리안/.test(text)) return 'bulgarian-split-squat';
  if (/SQUAT|스쿼트/.test(text)) return 'squat';
  if (/RDL|ROMANIAN|루마니안/.test(text)) return 'romanian-deadlift';
  if (/DEADLIFT|데드리프트/.test(text)) return 'deadlift';
  if (/HIP_THRUST|힙 ?쓰러스트/.test(text)) return 'hip-thrust';
  if (/ABDUCT|어브덕/.test(text)) return 'hip-abduction-machine';
  if (/ADDUCT|어덕/.test(text)) return 'hip-adduction-machine';
  if (/LATERAL|래터럴|사이드 레터럴/.test(text)) return 'lateral-raise';
  if (/SHOULDER|OVERHEAD|숄더|오버헤드/.test(text) && /PRESS|프레스/.test(text)) return 'seated-dumbbell-shoulder-press';
  if (/CHEST|BENCH|체스트|벤치/.test(text) && /PRESS|프레스/.test(text)) return /INCLINE|인클라인/.test(text) ? 'incline-bench-press' : 'machine-chest-press';
  if (/PUSHDOWN|푸시다운/.test(text)) return 'tricep-pushdown';
  if (/TRICEP|삼두|ARM_EXT/.test(text)) return 'overhead-tricep-extension';
  if (/CURL|컬|이두/.test(text)) return /HAMMER|해머/.test(text) ? 'hammer-curl' : 'bicep-curl';
  if (/PLANK|플랭크/.test(text)) return 'plank';
  if (/CRUNCH|크런치/.test(text)) return 'crunch';
  if (/TREADMILL|트레드밀/.test(text)) return 'treadmill-incline-walk';
  if (/CYCLE|사이클/.test(text)) return 'cycling';
  if (/ROWING|로잉/.test(text)) return 'rowing';
  return null;
}

export function exerciseArtwork(exercise) {
  if (exercise?.machine_photo_url || exercise?.machinePhoto) {
    return { url: exercise.machine_photo_url || exercise.machinePhoto, source: 'gym', alt: `${exercise.machine_name || exercise.machineName || exercise.name || '운동'} 머신` };
  }
  const slug = byIdentity(exercise) || PATTERN_SLUG[exercise?.pattern] || 'push-up';
  const matched = getExercise(slug) || getExercise(PATTERN_SLUG[exercise?.pattern]) || getExercise('push-up');
  return matched ? { url: getAssetUrl(matched.slug, 1), source: 'open', alt: `${exercise?.name || exercise?.name_ko || matched.name} 동작 예시` } : null;
}
