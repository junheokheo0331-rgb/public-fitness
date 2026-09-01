import { useMemo, useState } from 'react';
import { makeExercise, normalizeExName } from '@gymlink/core/catalog';
import { EXERCISES } from '../lib/catalog.js';
import { exerciseArtwork } from '../lib/exercise-art.js';
import { Chip, Field } from './bits.jsx';

function equipmentLabel(requires = []) {
  if (!requires.length) return '맨몸';
  if (requires.some((value) => value.startsWith('machine_'))) return '머신';
  if (requires.some((value) => value.startsWith('cable_'))) return '케이블';
  if (requires.includes('dumbbell')) return '덤벨';
  if (requires.includes('barbell')) return '바벨';
  if (requires.includes('smith')) return '스미스 머신';
  if (requires.includes('kettlebell')) return '케틀벨';
  return '기구';
}

const BODY_PARTS = [
  ['all', '전체'], ['chest', '가슴'], ['back', '등'], ['shoulder', '어깨'],
  ['legs', '하체'], ['arms', '팔'], ['core', '코어'], ['cardio', '유산소'],
];
const EQUIPMENT = [['all', '모든 기구'], ['machine', '머신'], ['cable', '케이블'], ['barbell', '바벨'], ['dumbbell', '덤벨'], ['body', '맨몸']];

function bodyPart(exercise) {
  const text = `${exercise.pattern} ${(exercise.primary_muscles || []).join(' ')}`;
  if (/cardio|유산소/.test(text)) return 'cardio';
  if (/core|rotation|복근|복사근|코어/.test(text)) return 'core';
  if (/elbow|이두|삼두|전완/.test(text)) return 'arms';
  if (/squat|hinge|extension|flexion|adduction|둔근|대퇴|햄스트링|종아리|내전근|중둔근/.test(text)) return 'legs';
  if (/vertical_push|abduction|어깨|삼각근/.test(text)) return 'shoulder';
  if (/pull|광배|능형근|승모근|등/.test(text)) return 'back';
  return 'chest';
}

function equipmentKind(requires = []) {
  if (requires.some((v) => v.startsWith('machine_'))) return 'machine';
  if (requires.some((v) => v.startsWith('cable_'))) return 'cable';
  if (requires.includes('barbell') || requires.includes('ez_bar')) return 'barbell';
  if (requires.includes('dumbbell')) return 'dumbbell';
  return 'body';
}

export function toEditableExercise(exercise) {
  return makeExercise({
    name: exercise.name,
    equip: exercise.machineName || exercise.equip,
    exercise_code: exercise.code,
    machine_code: exercise.machineCode || null,
    machine_name: exercise.machineName || exercise.equip,
    machine_photo_url: exercise.machinePhoto || null,
    machine_brand: exercise.machineBrand || null,
    machine_model_name: exercise.machineModelName || null,
    min_step_kg: exercise.minStepKg || undefined,
    note: exercise.setup || '',
    pattern: exercise.pattern,
    primary_muscles: exercise.primaryMuscles || [],
    laterality: exercise.laterality || 'either',
  });
}

export default function ExercisePicker({ available = [], query, onQueryChange, onAdd, selectedCodes = [] }) {
  const [part, setPart] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [scope, setScope] = useState('gym');
  const availableByCode = useMemo(
    () => new Map(available.map((exercise) => [exercise.code || exercise.exercise_code, exercise])),
    [available],
  );
  const selected = useMemo(() => new Set(selectedCodes.filter(Boolean)), [selectedCodes]);

  const suggestions = useMemo(() => {
    const normalized = normalizeExName(query);
    const effectiveScope = available.length ? scope : 'all';
    return EXERCISES.map((exercise) => {
      const match = availableByCode.get(exercise.code);
      return {
        code: exercise.code,
        name: exercise.name_ko,
        pattern: exercise.pattern,
        equip: equipmentLabel(exercise.requires),
        setup: exercise.setup,
        primaryMuscles: match?.primary_muscles || exercise.primary_muscles || [],
        laterality: match?.laterality || 'either',
        machineCode: match?.machine_code,
        machineName: match?.machine_name,
        machinePhoto: match?.machine_photo_url,
        machineBrand: match?.machine_brand,
        machineModelName: match?.machine_model_name,
        minStepKg: match?.min_step_kg,
        availableHere: Boolean(match),
        part: bodyPart(exercise),
        equipmentKind: equipmentKind(exercise.requires),
      };
    }).filter((exercise) => (
      (part === 'all' || exercise.part === part)
      && (equipment === 'all' || exercise.equipmentKind === equipment)
      && (effectiveScope === 'all' || exercise.availableHere)
      && (!normalized || normalizeExName(`${exercise.name} ${exercise.equip} ${exercise.machineName || ''} ${exercise.machineBrand || ''} ${exercise.machineModelName || ''} ${exercise.pattern} ${exercise.primaryMuscles.join(' ')}`).includes(normalized))
    )).sort((a, b) => Number(b.availableHere) - Number(a.availableHere) || a.name.localeCompare(b.name, 'ko'))
      .slice(0, normalized ? 60 : 24);
  }, [availableByCode, available.length, query, part, equipment, scope]);

  return (
    <div className="exercise-picker">
      <Field label="운동 종목 추가">
        <input
          className="input" type="search" placeholder="이름·부위·동작 검색 (예: 등, 수직 당기기, 원암)"
          value={query} onChange={(event) => onQueryChange(event.target.value)}
        />
      </Field>
      <div className="exercise-picker__filters" aria-label="운동 범위">
        {available.length > 0 && <button type="button" className={`chip ${scope === 'gym' ? 'chip--pick' : ''}`} onClick={() => setScope('gym')}>내 헬스장 추천</button>}
        <button type="button" className={`chip ${scope === 'all' || !available.length ? 'chip--pick' : ''}`} onClick={() => setScope('all')}>전체 운동</button>
      </div>
      <div className="exercise-picker__filters" aria-label="운동 부위">
        {BODY_PARTS.map(([value, label]) => <button key={value} type="button" className={`chip ${part === value ? 'chip--pick' : ''}`} onClick={() => setPart(value)}>{label}</button>)}
      </div>
      <div className="exercise-picker__filters" aria-label="운동 기구">
        {EQUIPMENT.map(([value, label]) => <button key={value} type="button" className={`chip ${equipment === value ? 'chip--pick' : ''}`} onClick={() => setEquipment(value)}>{label}</button>)}
      </div>
      {!query.trim() && available.length > 0 && scope === 'gym' && <p className="tiny muted">현재 헬스장에서 바로 할 수 있는 운동입니다. 머신 등록 정보를 기준으로 연결합니다.</p>}
      {suggestions.length > 0 && (
        <ul className="list exercise-picker__list">
          {suggestions.map((exercise) => {
            const isSelected = selected.has(exercise.code);
            const artwork = exerciseArtwork(exercise);
            return (
            <li key={exercise.code}>
              <button type="button" className="list__item" disabled={isSelected} onClick={() => onAdd(exercise)}>
                {artwork && <img className="exercise-picker__photo" src={artwork.url} alt={artwork.alt} loading="lazy" />}
                <div className="list__body">
                  <div className="row row--wrap" style={{ gap: 6 }}>
                    <span className="list__title">{exercise.name}</span>
                    {exercise.availableHere && <Chip kind="machine">내 헬스장</Chip>}
                    {!exercise.availableHere && available.length > 0 && <Chip kind="sub">매칭 확인 필요</Chip>}
                  </div>
                  <div className="list__meta">{[exercise.machineBrand, exercise.machineModelName, exercise.machineName || exercise.equip].filter(Boolean).join(' · ')}{exercise.setup ? ` · ${exercise.setup}` : ''}</div>
                  {exercise.primaryMuscles.length > 0 && <div className="tiny muted">{exercise.primaryMuscles.join(' · ')}</div>}
                </div>
                <span className="list__right">{isSelected ? '추가됨' : '+'}</span>
              </button>
            </li>
          );})}
        </ul>
      )}
      {query.trim() && suggestions.length === 0 && <p className="small muted">일치하는 기본 운동이 없습니다.</p>}
    </div>
  );
}
