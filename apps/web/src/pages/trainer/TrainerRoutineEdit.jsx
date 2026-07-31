import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import {
  searchExerciseCatalog, catalogToRoutineItem,
  itemToEditable, editableToItem,
} from '@gymlink/core/catalog';
import { TopBar, Card, Chip, Field, Note, Empty } from '../../ui/bits.jsx';
import {
  availableExercises, getTrainerRoutine, saveTrainerRoutine, deleteTrainerRoutine,
} from '../../lib/api.js';

const GOALS = [
  { key: 'hypertrophy', label: '근비대' },
  { key: 'fatloss', label: '감량' },
  { key: 'strength', label: '스트렝스' },
  { key: 'conditioning', label: '컨디션' },
];

/* 트레이너 루틴 편집 — workoutapp 프로그램 편집(종목 추가·세트·RIR) 이식 */

export default function TrainerRoutineEdit() {
  const { routineId } = useParams();
  const [params] = useSearchParams();
  const memberId = params.get('member');
  const isNew = !routineId || routineId === 'new';
  const nav = useNavigate();

  const [title, setTitle] = useState('새 루틴');
  const [goal, setGoal] = useState('hypertrophy');
  const [days, setDays] = useState(3);
  const [level, setLevel] = useState(2);
  const [dayIdx, setDayIdx] = useState(0);
  const [body, setBody] = useState(null); // { days:[{name, items: editable[]}]}
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await availableExercises('g-1', level);
      if (!alive) return;

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
  // 최초 로드만 — 목표/일수 변경은 버튼으로 재생성
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId, isNew]);

  const suggestions = useMemo(
    () => (query.trim().length >= 1 ? searchExerciseCatalog(query, 6) : []),
    [query],
  );

  const rebuild = async () => {
    const list = await availableExercises('g-1', level);
    const built = buildRoutine({
      available: list,
      daysPerWeek: Number(days) || 3,
      goal,
      level: Number(level) || 2,
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

  const patchItem = (di, ii, patch) => {
    setBody((prev) => {
      const daysArr = prev.days.map((d, i) => {
        if (i !== di) return d;
        const items = d.items.map((it, j) => (j === ii ? { ...it, ...patch } : it));
        return { ...d, items };
      });
      return { days: daysArr };
    });
  };

  const removeItem = (di, ii) => {
    setBody((prev) => ({
      days: prev.days.map((d, i) => (
        i === di ? { ...d, items: d.items.filter((_, j) => j !== ii) } : d
      )),
    }));
  };

  const addFromCatalog = (c) => {
    const ex = catalogToRoutineItem(c);
    setBody((prev) => ({
      days: prev.days.map((d, i) => (
        i === dayIdx ? { ...d, items: [...d.items, ex] } : d
      )),
    }));
    setQuery('');
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
        sub="종목·세트·RIR 직접 편집"
        back
        right={
          <button type="button" className="btn btn--sm" onClick={save} disabled={busy}>
            {busy ? '…' : '저장'}
          </button>
        }
      />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

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
          기구 기준으로 다시 짜기
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

      <Card title={`${day.name} · 종목`}>
        <Field label="종목 검색 추가" hint="workoutapp 카탈로그">
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
                <button type="button" className="list__item" style={{ width: '100%' }} onClick={() => addFromCatalog(c)}>
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

        {!day.items.length && <Empty title="종목이 없습니다" />}

        {day.items.map((ex, ii) => (
          <div key={ex.id} className="exedit">
            <div className="row row--between">
              <strong style={{ fontSize: 14.5 }}>{ex.name || '이름 없음'}</strong>
              <button type="button" className="btn btn--sm btn--stop" onClick={() => removeItem(dayIdx, ii)}>삭제</button>
            </div>
            {ex.type !== 'cardio' && (
              <div className="rowfields" style={{ marginTop: 8 }}>
                <Field label="세트">
                  <input className="input input--num" value={ex.sets} onChange={(e) => patchItem(dayIdx, ii, { sets: e.target.value })} />
                </Field>
                <Field label="RIR">
                  <input className="input input--num" value={ex.rir} onChange={(e) => patchItem(dayIdx, ii, { rir: e.target.value })} />
                </Field>
                <Field label="반복 하한">
                  <input className="input input--num" value={ex.repLo} onChange={(e) => patchItem(dayIdx, ii, { repLo: e.target.value })} />
                </Field>
                <Field label="반복 상한">
                  <input className="input input--num" value={ex.repHi} onChange={(e) => patchItem(dayIdx, ii, { repHi: e.target.value })} />
                </Field>
              </div>
            )}
            <Field label="메모">
              <input className="input" value={ex.note || ''} onChange={(e) => patchItem(dayIdx, ii, { note: e.target.value })} />
            </Field>
            <div className="row row--wrap">
              <Chip>{ex.equip || '기구'}</Chip>
              {ex.lift && <Chip kind="sub">{ex.lift}</Chip>}
              <Chip kind="machine">휴식 {ex.rest}s</Chip>
            </div>
          </div>
        ))}
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
