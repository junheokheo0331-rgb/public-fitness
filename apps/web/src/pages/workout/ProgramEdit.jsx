import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { makeExercise } from '@gymlink/core/catalog';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import { TopBar, Card, Field, Note, Empty } from '../../ui/bits.jsx';
import SortableList, { reorder } from '../../ui/SortableList.jsx';
import ExercisePicker, { toEditableExercise } from '../../ui/ExercisePicker.jsx';
import { availableExercises, myMembership } from '../../lib/api.js';

const MODES = [
  { key: 'normal', label: '일반' },
  { key: 'restpause', label: '레스트포즈' },
];
const DAY_HINTS = [
  { v: '', label: '없음' },
  ...['월', '화', '수', '목', '금', '토', '일'].map((l, i) => ({ v: i, label: l })),
];
const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const restLabel = (seconds) => !seconds ? '사용 안 함' : seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분${seconds % 60 ? ` ${seconds % 60}초` : ''}`;

export default function ProgramEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const nav = useNavigate();
  const { store } = useWorkout();
  const createdRef = useRef(false);

  const [prog, setProg] = useState(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [gymAvailable, setGymAvailable] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (isNew) {
      if (createdRef.current) return;
      createdRef.current = true;
      const p = store.createProgram({ title: '새 프로그램', desc: '', dayHint: null });
      nav(`/workout/programs/${p.id}`, { replace: true });
      return;
    }
    const found = store.getProgram(id);
    if (found) setProg({ ...found, items: [...(found.items || [])] });
    else nav('/workout', { replace: true });
  }, [id, isNew, nav, store]);

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

  if (!prog) {
    return (
      <>
        <TopBar title="프로그램" back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }

  const patch = (fields) => setProg((p) => ({ ...p, ...fields }));

  const patchItem = (ii, fields) => {
    setProg((p) => ({
      ...p,
      items: p.items.map((it, j) => (j === ii ? { ...it, ...fields } : it)),
    }));
  };

  const save = () => {
    store.saveProgram(prog);
    setMsg('저장했습니다.');
    setTimeout(() => setMsg(null), 2000);
  };

  const remove = () => {
    if (!confirm('이 프로그램을 삭제할까요?')) return;
    store.deleteProgram(prog.id);
    nav('/workout');
  };

  const addCardio = () => {
    const ex = makeExercise({ type: 'cardio', name: '유산소', equip: '머신', targetMin: 20, sets: 1 });
    setProg((p) => ({ ...p, items: [...p.items, ex] }));
    setOpenId(ex.id);
  };

  return (
    <>
      <TopBar
        title={isNew ? '새 루틴' : '루틴 편집'}
        sub="종목 · 세트 · 반복 · 휴식"
        back
        right={
          <button type="button" className="btn btn--sm" onClick={save}>저장</button>
        }
      />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Card title="루틴 정보">
        <Field label="제목">
          <input className="input" value={prog.title} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="설명">
          <input className="input" value={prog.desc || ''} onChange={(e) => patch({ desc: e.target.value })} />
        </Field>
        <Field label="요일 추천">
          <select
            className="input"
            value={prog.dayHint ?? ''}
            onChange={(e) => patch({ dayHint: e.target.value === '' ? null : Number(e.target.value) })}
          >
            {DAY_HINTS.map((d) => (
              <option key={String(d.v)} value={d.v}>{d.label}</option>
            ))}
          </select>
        </Field>
      </Card>

      <Card title="운동 구성" note="끌어서 순서를 바꿀 수 있어요" right={<button type="button" className="btn btn--sm" onClick={() => setPickerOpen(true)}>+ 운동</button>}>
        <button type="button" className="btn btn--ghost btn--sm btn--block" style={{ marginBottom: 12 }} onClick={addCardio}>+ 유산소 추가</button>

        {!prog.items.length && <Empty title="종목이 없습니다" />}

        <SortableList
          items={prog.items}
          keyOf={(ex) => ex.id}
          onReorder={(from, to) => setProg((p) => ({ ...p, items: reorder(p.items, from, to) }))}
        >
          {(ex, ii) => {
            const open = openId === ex.id;
            return (
              <div className="exedit exedit--dnd">
                <button type="button" className="exedit__head" onClick={() => setOpenId(open ? null : ex.id)}>
                  <div className="grow">
                    <strong style={{ fontSize: 14.5 }}>{ex.name || '이름 없음'}</strong>
                    <div className="tiny muted">
                      {ex.type === 'cardio'
                        ? `${ex.targetMin}분`
                        : `${ex.sets}세트 · ${ex.repLo}–${ex.repHi}회`}
                      {ex.lift ? ` · ${ex.lift}` : ''}
                    </div>
                  </div>
                  <span className="tiny muted">{open ? '접기' : '편집'}</span>
                </button>

                {open && (
                  <div className="exedit__panel">
                    <Field label="이름">
                      <input className="input" value={ex.name} onChange={(e) => patchItem(ii, { name: e.target.value })} />
                    </Field>
                    {ex.type === 'cardio' ? (
                      <Field label="시간(분)">
                        <input className="input input--num" value={ex.targetMin} onChange={(e) => patchItem(ii, { targetMin: e.target.value })} />
                      </Field>
                    ) : (
                      <>
                        <div className="rowfields">
                          <Field label="세트">
                            <input className="input input--num" value={ex.sets} onChange={(e) => patchItem(ii, { sets: e.target.value })} />
                          </Field>
                          <Field label="반복 하한">
                            <input className="input input--num" value={ex.repLo} onChange={(e) => patchItem(ii, { repLo: e.target.value })} />
                          </Field>
                          <Field label="반복 상한">
                            <input className="input input--num" value={ex.repHi} onChange={(e) => patchItem(ii, { repHi: e.target.value })} />
                          </Field>
                          <Field label="세트 간 휴식">
                            <select className="input" value={Number(ex.rest) || 0} onChange={(e) => patchItem(ii, { rest: Number(e.target.value) })}>
                              {REST_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{restLabel(seconds)}</option>)}
                            </select>
                          </Field>
                          <Field label="모드">
                            <select className="input" value={ex.mode || 'normal'} onChange={(e) => patchItem(ii, { mode: e.target.value })}>
                              {MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                            </select>
                          </Field>
                        </div>
                      </>
                    )}
                    <Field label="메모">
                      <input className="input" value={ex.note || ''} onChange={(e) => patchItem(ii, { note: e.target.value })} />
                    </Field>

                    <button
                      type="button"
                      className="btn btn--sm btn--stop"
                      onClick={() => setProg((p) => ({ ...p, items: p.items.filter((_, j) => j !== ii) }))}
                    >
                      종목 삭제
                    </button>
                  </div>
                )}
              </div>
            );
          }}
        </SortableList>
      </Card>

      <button type="button" className="btn btn--block" onClick={save}>저장</button>
      {!isNew && (
        <button type="button" className="btn btn--stop btn--block" style={{ marginTop: 8 }} onClick={remove}>
          루틴 삭제
        </button>
      )}

      {pickerOpen && (
        <div className="picker-sheet" role="dialog" aria-modal="true" aria-label="루틴에 운동 추가">
          <button type="button" className="picker-sheet__backdrop" aria-label="닫기" onClick={() => setPickerOpen(false)} />
          <section className="picker-sheet__panel">
            <div className="picker-sheet__head"><div><p className="eyebrow">운동 추가</p><strong>부위를 먼저 선택하세요</strong></div><button type="button" className="btn btn--sm btn--ghost" onClick={() => setPickerOpen(false)}>닫기</button></div>
            <ExercisePicker
              available={gymAvailable} query={query} onQueryChange={setQuery}
              selectedCodes={prog.items.map((item) => item.exercise_code)}
              onAdd={(choice) => {
                const ex = { ...toEditableExercise(choice), rest: store.exportJSON().settings.defaultRest ?? 90 };
                setProg((p) => ({ ...p, items: [...p.items, ex] }));
                setQuery(''); setOpenId(ex.id); setPickerOpen(false);
              }}
            />
          </section>
        </div>
      )}
    </>
  );
}
