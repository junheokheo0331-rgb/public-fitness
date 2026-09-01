function overlapScore(left = [], right = []) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const value of a) if (b.has(value)) common += 1;
  return common / Math.max(a.size, b.size);
}

function lateralityFits(source = 'either', candidate = 'either') {
  if (source === 'either' || candidate === 'either') return true;
  if (source === candidate) return true;
  return source === 'alternating' && candidate === 'unilateral';
}

export function scoreExerciseMatch(source, candidate) {
  if (source.exercise_code === candidate.code) return 1000;
  let score = 0;
  if (source.pattern && source.pattern === candidate.pattern) score += 60;
  score += Math.round(overlapScore(source.primary_muscles, candidate.primary_muscles) * 30);
  if (lateralityFits(source.laterality, candidate.laterality)) score += 8;
  if (source.is_compound === candidate.is_compound) score += 4;
  if (source.force_path && source.force_path === candidate.force_path) score += 6;
  return score;
}

/**
 * 기존 세트·반복·휴식은 유지하고, 새 헬스장에서 같은 운동 의도를 가장 잘
 * 수행하는 종목과 머신만 바꾼다. 60점 미만은 억지로 바꾸지 않고 확인 대상으로 남긴다.
 */
export function matchRoutineToAvailable(body, available = []) {
  const replacements = [];
  const unmatched = [];
  const next = {
    ...body,
    days: (body?.days || []).map((day) => ({
      ...day,
      items: (day.items || []).map((item) => {
        if (item.duration_min && item.pattern !== 'cardio') return { ...item };
        const ranked = available
          .map((candidate) => ({ candidate, score: scoreExerciseMatch(item, candidate) }))
          .sort((a, b) => b.score - a.score);
        const best = ranked[0];
        if (!best || best.score < 60) {
          unmatched.push({ code: item.exercise_code, name: item.name, pattern: item.pattern });
          return { ...item, needs_machine_review: true };
        }
        const exact = best.score === 1000;
        const candidate = best.candidate;
        if (!exact) replacements.push({
          from_code: item.exercise_code,
          from_name: item.name,
          to_code: candidate.code,
          to_name: candidate.name_ko,
          score: best.score,
          reason: candidate.pattern === item.pattern ? `같은 ${item.pattern} 동작` : '주동근 유사',
        });
        return {
          ...item,
          exercise_code: candidate.code,
          name: candidate.name_ko,
          pattern: candidate.pattern,
          primary_muscles: candidate.primary_muscles || item.primary_muscles || [],
          laterality: candidate.laterality || item.laterality || 'either',
          machine_code: candidate.machine_code,
          machine_name: candidate.machine_name,
          min_step_kg: candidate.min_step_kg || item.min_step_kg,
          setup_note: candidate.setup_note || item.setup_note,
          is_substitute: !exact,
          substituted_from: exact ? null : { code: item.exercise_code, name: item.name },
          match_score: best.score,
          needs_machine_review: false,
        };
      }),
    })),
  };
  return { body: next, replacements, unmatched };
}
