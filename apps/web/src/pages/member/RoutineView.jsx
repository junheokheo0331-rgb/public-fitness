import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { editableToItem } from '@gymlink/core/catalog';
import { TopBar, Card, Chip, Field, Note, Plate, Stack } from '../../ui/bits.jsx';
import {
  myMembership, availableExercises, getSavedRoutine,
  saveRoutine, getExerciseStats,
} from '../../lib/api.js';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import ExercisePicker, { toEditableExercise } from '../../ui/ExercisePicker.jsx';
import { exerciseArtwork } from '../../lib/exercise-art.js';

export default function RoutineView() {
  const { routineId } = useParams();
  const nav = useNavigate();
  const { store } = useWorkout();
  const [data, setData] = useState(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [savedMsg, setSavedMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    const ms = await myMembership();
    if (!ms?.gym_id) { setData({ missingGym: true }); return; }
    const gymId = ms.gym_id;
    const [ex, meta, stats] = await Promise.all([
      availableExercises(gymId),
      getSavedRoutine(routineId),
      getExerciseStats(),
    ]);
    const built = meta?.body?.days?.length
      ? meta.body
      : buildRoutine({
        available: ex,
        daysPerWeek: meta?.days ?? 3,
        goal: meta?.goal ?? 'hypertrophy',
        level: meta?.level ?? 1,
        stats,
      });
    setData({ meta, built, gymId, available: ex, stats });
  };

  useEffect(() => { load(); }, [routineId]);

  if (data?.missingGym) return <><TopBar title="루틴" back /><Card><Note kind="stop"><p className="small">먼저 내 헬스장을 선택해주세요.</p></Note></Card></>;

  async function save() {
    const { meta, built, gymId } = data;
    await saveRoutine({
      gymId, title: meta?.title ?? '내 루틴',
      body: built, goal: meta?.goal ?? 'hypertrophy', level: meta?.level ?? 1,
      days: built.days.length, routineId: meta?.id, origin: meta?.origin || 'member',
    });
    setSavedMsg('저장했습니다.');
    setEditing(false);
    setTimeout(() => setSavedMsg(null), 2500);
  }

  async function rebuildToGym() {
    if (!data) return;
    setBusy(true);
    try {
      const built = buildRoutine({
        available: data.available,
        daysPerWeek: data.meta?.days ?? data.built.days.length ?? 3,
        goal: data.meta?.goal ?? 'hypertrophy',
        level: data.meta?.level ?? 2,
        stats: data.stats,
      });
      const origin = (data.meta?.origin === 'trainer' || data.meta?.origin === 'owner')
        ? data.meta.origin
        : 'auto';
      await saveRoutine({
        gymId: data.gymId,
        title: data.meta?.title ?? '내 헬스장 루틴',
        body: built,
        goal: data.meta?.goal ?? 'hypertrophy',
        level: data.meta?.level ?? 2,
        days: built.days.length,
        routineId: data.meta?.id,
        origin,
      });
      setSavedMsg('현재 헬스장에 맞게 루틴을 조정했습니다.');
      await load();
      setTimeout(() => setSavedMsg(null), 2500);
    } finally {
      setBusy(false);
    }
  }

  const startWorkout = () => {
    const day = data.built.days[dayIdx];
    store.startFromGymDay({
      title: `${data.meta?.title || '루틴'} · ${day.name}`,
      day,
      sourceRoutineId: routineId,
      sourceDayIndex: dayIdx,
    });
    nav('/workout/live');
  };

  const patchBuilt = (fn) => setData((current) => ({ ...current, built: fn(current.built) }));
  const patchDay = (fields) => patchBuilt((current) => ({
    ...current, days: current.days.map((d, index) => index === dayIdx ? { ...d, ...fields } : d),
  }));
  const patchItem = (itemIndex, fields) => patchDay({
    items: data.built.days[dayIdx].items.map((item, index) => index === itemIndex ? { ...item, ...fields } : item),
  });
  const addExercise = (choice) => {
    patchDay({ items: [...data.built.days[dayIdx].items, editableToItem(toEditableExercise(choice))] });
    setQuery('');
  };
  const removeExercise = (itemIndex) => patchDay({
    items: data.built.days[dayIdx].items.filter((_, index) => index !== itemIndex),
  });
  const moveExercise = (itemIndex, direction) => {
    const target = itemIndex + direction;
    if (target < 0 || target >= data.built.days[dayIdx].items.length) return;
    const items = [...data.built.days[dayIdx].items];
    const [picked] = items.splice(itemIndex, 1);
    items.splice(target, 0, picked);
    patchDay({ items });
  };
  const addDay = () => patchBuilt((current) => {
    const index = current.days.length;
    setDayIdx(index);
    return { ...current, days: [...current.days, { day_index: index, name: `DAY ${index + 1}`, items: [] }] };
  });
  const removeDay = () => {
    if (data.built.days.length <= 1) return;
    patchBuilt((current) => ({ ...current, days: current.days.filter((_, index) => index !== dayIdx).map((d, index) => ({ ...d, day_index: index })) }));
    setDayIdx(Math.max(0, dayIdx - 1));
  };

  if (!data) return <><TopBar title="루틴" back /><Card><p className="muted small">불러오는 중…</p></Card></>;

  const { meta, built } = data;
  const day = built.days[dayIdx];
  const stale = meta?.stale || meta?.warnings?.length;

  return (
    <>
      <TopBar
        title={meta?.title ?? '루틴'}
        sub={`주 ${built.days.length}회`}
        back
        right={editing
          ? <button type="button" className="btn btn--sm" onClick={save}>저장</button>
          : <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(true)}>루틴 편집</button>}
      />

      {savedMsg && <Note kind="go"><p className="small">{savedMsg}</p></Note>}

      {meta?.origin === 'trainer' && (
        <Note kind="volt" title="트레이너가 보낸 숙제입니다">
          {meta.note && <p className="small">{meta.note}</p>}
          {meta.due && <p className="small">기한 ~{String(meta.due).replace(/-/g, '.')}</p>}
        </Note>
      )}

      {meta?.origin === 'owner' && (
        <Note kind="volt" title="관장님 추천 루틴">
          <p className="small">관장님이 현재 헬스장 환경에 맞춰 만든 루틴입니다.</p>
        </Note>
      )}

      {!!stale && (
        <Note kind="stop" title="기구가 바뀌었을 수 있습니다">
          {(meta.warnings || []).map((w, i) => <p key={i} className="small">{w}</p>)}
          <button type="button" className="btn btn--sm" style={{ marginTop: 8 }} disabled={busy} onClick={rebuildToGym}>
            현재 헬스장에 맞게 조정
          </button>
        </Note>
      )}

      {!editing && <button type="button" className="btn btn--block" onClick={startWorkout}>
        이 날 운동 시작
      </button>}
      {!editing && (meta?.origin === 'auto' || meta?.origin === 'member' || !meta?.origin) && (
        <button
          type="button"
          className="btn btn--ghost btn--block btn--sm"
          style={{ marginTop: 8 }}
          disabled={busy}
          onClick={rebuildToGym}
        >
          {busy ? '조정 중…' : '현재 헬스장에 맞게 조정'}
        </button>
      )}

      <div className="row row--wrap" style={{ margin: '12px 0' }}>
        {built.days.map((d, i) => (
          <button
            key={d.day_index ?? i}
            type="button"
            className={`btn btn--sm ${i === dayIdx ? '' : 'btn--ghost'}`}
            onClick={() => setDayIdx(i)}
          >
            {d.name}
          </button>
        ))}
        {editing && <button type="button" className="btn btn--sm btn--ghost" onClick={addDay}>+ 운동일</button>}
      </div>

      {editing && (
        <Card title="운동일 편집" note="이름과 운동 순서를 정리하세요" right={<button type="button" className="btn btn--sm" onClick={() => setPickerOpen(true)}>+ 운동</button>}>
          <div className="row" style={{ gap: 8 }}>
            <input className="input grow" aria-label="운동일 이름" value={day?.name || ''} onChange={(e) => patchDay({ name: e.target.value })} />
            {built.days.length > 1 && <button type="button" className="btn btn--sm btn--ghost" onClick={removeDay}>이 날 삭제</button>}
          </div>
        </Card>
      )}

      {day?.items?.map((it, itemIndex) => (
        <Card key={(it.exercise_code || it.name) + (it.id || '') + itemIndex}>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            {(() => { const artwork = exerciseArtwork(it); return artwork ? <img className="routine-machine-photo" src={artwork.url} alt={artwork.alt} loading="lazy" /> : null; })()}
            <div className="grow">
              <div className="row row--wrap" style={{ gap: 6, marginBottom: 4 }}>
                <strong style={{ fontSize: 15.5 }}>{it.name}</strong>
                {it.is_substitute && <Chip kind="sub">대체 기구</Chip>}
                {it.is_freeform && <Chip kind="sub">변형 가능</Chip>}
              </div>
              <div className="row row--wrap" style={{ gap: 5 }}>
                <Chip kind="machine">{[it.machine_brand, it.machine_model_name, it.machine_name].filter(Boolean).join(' · ') || '맨몸'}</Chip>
              </div>
              {(it.setup_note || it.note) && (
                <div className="tiny muted" style={{ marginTop: 5 }}>{it.setup_note || it.note}</div>
              )}
              <div className="small muted" style={{ marginTop: 8 }}>
                {it.duration_min
                  ? `${it.duration_min}분 · ${it.intensity || ''}`
                  : `${it.sets}세트 × ${it.rep_range?.[0]}–${it.rep_range?.[1]}회 · 휴식 ${it.rest_sec}초`}
              </div>
              {!it.duration_min && <Stack total={it.sets} done={0} current={0} />}
            </div>

            {it.suggested_kg != null
              ? <Plate value={it.suggested_kg} unit="kg" sub="지난 기록 기준" />
              : it.duration_min
                ? <Plate value={it.duration_min} unit="분" ghost />
                : <Plate value="—" unit="kg" ghost sub="감으로 시작" />}
          </div>
          {editing && <div className="routine-inline-edit">
            {!it.duration_min && <div className="owner-routine-item__fields">
              <Field label="세트"><input className="input" type="number" min="1" max="20" value={it.sets || 3} onChange={(e) => patchItem(itemIndex, { sets: Number(e.target.value) || 1 })} /></Field>
              <Field label="최소 반복"><input className="input" type="number" min="1" value={it.rep_range?.[0] || 8} onChange={(e) => patchItem(itemIndex, { rep_range: [Number(e.target.value) || 1, it.rep_range?.[1] || 12] })} /></Field>
              <Field label="최대 반복"><input className="input" type="number" min="1" value={it.rep_range?.[1] || 12} onChange={(e) => patchItem(itemIndex, { rep_range: [it.rep_range?.[0] || 8, Number(e.target.value) || 1] })} /></Field>
              <Field label="휴식(초)"><input className="input" type="number" min="0" step="15" value={it.rest_sec || 90} onChange={(e) => patchItem(itemIndex, { rest_sec: Number(e.target.value) || 0 })} /></Field>
            </div>}
            <Field label="메모"><input className="input" placeholder="자세·강도·대체 운동" value={it.setup_note || it.note || ''} onChange={(e) => patchItem(itemIndex, { setup_note: e.target.value })} /></Field>
            <div className="row row--wrap" style={{ gap: 6 }}>
              <button type="button" className="btn btn--sm btn--ghost" disabled={itemIndex === 0} onClick={() => moveExercise(itemIndex, -1)}>↑ 위로</button>
              <button type="button" className="btn btn--sm btn--ghost" disabled={itemIndex === day.items.length - 1} onClick={() => moveExercise(itemIndex, 1)}>↓ 아래로</button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => removeExercise(itemIndex)}>종목 삭제</button>
            </div>
          </div>}
        </Card>
      ))}

      {editing && <button type="button" className="btn btn--block" onClick={save}>루틴 변경 저장</button>}

      {editing && pickerOpen && (
        <div className="picker-sheet" role="dialog" aria-modal="true" aria-label="루틴에 운동 추가">
          <button type="button" className="picker-sheet__backdrop" aria-label="닫기" onClick={() => setPickerOpen(false)} />
          <section className="picker-sheet__panel">
            <div className="picker-sheet__head"><div><p className="eyebrow">운동 추가</p><strong>부위를 먼저 선택하세요</strong></div><button type="button" className="btn btn--sm btn--ghost" onClick={() => setPickerOpen(false)}>닫기</button></div>
            <ExercisePicker
              available={data.available} query={query} onQueryChange={setQuery}
              selectedCodes={day.items.map((item) => item.exercise_code)}
              onAdd={(choice) => { addExercise(choice); setPickerOpen(false); }}
            />
          </section>
        </div>
      )}

      {(built.warnings?.length > 0) && (
        <Note kind="volt" title="이 헬스장에 없는 기구">
          {built.warnings.map((w, i) => <p key={i}>{w}</p>)}
        </Note>
      )}
    </>
  );
}
