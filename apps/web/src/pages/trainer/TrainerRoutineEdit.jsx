import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { itemToEditable, editableToItem } from '@gymlink/core/catalog';
import { TopBar, Card, Chip, Field, Note, Empty } from '../../ui/bits.jsx';
import SortableList, { reorder } from '../../ui/SortableList.jsx';
import ExercisePicker, { toEditableExercise } from '../../ui/ExercisePicker.jsx';
import {
  availableExercises, getTrainerRoutine, saveTrainerRoutine, deleteTrainerRoutine,
  getExerciseStats,
} from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';

const GOALS = [
  { key: 'hypertrophy', label: '근비대' },
  { key: 'fatloss', label: '감량' },
  { key: 'strength', label: '스트렝스' },
  { key: 'conditioning', label: '컨디션' },
];

const LIFTS = ['', '스쿼트', '벤치프레스', '데드리프트'];
const MODES = [
  { key: 'normal', label: '일반' },
  { key: 'restpause', label: '레스트포즈' },
];

/* 드래그 순서 변경 · 종목 편집 · 다음 목표 미리보기 */

export default function TrainerRoutineEdit() {
  const { routineId } = useParams();
  const [params] = useSearchParams();
  const memberId = params.get('member');
  const isNew = !routineId || routineId === 'new';
  const nav = useNavigate();
  const { session } = useSession();
  const gymId = session?.gymId;

  const [title, setTitle] = useState('새 루틴');
  const [goal, setGoal] = useState('hypertrophy');
  const [days, setDays] = useState(3);
  const [level, setLevel] = useState(2);
  const [dayIdx, setDayIdx] = useState(0);
  const [body, setBody] = useState(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [stats, setStats] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [gymAvailable, setGymAvailable] = useState([]);

  useEffect(() => {
    if (!gymId) { setLoaded(true); return undefined; }
    let alive = true;
    (async () => {
      const [list, st] = await Promise.all([
        availableExercises(gymId, level),
        getExerciseStats(),
      ]);
      if (!alive) return;
      setStats(st);
      setGymAvailable(list);

      if (!isNew) {
        const meta = await getTrainerRoutine(routineId);
        if (meta) {
          setTitle(meta.title);
          setGoal(meta.goal || 'hypertrophy');
          setDays(meta.days || 3);
          setLevel(meta.level || 2);
          if (meta.body?.days?.length) {
            setBody({
              days: meta.body.days.map((d) => ({
                ...d,
                items: (d.items || []).map(itemToEditable),
              })),
            });
            setLoaded(true);
            return;
          }
        }
      }

      const built = buildRoutine({
        available: list,
        daysPerWeek: Number(days) || 3,
        goal,
        level: Number(level) || 2,
        stats: st,
      });
      setBody({
        days: built.days.map((d) => ({
          day_index: d.day_index,
          name: d.name,
          items: d.items.map(itemToEditable),
        })),
      });
      setLoaded(true);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId, isNew, gymId]);

  if (!gymId) return <><TopBar title="루틴 편집" back /><Card><Empty title="소속 헬스장이 없습니다">설정에서 소속 등록 상태를 확인해주세요.</Empty></Card></>;

  const rebuild = async () => {
    const list = await availableExercises(gymId, level);
    setGymAvailable(list);
    const built = buildRoutine({
      available: list,
      daysPerWeek: Number(days) || 3,
      goal,
      level: Number(level) || 2,
      stats,
    });
    setBody({
      days: built.days.map((d) => ({
        day_index: d.day_index,
        name: d.name,
        items: d.items.map(itemToEditable),
      })),
    });
    setDayIdx(0);
  };

  const patchItem = (ii, patch) => {
    setBody((prev) => ({
      days: prev.days.map((d, i) => {
        if (i !== dayIdx) return d;
        return { ...d, items: d.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) };
      }),
    }));
  };

  const removeItem = (ii) => {
    setBody((prev) => ({
      days: prev.days.map((d, i) => (
        i === dayIdx ? { ...d, items: d.items.filter((_, j) => j !== ii) } : d
      )),
    }));
  };

  const onReorder = (from, to) => {
    setBody((prev) => ({
      days: prev.days.map((d, i) => (
        i === dayIdx ? { ...d, items: reorder(d.items, from, to) } : d
      )),
    }));
  };

  const addFromCatalog = (choice) => {
    const ex = toEditableExercise(choice);
    setBody((prev) => ({
      days: prev.days.map((d, i) => (
        i === dayIdx ? { ...d, items: [...d.items, ex] } : d
      )),
    }));
    setQuery('');
    setOpenId(ex.id);
  };

  const toPersistBody = () => ({
    days: body.days.map((d, i) => ({
      day_index: i,
      name: d.name,
      items: d.items.map(editableToItem),
    })),
    warnings: [],
  });

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const persist = toPersistBody();
      const id = await saveTrainerRoutine({
        gymId,
        title: title.trim() || '새 루틴',
        goal, level,
        days: persist.days.length,
        routineId: isNew ? null : routineId,
        body: persist,
      });
      setMsg('저장했습니다.');
      if (isNew) {
        nav(`/t/routines/${id}${memberId ? `?member=${memberId}` : ''}`, { replace: true });
      }
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 2000);
    }
  };

  const remove = async () => {
    if (!confirm('이 루틴을 보관함에서 삭제할까요?')) return;
    await deleteTrainerRoutine(routineId);
    nav(memberId ? `/t/clients/${memberId}` : '/t/clients');
  };

  if (!loaded || !body) {
    return (
      <>
        <TopBar title={isNew ? '루틴 추가' : '루틴'} back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }

  const day = body.days[Math.min(dayIdx, body.days.length - 1)];

  return (
    <>
      <TopBar
        title={isNew ? '루틴 추가' : '루틴 편집'}
        sub="순서 변경 · 다음 목표 미리보기"
        back
        right={
          <button type="button" className="btn btn--sm" onClick={save} disabled={busy}>
            {busy ? '…' : '저장'}
          </button>
        }
      />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Note kind="volt" title="다음 목표 자동 조절">
        <p className="small">
          회원의 지난 무게·반복 기록을 바탕으로 다음 목표가 잡힙니다.
          전문 용어 없이 종목을 펼치면 세트별 목표를 확인할 수 있습니다.
        </p>
        {memberId && (
          <button
            type="button"
            className="btn btn--sm"
            style={{ marginTop: 8 }}
            onClick={() => nav(`/t/clients/${memberId}/overload`)}
          >
            이 회원 다음 목표 보기 →
          </button>
        )}
      </Note>

      <Card title="루틴 정보">
        <Field label="제목">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="목표">
          <div className="row row--wrap">
            {GOALS.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`chip ${goal === g.key ? 'chip--pick' : ''}`}
                onClick={() => setGoal(g.key)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="rowfields">
          <Field label="주당 일수">
            <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}일</option>)}
            </select>
          </Field>
          <Field label="난이도">
            <select className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              <option value={1}>입문</option>
              <option value={2}>중급</option>
              <option value={3}>고급</option>
            </select>
          </Field>
        </div>
        <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={rebuild}>
          현재 헬스장에 맞게 조정
        </button>
      </Card>

      <div className="row row--wrap" style={{ marginBottom: 12 }}>
        {body.days.map((d, i) => (
          <button
            key={d.day_index ?? i}
            type="button"
            className={`btn btn--sm ${i === dayIdx ? '' : 'btn--ghost'}`}
            onClick={() => setDayIdx(i)}
          >
            {d.name}
          </button>
        ))}
      </div>

      <Card title={`${day.name} · 종목`} note="⋮⋮ 잡고 끌어서 순서 변경">
        <ExercisePicker
          available={gymAvailable} query={query} onQueryChange={setQuery} onAdd={addFromCatalog}
        />

        {!day.items.length && <Empty title="종목이 없습니다" />}

        <SortableList
          items={day.items}
          keyOf={(ex) => ex.id}
          onReorder={onReorder}
        >
          {(ex, ii) => {
            const open = openId === ex.id;
            const item = editableToItem(ex);
            return (
              <div className="exedit exedit--dnd">
                <button
                  type="button"
                  className="exedit__head"
                  onClick={() => setOpenId(open ? null : ex.id)}
                >
                  <div className="grow">
                    <strong style={{ fontSize: 14.5 }}>{ex.name || '이름 없음'}</strong>
                    <div className="tiny muted">
                      {ex.type === 'cardio'
                        ? `${ex.targetMin}분`
                        : `${ex.sets}세트 · ${ex.repLo}–${ex.repHi}회`}
                      {ex.lift ? ` · ${ex.lift}` : ''}
                      {ex.mode === 'restpause' ? ' · RP' : ''}
                    </div>
                  </div>
                  <span className="tiny muted">{open ? '접기' : '편집'}</span>
                </button>

                {open && (
                  <div className="exedit__panel">
                    <Field label="이름">
                      <input className="input" value={ex.name} onChange={(e) => patchItem(ii, { name: e.target.value })} />
                    </Field>
                    {ex.type !== 'cardio' && (
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
                            {LIFTS.map((l) => <option key={l || 'none'} value={l}>{l || '없음 (보조)'}</option>)}
                          </select>
                        </Field>
                      </>
                    )}
                    <Field label="메모">
                      <input className="input" value={ex.note || ''} onChange={(e) => patchItem(ii, { note: e.target.value })} />
                    </Field>

                    <button type="button" className="btn btn--sm btn--stop" onClick={() => removeItem(ii)}>
                      종목 삭제
                    </button>
                  </div>
                )}
              </div>
            );
          }}
        </SortableList>
      </Card>

      <button type="button" className="btn btn--block" onClick={save} disabled={busy}>
        {busy ? '저장 중…' : '루틴 저장'}
      </button>

      {!isNew && memberId && (
        <button
          type="button"
          className="btn btn--volt btn--block"
          style={{ marginTop: 8 }}
          onClick={() => nav(`/t/clients/${memberId}/send?routine=${routineId}`)}
        >
          이 루틴으로 숙제 내기
        </button>
      )}

      {!isNew && (
        <button type="button" className="btn btn--stop btn--block" style={{ marginTop: 8 }} onClick={remove}>
          보관함에서 삭제
        </button>
      )}
    </>
  );
}
