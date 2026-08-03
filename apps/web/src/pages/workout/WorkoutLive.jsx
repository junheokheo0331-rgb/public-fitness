import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { targetsForItem, progressiveOverloadLines } from '@gymlink/core/progress';
import { searchExerciseCatalog, catalogToRoutineItem } from '@gymlink/core/catalog';
import { hhmmss } from '@gymlink/core/time';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import { exerciseToItem } from '../../lib/workout/defaults.js';
import { TopBar, Card, Chip, Note, Stack, Empty, Field } from '../../ui/bits.jsx';
import SortableList, { reorder } from '../../ui/SortableList.jsx';

export default function WorkoutLive() {
  const nav = useNavigate();
  const { state, store } = useWorkout();
  const session = state.session;
  const [order, setOrder] = useState([]);
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!session) nav('/workout', { replace: true });
    else setOrder(session.order?.length ? [...session.order] : Object.keys(session.setsMap || {}));
  }, [session, nav]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => store.getExerciseStats(), [state.logs, state.settings, store]);
  const program = session?.programId ? store.getProgram(session.programId) : null;
  const suggestions = useMemo(
    () => (query.trim().length >= 1 ? searchExerciseCatalog(query, 6) : []),
    [query],
  );

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
        ? prevDone.map((s) => `${s.w}kg×${s.reps}${s.rir != null ? `(R${s.rir})` : ''}`).join(' / ')
        : null;
      return { exId, ex, sets, targets, prevText, item };
    });
  }, [session, order, stats, store]);

  const elapsedSec = session
    ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
    : 0;
  void tick;

  const doneCount = rows.reduce((a, r) => a + r.sets.filter((s) => s.done).length, 0);

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

  const addCatalog = (c) => {
    const ex = catalogToRoutineItem(c, { lift: c.lift || '' });
    store.addToSession(ex);
    setOrder((o) => [...o, ex.id]);
    setQuery('');
  };

  const midSave = () => {
    setSaving(true);
    setMsg('중간 저장됨');
    setTimeout(() => { setSaving(false); setMsg(null); }, 1200);
  };

  const finish = () => {
    setSaving(true);
    store.finishSession();
    setMsg('운동을 저장했습니다.');
    setTimeout(() => nav('/workout'), 1000);
  };

  return (
    <>
      <TopBar
        title={session.title || program?.title || '운동'}
        sub={`${session.dateStr} · 완료 ${doneCount}세트 · ${hhmmss(elapsedSec)}`}
        back
      />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Card title="종목 추가">
        <Field label="검색">
          <input
            className="input"
            placeholder="예: 스쿼트, 랫풀다운"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        {suggestions.length > 0 && (
          <ul className="list" style={{ border: '1px solid var(--line)', borderRadius: 12 }}>
            {suggestions.map((c) => (
              <li key={c.name}>
                <button type="button" className="list__item" style={{ width: '100%' }} onClick={() => addCatalog(c)}>
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
      </Card>

      {!rows.length && (
        <Card>
          <Empty title="종목이 없습니다">
            위에서 검색해 추가하거나, 프로그램으로 시작하세요.
          </Empty>
        </Card>
      )}

      <SortableList
        items={rows}
        keyOf={(r) => r.exId}
        onReorder={(from, to) => setOrder((o) => reorder(o, from, to))}
      >
        {(r) => {
          const po = progressiveOverloadLines(r.item, store.prevSetsFor(r.exId), stats);
          const ex = r.ex;
          return (
            <Card>
              <div className="row row--between" style={{ marginBottom: 8 }}>
                <div className="grow">
                  <strong style={{ fontSize: 15.5 }}>{ex.name || r.exId}</strong>
                  <div className="row row--wrap" style={{ gap: 5, marginTop: 4 }}>
                    {ex.equip && <Chip kind="machine">{ex.equip}</Chip>}
                    {ex.mode === 'restpause' && <Chip kind="sub">레스트포즈</Chip>}
                    {ex.lift && <Chip kind="sub">{ex.lift}</Chip>}
                  </div>
                </div>
              </div>

              {r.prevText && (
                <p className="tiny muted" style={{ margin: '0 0 8px' }}>
                  📌 지난 수행 · {r.prevText}
                </p>
              )}
              {ex.type !== 'cardio' && (
                <p className="tiny" style={{ color: 'var(--volt-ink)', margin: '0 0 8px' }}>{po.rule}</p>
              )}

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
                  {r.sets.map((s, si) => (
                    <div key={si} className={`setlog__row ${s.done ? 'is-done' : ''}`}>
                      <span className="setlog__idx">{si + 1}</span>
                      <input
                        className="input input--num setlog__w"
                        inputMode="decimal"
                        placeholder="kg"
                        value={s.w}
                        onChange={(e) => patchSet(r.exId, si, { w: e.target.value })}
                      />
                      <span className="tiny muted">×</span>
                      <input
                        className="input input--num setlog__r"
                        inputMode="numeric"
                        placeholder="회"
                        value={s.reps}
                        onChange={(e) => patchSet(r.exId, si, { reps: e.target.value })}
                      />
                      <input
                        className="input input--num setlog__rir"
                        inputMode="numeric"
                        placeholder="RIR"
                        value={s.rir ?? ''}
                        onChange={(e) => patchSet(r.exId, si, { rir: e.target.value })}
                      />
                      <button
                        type="button"
                        className={`setlog__chk ${s.done ? 'on' : ''}`}
                        aria-pressed={s.done}
                        onClick={() => toggleDone(r.exId, si, r.targets)}
                      >
                        ✓
                      </button>
                      {s.target_text && <span className="setlog__hint">{s.target_text}</span>}
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

      <button type="button" className="btn btn--ghost btn--block" disabled={saving} onClick={midSave}>
        중간 저장
      </button>
      <button
        type="button"
        className="btn btn--block"
        style={{ marginTop: 8, marginBottom: 80 }}
        disabled={saving || doneCount === 0}
        onClick={finish}
      >
        운동 끝내기
      </button>
    </>
  );
}
