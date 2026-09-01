import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar, Card, Note, Stack } from '../../ui/bits.jsx';
import ExercisePicker, { toEditableExercise } from '../../ui/ExercisePicker.jsx';
import { editableToItem } from '@gymlink/core/catalog';
import { useSession } from '../../lib/session.jsx';
import {
  getTrainerRoutine, lastSetsForMember, saveTrainerWorkoutSession, assignRoutine, availableExercises,
} from '../../lib/api.js';

export default function ClientWorkout() {
  const { memberId, routineId } = useParams();
  const { session } = useSession();
  const nav = useNavigate();
  const [routine, setRoutine] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [available, setAvailable] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const value = await getTrainerRoutine(routineId);
      const day = value?.body?.days?.[0];
      const built = await Promise.all((day?.items || []).map(async (item) => {
        const previous = await lastSetsForMember(item.exercise_code, memberId);
        const sets = Array.from({ length: item.sets || 3 }, (_, index) => ({
          w: previous?.[index]?.w ?? item.suggested_kg ?? '',
          reps: previous?.[index]?.reps ?? item.rep_range?.[0] ?? 8,
          done: false,
        }));
        return { item, sets, previous: previous?.filter((set) => set.done) || [] };
      }));
      if (alive) { setRoutine(value); setRows(built); }
    })();
    return () => { alive = false; };
  }, [memberId, routineId]);

  useEffect(() => {
    if (!session.gymId) return;
    availableExercises(session.gymId, 3).then(setAvailable).catch(() => setAvailable([]));
  }, [session.gymId]);

  const patchSet = (rowIndex, setIndex, patch) => setRows((current) => current.map((row, index) => (
    index !== rowIndex ? row : {
      ...row,
      sets: row.sets.map((set, innerIndex) => innerIndex === setIndex ? { ...set, ...patch } : set),
    }
  )));

  const addExercise = async (choice) => {
    const item = editableToItem({ ...toEditableExercise(choice), sets: 3, rest: 90 });
    const previous = await lastSetsForMember(item.exercise_code, memberId);
    const sets = Array.from({ length: 3 }, (_, index) => ({
      w: previous?.[index]?.w ?? '', reps: previous?.[index]?.reps ?? item.rep_range?.[0] ?? 8, done: false,
    }));
    setRows((current) => [...current, { item, sets, previous: previous?.filter((set) => set.done) || [] }]);
    setPickerOpen(false);
    setQuery('');
    setSaved(false);
  };

  const removeExercise = (rowIndex) => setRows((current) => current.filter((_, index) => index !== rowIndex));
  const addSet = (rowIndex) => setRows((current) => current.map((row, index) => index === rowIndex
    ? { ...row, sets: [...row.sets, { w: '', reps: row.item.rep_range?.[0] ?? 8, done: false }] }
    : row));
  const removeSet = (rowIndex) => setRows((current) => current.map((row, index) => index === rowIndex && row.sets.length > 1
    ? { ...row, sets: row.sets.slice(0, -1) }
    : row));

  const save = async () => {
    setBusy(true);
    try {
      await saveTrainerWorkoutSession({
        memberId, routineId,
        exercises: rows.map((row) => ({
          code: row.item.exercise_code, name: row.item.name,
          sets: row.sets.map((set) => ({ ...set, w: Number(set.w) || 0, reps: Number(set.reps) || 0 })),
        })),
      });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  const sendHomework = async () => {
    setBusy(true);
    try {
      const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      await assignRoutine({
        memberId, routineId, dueDate: due,
        note: '오늘 수업 기록을 기준으로 지난 중량과 반복 수가 운동 화면에 표시됩니다.',
      });
      nav(`/t/clients/${memberId}`);
    } finally {
      setBusy(false);
    }
  };

  if (!routine) return <><TopBar title="회원 운동" back /><Card><p className="small muted">루틴을 불러오는 중…</p></Card></>;

  return (
    <>
      <TopBar title={routine.title} sub="회원과 함께 운동 기록" back />
      <Note kind="volt" title="지난 기록을 먼저 채웠습니다">
        <p className="small">회원의 최근 중량과 횟수를 기본값으로 불러왔습니다. 오늘 수행에 맞게 고친 뒤 완료를 눌러주세요.</p>
      </Note>

      {rows.map((row, rowIndex) => (
        <Card key={`${row.item.exercise_code}-${rowIndex}`} title={row.item.name} note={row.item.machine_name || '운동 종목'}>
          {row.previous.length > 0 && <p className="tiny muted">지난 운동 · {row.previous.map((set) => `${set.w}kg×${set.reps}`).join(' / ')}</p>}
          <div className="setlog">
            {row.sets.map((set, setIndex) => (
              <div key={setIndex} className={`setlog__row ${set.done ? 'is-done' : ''}`}>
                <span className="setlog__idx">{setIndex + 1}</span>
                <input className="input input--num" inputMode="decimal" placeholder="kg" value={set.w} onChange={(event) => patchSet(rowIndex, setIndex, { w: event.target.value })} />
                <span className="tiny muted">×</span>
                <input className="input input--num" inputMode="numeric" placeholder="회" value={set.reps} onChange={(event) => patchSet(rowIndex, setIndex, { reps: event.target.value })} />
                <button type="button" className={`setlog__chk ${set.done ? 'on' : ''}`} onClick={() => patchSet(rowIndex, setIndex, { done: !set.done })}>✓</button>
              </div>
            ))}
          </div>
          <Stack total={row.sets.length} done={row.sets.filter((set) => set.done).length} />
          <div className="setlog__actions">
            <div className="set-counter">
              <button type="button" disabled={row.sets.length <= 1} onClick={() => removeSet(rowIndex)}>−</button>
              <span>{row.sets.length}세트</span>
              <button type="button" onClick={() => addSet(rowIndex)}>＋</button>
            </div>
            <button type="button" className="btn btn--sm btn--ghost grow" onClick={() => removeExercise(rowIndex)}>운동 삭제</button>
          </div>
        </Card>
      ))}

      <button type="button" className="btn btn--ghost btn--block" style={{ marginBottom: 12 }} onClick={() => setPickerOpen(true)}>＋ 운동 추가</button>

      {!saved ? (
        <button type="button" className="btn btn--block" disabled={busy} onClick={save}>{busy ? '저장 중…' : '오늘 운동 저장'}</button>
      ) : (
        <>
          <Note kind="go"><p className="small">회원 운동 기록에 저장했습니다.</p></Note>
          <button type="button" className="btn btn--block" disabled={busy} onClick={sendHomework}>이 기록을 기준으로 숙제 보내기</button>
          <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={() => nav(`/t/clients/${memberId}`)}>회원 화면으로</button>
        </>
      )}

      {pickerOpen && (
        <div className="picker-sheet" role="dialog" aria-modal="true" aria-label="회원 운동 추가">
          <button type="button" className="picker-sheet__backdrop" aria-label="닫기" onClick={() => setPickerOpen(false)} />
          <section className="picker-sheet__panel">
            <div className="picker-sheet__head">
              <div><p className="eyebrow">수업 중 편집</p><strong>운동 추가</strong></div>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPickerOpen(false)}>닫기</button>
            </div>
            <ExercisePicker available={available} query={query} onQueryChange={setQuery} onAdd={addExercise} selectedCodes={rows.map((row) => row.item.exercise_code)} />
          </section>
        </div>
      )}
    </>
  );
}
