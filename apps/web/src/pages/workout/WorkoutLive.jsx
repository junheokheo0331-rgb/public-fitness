import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { targetsForItem } from '@gymlink/core/progress';
import { hhmmss } from '@gymlink/core/time';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import { exerciseToItem } from '../../lib/workout/defaults.js';
import { Card, Chip, Note, Stack, Empty } from '../../ui/bits.jsx';
import SortableList, { reorder } from '../../ui/SortableList.jsx';
import ExercisePicker, { toEditableExercise } from '../../ui/ExercisePicker.jsx';
import { availableExercises, getSavedRoutine, myMembership, saveRoutine, saveWorkoutSession } from '../../lib/api.js';
import { editableToItem } from '@gymlink/core/catalog';
import { exerciseArtwork } from '../../lib/exercise-art.js';

const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

function restLabel(seconds) {
  if (!seconds) return '휴식 없음';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min ? `${min}분${sec ? ` ${sec}초` : ''}` : `${sec}초`;
}

export default function WorkoutLive() {
  const nav = useNavigate();
  const { state, store } = useWorkout();
  const session = state.session;
  const [order, setOrder] = useState([]);
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [gymAvailable, setGymAvailable] = useState([]);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [structureChanged, setStructureChanged] = useState(false);
  const [updateRoutine, setUpdateRoutine] = useState(true);
  const [exitOpen, setExitOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  useEffect(() => {
    if (!session) nav('/workout', { replace: true });
    else setOrder(session.order?.length ? [...session.order] : Object.keys(session.setsMap || {}));
  }, [session, nav]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [pickerOpen]);

  const stats = useMemo(() => store.getExerciseStats(), [state.logs, state.settings, store]);
  const program = session?.programId ? store.getProgram(session.programId) : null;
  useEffect(() => {
    let alive = true;
    (async () => {
      const membership = await myMembership();
      if (!membership) return;
      const list = await availableExercises(membership.gym_id, 3);
      if (alive) setGymAvailable(list);
    })();
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    if (!session) return [];
    return order.map((exId) => {
      const ex = store.findExById(exId);
      const sets = session.setsMap[exId] || [];
      const prev = store.prevSetsFor(exId);
      const item = exerciseToItem(ex);
      const targets = targetsForItem(item, prev, stats);
      const prevDone = prev.filter((s) => s.done && +s.reps > 0);
      const prevText = prevDone.length
        ? prevDone.map((s) => `${s.w}kg×${s.reps}`).join(' / ')
        : null;
      return { exId, ex, sets, targets, prev, prevText, item };
    });
  }, [session, order, stats, store]);

  const elapsedSec = session
    ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
    : 0;
  void tick;

  const doneCount = rows.reduce((a, r) => a + r.sets.filter((s) => s.done).length, 0);
  const totalCount = rows.reduce((a, r) => a + r.sets.length, 0);
  const totalVolume = rows.reduce((sum, row) => sum + row.sets.reduce((setSum, set) => (
    set.done ? setSum + (Number(set.w) || 0) * (Number(set.reps) || 0) : setSum
  ), 0), 0);
  const completeExerciseCount = rows.filter((row) => row.sets.length && row.sets.every((set) => set.done)).length;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  if (!session) return null;

  const patchSet = (exId, si, patch) => {
    store.patchSessionSets((map) => {
      const sets = (map[exId] || []).map((s, j) => (j === si ? { ...s, ...patch } : s));
      return { ...map, [exId]: sets };
    });
  };

  const toggleDone = (exId, si, targets) => {
    const ex = store.findExById(exId);
    const current = session.setsMap[exId]?.[si];
    const markingDone = current && !current.done;
    store.patchSessionSets((map) => {
      const sets = (map[exId] || []).map((s, j) => {
        if (j !== si) return s;
        if (s.done) return { ...s, done: false };
        const t = targets[si];
        return {
          ...s,
          done: true,
          w: s.w === '' && t?.w !== '' ? t.w : s.w,
          reps: s.reps === '' && t?.reps !== '' ? t.reps : s.reps,
        };
      });
      return { ...map, [exId]: sets };
    });
    if (markingDone && state.settings.autoRest && ex.type !== 'cardio') {
      store.startRest(Number(ex.rest) || 90, ex.name || '휴식');
    }
  };

  const completeExercise = (row) => {
    const allDone = row.sets.length > 0 && row.sets.every((set) => set.done);
    store.patchSessionSets((map) => ({
      ...map,
      [row.exId]: (map[row.exId] || []).map((set, index) => {
        if (allDone) return { ...set, done: false };
        const target = row.targets[index];
        return {
          ...set,
          done: true,
          w: set.w === '' && target?.w !== '' ? target.w : set.w,
          reps: set.reps === '' && target?.reps !== '' ? target.reps : set.reps,
        };
      }),
    }));
    if (!allDone) setMsg(`${row.ex.name}을 모두 완료했습니다.`);
  };

  const addCatalog = (choice) => {
    const ex = { ...toEditableExercise(choice), rest: state.settings.defaultRest ?? 90 };
    if (replaceTarget) {
      store.replaceInSession(replaceTarget, ex);
      setOrder((current) => current.map((id) => id === replaceTarget ? ex.id : id));
      setReplaceTarget(null);
      setMsg('운동을 교체했습니다. 지난 기록은 새 종목 기준으로 불러옵니다.');
    } else {
      store.addToSession(ex);
      setOrder((o) => [...o, ex.id]);
    }
    setStructureChanged(true);
    setQuery('');
    setPickerOpen(false);
  };

  const removeExercise = (exId, name) => {
    if (!confirm(`「${name}」을 이번 운동에서 뺄까요?`)) return;
    store.removeFromSession(exId);
    setOrder((current) => current.filter((id) => id !== exId));
    setStructureChanged(true);
  };

  const setExerciseRest = (exId, seconds) => {
    store.patchSessionExercise(exId, { rest: Number(seconds) });
    setStructureChanged(true);
  };

  const loadPrevious = (row) => {
    if (!row.prev.length) return;
    store.patchSessionSets((map) => ({
      ...map,
      [row.exId]: row.sets.map((set, index) => {
        const previous = row.prev[index] || row.prev.at(-1);
        return previous ? { ...set, w: previous.w ?? '', reps: previous.reps ?? '', done: false } : set;
      }),
    }));
    setMsg(`${row.ex.name} 지난 기록을 불러왔습니다.`);
    setTimeout(() => setMsg(null), 1600);
  };

  const applySessionToRoutine = async () => {
    if (session.programId) {
      const current = store.getProgram(session.programId);
      if (current) store.saveProgram({ ...current, items: order.map((id) => ({ ...store.findExById(id), sets: session.setsMap[id]?.length || 3 })) });
      return;
    }
    if (!session.sourceRoutineId) return;
    const source = await getSavedRoutine(session.sourceRoutineId);
    if (!source?.body?.days?.length) return;
    const dayIndex = Math.min(session.sourceDayIndex || 0, source.body.days.length - 1);
    const items = order.map((id) => editableToItem({
      ...store.findExById(id), sets: session.setsMap[id]?.length || 3,
    }));
    const body = {
      ...source.body,
      days: source.body.days.map((day, index) => index === dayIndex ? { ...day, items } : day),
    };
    await saveRoutine({
      gymId: source.gym_id, title: source.title, body,
      goal: source.goal, level: source.level, days: body.days.length,
      routineId: source.id, origin: source.origin || 'member',
    });
  };

  const finish = async ({ completeAll = false } = {}) => {
    setSaving(true);
    setFinishOpen(false);
    setExitOpen(false);
    try {
      let setsMap = session.setsMap;
      if (completeAll) {
        setsMap = Object.fromEntries(rows.map((row) => [
          row.exId,
          row.sets.map((set, index) => {
            const target = row.targets[index];
            return {
              ...set,
              done: true,
              w: set.w === '' && target?.w !== '' ? target.w : set.w,
              reps: set.reps === '' && target?.reps !== '' ? target.reps : set.reps,
            };
          }),
        ]));
        store.patchSessionSets(() => setsMap);
      }
      if (structureChanged && updateRoutine) await applySessionToRoutine();
      await saveWorkoutSession({
        dateStr: session.dateStr,
        sessionId: session.id,
        routineId: session.sourceRoutineId || session.programId || null,
        dayIndex: session.sourceDayIndex || 0,
        exercises: order.map((id) => {
          const exercise = store.findExById(id);
          return {
            code: exercise.exercise_code || exercise.code || exercise.id,
            name: exercise.name || id,
            rest: Number(exercise.rest) || 0,
            note: exercise.note || '',
            sets: setsMap[id] || [],
          };
        }),
        ended: true,
      });
      store.finishSession();
      setMsg(structureChanged && updateRoutine ? '운동 기록과 루틴 변경을 저장했습니다.' : '운동 기록을 저장했습니다.');
      setTimeout(() => nav('/workout'), 1000);
    } catch (error) {
      setMsg(error.message || '저장하지 못했습니다.');
      setSaving(false);
    }
  };

  const discard = () => {
    store.discardSession();
    nav('/workout', { replace: true });
  };

  return (
    <>
      <header className="live-hero">
        <div className="live-hero__top">
          <button type="button" className="live-hero__close" aria-label="운동 메뉴" onClick={() => setExitOpen(true)}>×</button>
          <div className="grow"><strong>{session.title || program?.title || '운동'}</strong><span>{completeExerciseCount}/{rows.length}종목 · 자동 저장 중</span></div>
          <button type="button" className="live-hero__done" disabled={saving || doneCount === 0} onClick={() => setFinishOpen(true)}>운동 완료</button>
        </div>
        <div className="live-hero__stats">
          <div><strong>{Math.round(totalVolume).toLocaleString('ko-KR')}</strong><span>kg 볼륨</span></div>
          <div><strong>{hhmmss(elapsedSec)}</strong><span>운동 시간</span></div>
          <div><strong>{doneCount}</strong><span>/ {totalCount}세트</span></div>
        </div>
        <div className="live-progress" aria-label={`운동 진행률 ${progressPct}%`}><span style={{ width: `${progressPct}%` }} /></div>
      </header>

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      {!rows.length && (
        <Card>
          <Empty title="첫 운동을 추가해보세요" action={<button type="button" className="btn btn--sm" onClick={() => setPickerOpen(true)}>+ 운동 추가</button>}>
            부위를 고르면 내 헬스장에 맞는 운동부터 보여드려요.
          </Empty>
        </Card>
      )}

      <SortableList
        items={rows}
        keyOf={(r) => r.exId}
        onReorder={(from, to) => { setOrder((o) => reorder(o, from, to)); store.reorderSession(from, to); setStructureChanged(true); }}
      >
        {(r) => {
          const ex = r.ex;
          const artwork = exerciseArtwork(ex);
          return (
            <Card className={`workout-exercise ${r.sets.length && r.sets.every((set) => set.done) ? 'is-complete' : ''}`}>
              <div className="row row--between workout-exercise__head" style={{ marginBottom: 8 }}>
                <div className="exercise-thumb exercise-thumb--photo">
                  {artwork && <img src={artwork.url} alt={artwork.alt} />}
                </div>
                <div className="grow">
                  <strong style={{ fontSize: 15.5 }}>{ex.name || r.exId}</strong>
                  <div className="row row--wrap" style={{ gap: 5, marginTop: 4 }}>
                    <Chip kind={r.sets.every((set) => set.done) ? 'go' : undefined}>{r.sets.filter((set) => set.done).length}/{r.sets.length}세트</Chip>
                    {ex.equip && <Chip kind="machine">{[ex.machine_brand, ex.machine_model_name, ex.equip].filter(Boolean).join(' · ')}</Chip>}
                    <label className="rest-select" title="이 운동의 세트 간 휴식시간">
                      <span aria-hidden="true">⏱</span>
                      <select value={Number(ex.rest) || 0} onChange={(event) => setExerciseRest(r.exId, event.target.value)} aria-label={`${ex.name} 휴식시간`}>
                        {REST_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{restLabel(seconds)}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
                <details className="exercise-menu">
                  <summary aria-label={`${ex.name} 더보기`}>•••</summary>
                  <div className="exercise-menu__panel">
                    <button type="button" onClick={() => { setReplaceTarget(r.exId); setPickerOpen(true); }}>운동 교체</button>
                    <button type="button" onClick={() => removeExercise(r.exId, ex.name || r.exId)}>이번 운동에서 삭제</button>
                  </div>
                </details>
              </div>

              <input
                className="workout-note"
                value={ex.note || ''}
                placeholder="운동 메모"
                aria-label={`${ex.name} 메모`}
                onChange={(event) => { store.patchSessionExercise(r.exId, { note: event.target.value }); setStructureChanged(true); }}
              />

              {ex.type === 'cardio' ? (
                <div className="row row--between">
                  <span className="small">{ex.targetMin || 20}분 유산소</span>
                  <button
                    type="button"
                    className={`btn btn--sm ${r.sets[0]?.done ? '' : 'btn--ghost'}`}
                    onClick={() => toggleDone(r.exId, 0, r.targets)}
                  >
                    {r.sets[0]?.done ? '완료됨' : '완료'}
                  </button>
                </div>
              ) : (
                <div className="setlog">
                  <div className="setlog__head" aria-hidden="true">
                    <span>세트</span><span>지난 기록</span><span>kg</span><span>회</span><span>완료</span>
                  </div>
                  {r.sets.map((s, si) => (
                    <div key={si} className={`setlog__row ${s.done ? 'is-done' : ''}`}>
                      <span className="setlog__idx">{si + 1}</span>
                      <span className="setlog__previous">{r.prev[si]?.done ? `${r.prev[si].w} × ${r.prev[si].reps}` : '—'}</span>
                      <input
                        className="input input--num setlog__w"
                        inputMode="decimal"
                        placeholder="kg"
                        aria-label={`${si + 1}세트 중량`}
                        value={s.w}
                        onChange={(e) => patchSet(r.exId, si, { w: e.target.value })}
                      />
                      <input
                        className="input input--num setlog__r"
                        inputMode="numeric"
                        placeholder="회"
                        aria-label={`${si + 1}세트 반복 수`}
                        value={s.reps}
                        onChange={(e) => patchSet(r.exId, si, { reps: e.target.value })}
                      />
                      <button
                        type="button"
                        className={`setlog__chk ${s.done ? 'on' : ''}`}
                        aria-pressed={s.done}
                        onClick={() => toggleDone(r.exId, si, r.targets)}
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                  <Stack
                    total={r.sets.length}
                    done={r.sets.filter((s) => s.done).length}
                    current={r.sets.findIndex((s) => !s.done)}
                  />
                  <div className="setlog__actions">
                    <div className="set-counter">
                      <button type="button" aria-label="세트 줄이기" disabled={r.sets.length <= 1} onClick={() => { store.removeSessionSet(r.exId); setStructureChanged(true); }}>−</button>
                      <span>{r.sets.length}세트</span>
                      <button type="button" aria-label="세트 늘리기" onClick={() => { store.addSessionSet(r.exId); setStructureChanged(true); }}>＋</button>
                    </div>
                    <button type="button" className="btn btn--sm btn--ghost grow" disabled={!r.prev.length} onClick={() => loadPrevious(r)}>지난 기록 불러오기</button>
                  </div>
                  <button
                    type="button"
                    className={`exercise-complete ${r.sets.every((set) => set.done) ? 'is-done' : ''}`}
                    onClick={() => completeExercise(r)}
                  >
                    {r.sets.every((set) => set.done) ? '✓ 이 종목 완료됨 · 취소' : '이 종목 모두 완료'}
                  </button>
                </div>
              )}
            </Card>
          );
        }}
      </SortableList>

      {structureChanged && (session.programId || session.sourceRoutineId) && (
        <Card>
          <label className="check">
            <input type="checkbox" checked={updateRoutine} onChange={(e) => setUpdateRoutine(e.target.checked)} />
            <span><strong>오늘 바꾼 운동 구성과 세트 수를 원래 루틴에도 반영</strong><small className="muted" style={{ display: 'block', marginTop: 3 }}>끄면 이번 운동 기록에만 남습니다.</small></span>
          </label>
        </Card>
      )}

      <p className="tiny muted workout-autosave">입력 중인 내용은 자동 저장되고, 운동 완료 시 계정 기록에 반영됩니다.</p>
      <div className="workout-end-actions">
        <button type="button" className="btn btn--ghost" onClick={() => { setReplaceTarget(null); setPickerOpen(true); }}>＋ 운동 추가</button>
        <button type="button" className="btn" disabled={saving || doneCount === 0} onClick={() => setFinishOpen(true)}>{saving ? '저장 중…' : '운동 완료'}</button>
      </div>
      <button type="button" className="workout-stop" onClick={() => setExitOpen(true)}>운동 그만두기</button>

      {pickerOpen && (
        <div className="picker-sheet" role="dialog" aria-modal="true" aria-label={replaceTarget ? '운동 교체' : '운동 추가'}>
          <button type="button" className="picker-sheet__backdrop" aria-label="닫기" onClick={() => { setPickerOpen(false); setReplaceTarget(null); }} />
          <section className="picker-sheet__panel">
            <div className="picker-sheet__head">
              <div><p className="eyebrow">{replaceTarget ? '운동 교체' : '운동 추가'}</p><strong>{replaceTarget ? '대신 할 운동을 고르세요' : '어떤 운동을 할까요?'}</strong></div>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => { setPickerOpen(false); setReplaceTarget(null); }}>닫기</button>
            </div>
            <ExercisePicker
              available={gymAvailable}
              query={query}
              onQueryChange={setQuery}
              onAdd={addCatalog}
              selectedCodes={replaceTarget ? [] : rows.map((row) => row.ex.exercise_code || row.ex.id)}
            />
          </section>
        </div>
      )}

      {finishOpen && (
        <div className="workout-dialog" role="dialog" aria-modal="true" aria-labelledby="finish-title">
          <button type="button" className="workout-dialog__backdrop" aria-label="닫기" onClick={() => setFinishOpen(false)} />
          <section className="workout-dialog__panel">
            <p className="eyebrow">오늘 운동 정리</p>
            <h2 id="finish-title">운동을 완료할까요?</h2>
            <div className="workout-dialog__summary">
              <div><strong>{hhmmss(elapsedSec)}</strong><span>운동 시간</span></div>
              <div><strong>{doneCount}/{totalCount}</strong><span>완료 세트</span></div>
              <div><strong>{Math.round(totalVolume).toLocaleString('ko-KR')}</strong><span>kg 볼륨</span></div>
            </div>
            {doneCount < totalCount && <p className="small muted">완료하지 않은 {totalCount - doneCount}세트가 있습니다. 수행한 세트만 저장하거나 모두 완료로 표시할 수 있어요.</p>}
            <button type="button" className="btn btn--block" disabled={saving} onClick={() => finish()}>{saving ? '저장 중…' : '수행한 세트만 저장하고 완료'}</button>
            {doneCount < totalCount && <button type="button" className="btn btn--ghost btn--block" disabled={saving} onClick={() => finish({ completeAll: true })}>모든 세트를 완료로 표시</button>}
            <button type="button" className="workout-dialog__cancel" onClick={() => setFinishOpen(false)}>운동 계속하기</button>
          </section>
        </div>
      )}

      {exitOpen && (
        <div className="workout-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-title">
          <button type="button" className="workout-dialog__backdrop" aria-label="닫기" onClick={() => setExitOpen(false)} />
          <section className="workout-dialog__panel">
            <p className="eyebrow">운동 나가기</p>
            <h2 id="exit-title">지금 운동을 그만둘까요?</h2>
            <p className="small muted">수행한 세트가 있다면 기록으로 저장하고 끝낼 수 있습니다. 기록 삭제를 선택하면 오늘 입력한 내용은 복구할 수 없습니다.</p>
            {doneCount > 0 && <button type="button" className="btn btn--block" disabled={saving} onClick={() => finish()}>수행한 세트 저장하고 끝내기</button>}
            <button type="button" className="btn btn--danger btn--block" onClick={discard}>기록하지 않고 운동 취소</button>
            <button type="button" className="workout-dialog__cancel" onClick={() => setExitOpen(false)}>운동 계속하기</button>
          </section>
        </div>
      )}
    </>
  );
}
