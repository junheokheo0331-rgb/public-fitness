import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  searchExerciseCatalog, catalogToRoutineItem, makeExercise,
} from '@gymlink/core/catalog';
import { progressiveOverloadLines } from '@gymlink/core/progress';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import { exerciseToItem } from '../../lib/workout/defaults.js';
import { TopBar, Card, Chip, Field, Note, Empty } from '../../ui/bits.jsx';
import SortableList, { reorder } from '../../ui/SortableList.jsx';

const LIFTS = ['', '스쿼트', '벤치프레스', '데드리프트'];
const MODES = [
  { key: 'normal', label: '일반' },
  { key: 'restpause', label: '레스트포즈' },
];
const DAY_HINTS = [
  { v: '', label: '없음' },
  ...['월', '화', '수', '목', '금', '토', '일'].map((l, i) => ({ v: i, label: l })),
];

export default function ProgramEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const nav = useNavigate();
  const { state, store } = useWorkout();
  const createdRef = useRef(false);

  const [prog, setProg] = useState(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState(null);

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

  const stats = useMemo(() => store.getExerciseStats(), [state.logs, state.settings, store]);

  const suggestions = useMemo(
    () => (query.trim().length >= 1 ? searchExerciseCatalog(query, 6) : []),
    [query],
  );

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
        title={isNew ? '새 프로그램' : '프로그램 편집'}
        sub="종목 순서 · 목표 미리보기"
        back
        right={
          <button type="button" className="btn btn--sm" onClick={save}>저장</button>
        }
      />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Card title="프로그램 정보">
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

      <Card title="종목" note="⋮⋮ 드래그로 순서 변경">
        <Field label="종목 검색">
          <input
            className="input"
            placeholder="예: 스쿼트, 랫풀다운"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        {suggestions.length > 0 && (
          <ul className="list" style={{ marginBottom: 12, border: '1px solid var(--line)', borderRadius: 12 }}>
            {suggestions.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  className="list__item"
                  style={{ width: '100%' }}
                  onClick={() => {
                    const ex = catalogToRoutineItem(c);
                    setProg((p) => ({ ...p, items: [...p.items, ex] }));
                    setQuery('');
                    setOpenId(ex.id);
                  }}
                >
                  <div className="list__body">
                    <div className="list__title">{c.name}</div>
                    <div className="list__meta">{c.equip}{c.lift ? ` · ${c.lift}` : ''}</div>
                  </div>
                  <span className="list__right">+</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="btn btn--ghost btn--sm btn--block" style={{ marginBottom: 12 }} onClick={addCardio}>
          + 유산소
        </button>

        {!prog.items.length && <Empty title="종목이 없습니다" />}

        <SortableList
          items={prog.items}
          keyOf={(ex) => ex.id}
          onReorder={(from, to) => setProg((p) => ({ ...p, items: reorder(p.items, from, to) }))}
        >
          {(ex, ii) => {
            const open = openId === ex.id;
            const item = exerciseToItem(ex);
            const prev = store.prevSetsFor(ex.id);
            const po = progressiveOverloadLines(item, prev, stats);
            return (
              <div className="exedit exedit--dnd">
                <button type="button" className="exedit__head" onClick={() => setOpenId(open ? null : ex.id)}>
                  <div className="grow">
                    <strong style={{ fontSize: 14.5 }}>{ex.name || '이름 없음'}</strong>
                    <div className="tiny muted">
                      {ex.type === 'cardio'
                        ? `${ex.targetMin}분`
                        : `${ex.sets}×${ex.repLo}–${ex.repHi} @RIR${ex.rir}`}
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
                          <Field label="RIR">
                            <input className="input input--num" value={ex.rir} onChange={(e) => patchItem(ii, { rir: e.target.value })} />
                          </Field>
                          <Field label="반복 하한">
                            <input className="input input--num" value={ex.repLo} onChange={(e) => patchItem(ii, { repLo: e.target.value })} />
                          </Field>
                          <Field label="반복 상한">
                            <input className="input input--num" value={ex.repHi} onChange={(e) => patchItem(ii, { repHi: e.target.value })} />
                          </Field>
                          <Field label="휴식(초)">
                            <input className="input input--num" value={ex.rest} onChange={(e) => patchItem(ii, { rest: e.target.value })} />
                          </Field>
                          <Field label="모드">
                            <select className="input" value={ex.mode || 'normal'} onChange={(e) => patchItem(ii, { mode: e.target.value })}>
                              {MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                            </select>
                          </Field>
                        </div>
                        <Field label="메인 리프트">
                          <select className="input" value={ex.lift || ''} onChange={(e) => patchItem(ii, { lift: e.target.value })}>
                            {LIFTS.map((l) => <option key={l || 'none'} value={l}>{l || '없음'}</option>)}
                          </select>
                        </Field>
                      </>
                    )}
                    <Field label="메모">
                      <input className="input" value={ex.note || ''} onChange={(e) => patchItem(ii, { note: e.target.value })} />
                    </Field>

                    {ex.type !== 'cardio' && (
                      <div className="overload">
                        <p className="overload__title">다음 목표</p>
                        <p className="tiny muted" style={{ marginBottom: 6 }}>{po.rule}</p>
                        <ul className="overload__list">
                          {po.lines.map((l) => (
                            <li key={l.set}>
                              <span className="mono">세트 {l.set}</span>
                              <span>{l.text}</span>
                              <Chip kind="sub">{l.kind}</Chip>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

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
          프로그램 삭제
        </button>
      )}
    </>
  );
}
