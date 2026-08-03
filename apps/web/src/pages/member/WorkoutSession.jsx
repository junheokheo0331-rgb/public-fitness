import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { targetsForItem, blankSets, progressiveOverloadLines } from '@gymlink/core/progress';
import { TopBar, Card, Chip, Note, Stack, Empty } from '../../ui/bits.jsx';
import SortableList, { reorder } from '../../ui/SortableList.jsx';
import {
  getSavedRoutine, availableExercises, myMembership,
  getExerciseStats, lastSetsForExercise, saveWorkoutSession,
} from '../../lib/api.js';

/* 세트별 무게·반복·RIR 기록 */

export default function WorkoutSession() {
  const { routineId } = useParams();
  const [params] = useSearchParams();
  const dayIndex = Number(params.get('day') || 0);
  const nav = useNavigate();

  const [meta, setMeta] = useState(null);
  const [day, setDay] = useState(null);
  const [stats, setStats] = useState({});
  const [rows, setRows] = useState(null); // [{ item, sets, targets, prevText }]
  const [sessionId] = useState(() => `s${Date.now()}`);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ms = await myMembership();
      const gymId = ms?.gym_id || 'g-1';
      const [routine, ex, st] = await Promise.all([
        getSavedRoutine(routineId),
        availableExercises(gymId),
        getExerciseStats(),
      ]);
      if (!alive) return;
      setMeta(routine);
      setStats(st);

      let body = routine?.body;
      if (!body?.days?.length) {
        body = buildRoutine({
          available: ex,
          daysPerWeek: routine?.days ?? 3,
          goal: routine?.goal ?? 'hypertrophy',
          level: routine?.level ?? 1,
          stats: st,
        });
      }
      const d = body.days[Math.min(dayIndex, body.days.length - 1)];
      setDay(d);

      const built = [];
      for (const item of d.items || []) {
        const prev = await lastSetsForExercise(item.exercise_code);
        const targets = targetsForItem(item, prev || [], st);
        const sets = blankSets(
          item.duration_min ? 1 : (item.sets || targets.length || 3),
          targets,
        ).map((s, i) => ({
          ...s,
          rir: s.rir ?? item.target_rir ?? 1,
          w: s.w === '' ? '' : s.w,
          reps: s.reps === '' ? '' : s.reps,
          target_text: targets[i]?.text || '',
        }));
        const prevDone = (prev || []).filter((s) => s.done && +s.reps > 0);
        const prevText = prevDone.length
          ? prevDone.map((s) => `${s.w}kg×${s.reps}${s.rir != null ? `(R${s.rir})` : ''}`).join(' / ')
          : null;
        built.push({ item, sets, targets, prevText });
      }
      if (alive) setRows(built);
    })();
    return () => { alive = false; };
  }, [routineId, dayIndex]);

  const doneCount = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((a, r) => a + r.sets.filter((s) => s.done).length, 0);
  }, [rows]);

  const patchSet = (ri, si, patch) => {
    setRows((prev) => prev.map((r, i) => {
      if (i !== ri) return r;
      const sets = r.sets.map((s, j) => (j === si ? { ...s, ...patch } : s));
      return { ...r, sets };
    }));
  };

  const toggleDone = (ri, si) => {
    setRows((prev) => prev.map((r, i) => {
      if (i !== ri) return r;
      const sets = r.sets.map((s, j) => {
        if (j !== si) return s;
        if (s.done) return { ...s, done: false };
        const t = r.targets[si];
        return {
          ...s,
          done: true,
          w: s.w === '' && t?.w !== '' ? t.w : s.w,
          reps: s.reps === '' && t?.reps !== '' ? t.reps : s.reps,
        };
      });
      return { ...r, sets };
    }));
  };

  const onReorder = (from, to) => setRows((prev) => reorder(prev, from, to));

  const persist = async (ended = false) => {
    setSaving(true);
    try {
      await saveWorkoutSession({
        sessionId,
        routineId,
        dayIndex,
        ended,
        exercises: rows.map((r) => ({
          code: r.item.exercise_code,
          name: r.item.name,
          sets: r.sets,
        })),
      });
      if (ended) {
        setDoneMsg('오늘 운동을 저장했습니다. 다음 목표가 자동으로 갱신됩니다.');
        setTimeout(() => nav('/my'), 1200);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!rows) {
    return (
      <>
        <TopBar title="운동 기록" back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }

  if (!day?.items?.length) {
    return (
      <>
        <TopBar title="운동 기록" back />
        <Card><Empty title="이 날 종목이 없습니다" /></Card>
      </>
    );
  }

  return (
    <>
      <TopBar
        title={meta?.title || '운동'}
        sub={`${day.name} · 완료 ${doneCount}세트`}
        back
      />

      {doneMsg && <Note kind="go"><p className="small">{doneMsg}</p></Note>}

      {meta?.note && (
        <Note kind="volt" title="트레이너 메모">
          <p className="small">{meta.note}</p>
        </Note>
      )}

      <SortableList
        items={rows}
        keyOf={(r, i) => (r.item.exercise_code || r.item.id || i)}
        onReorder={onReorder}
      >
        {(r, ri) => {
          const po = progressiveOverloadLines(r.item, [], stats);
          return (
            <Card>
              <div className="row row--between" style={{ marginBottom: 8 }}>
                <div className="grow">
                  <strong style={{ fontSize: 15.5 }}>{r.item.name}</strong>
                  <div className="row row--wrap" style={{ gap: 5, marginTop: 4 }}>
                    {r.item.machine_name && <Chip kind="machine">{r.item.machine_name}</Chip>}
                    {r.item.mode === 'restpause' && <Chip kind="sub">레스트포즈</Chip>}
                    {r.item.lift && <Chip kind="sub">{r.item.lift}</Chip>}
                  </div>
                </div>
              </div>

              {r.prevText && (
                <p className="tiny muted" style={{ margin: '0 0 8px' }}>
                  📌 지난 수행 · {r.prevText}
                </p>
              )}
              <p className="tiny" style={{ color: 'var(--volt-ink)', margin: '0 0 8px' }}>{po.rule}</p>

              {r.item.duration_min ? (
                <div className="row row--between">
                  <span className="small">{r.item.duration_min}분 · {r.item.intensity || '가볍게'}</span>
                  <button
                    type="button"
                    className={`btn btn--sm ${r.sets[0]?.done ? '' : 'btn--ghost'}`}
                    onClick={() => toggleDone(ri, 0)}
                  >
                    {r.sets[0]?.done ? '완료됨' : '완료'}
                  </button>
                </div>
              ) : (
                <div className="setlog">
                  {r.sets.map((s, si) => (
                    <div key={si} className={`setlog__row ${s.done ? 'is-done' : ''}`}>
                      <span className="setlog__idx">{si + 1}</span>
                      <input
                        className="input input--num setlog__w"
                        inputMode="decimal"
                        placeholder="kg"
                        value={s.w}
                        onChange={(e) => patchSet(ri, si, { w: e.target.value })}
                      />
                      <span className="tiny muted">×</span>
                      <input
                        className="input input--num setlog__r"
                        inputMode="numeric"
                        placeholder="회"
                        value={s.reps}
                        onChange={(e) => patchSet(ri, si, { reps: e.target.value })}
                      />
                      <input
                        className="input input--num setlog__rir"
                        inputMode="numeric"
                        placeholder="RIR"
                        value={s.rir ?? ''}
                        onChange={(e) => patchSet(ri, si, { rir: e.target.value })}
                      />
                      <button
                        type="button"
                        className={`setlog__chk ${s.done ? 'on' : ''}`}
                        aria-pressed={s.done}
                        onClick={() => toggleDone(ri, si)}
                      >
                        ✓
                      </button>
                      {s.target_text && (
                        <span className="setlog__hint">{s.target_text}</span>
                      )}
                    </div>
                  ))}
                  <Stack
                    total={r.sets.length}
                    done={r.sets.filter((s) => s.done).length}
                    current={r.sets.findIndex((s) => !s.done)}
                  />
                </div>
              )}
            </Card>
          );
        }}
      </SortableList>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        disabled={saving}
        onClick={() => persist(false)}
      >
        {saving ? '저장 중…' : '중간 저장'}
      </button>
      <button
        type="button"
        className="btn btn--block"
        style={{ marginTop: 8 }}
        disabled={saving || doneCount === 0}
        onClick={() => persist(true)}
      >
        운동 끝내기
      </button>

      <Note style={{ marginTop: 12 }}>
        <p className="small">
          체크한 세트의 무게·반복·RIR로 다음 목표가 자동 조절됩니다.
        </p>
      </Note>
    </>
  );
}
