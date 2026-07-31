import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { TopBar, Card, Chip, Field, Note, Plate, Stack, Empty } from '../../ui/bits.jsx';
import {
  availableExercises, getTrainerRoutine, saveTrainerRoutine, deleteTrainerRoutine,
} from '../../lib/api.js';

const GOALS = [
  { key: 'hypertrophy', label: '근비대' },
  { key: 'fatloss', label: '감량' },
  { key: 'strength', label: '스트렝스' },
  { key: 'conditioning', label: '컨디션' },
];

/* 트레이너 루틴 추가·수정·미리보기. 저장 후 숙제로 바로 보낼 수 있다. */

export default function TrainerRoutineEdit() {
  const { routineId } = useParams();
  const [params] = useSearchParams();
  const memberId = params.get('member');
  const isNew = !routineId || routineId === 'new';
  const nav = useNavigate();

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('hypertrophy');
  const [days, setDays] = useState(3);
  const [level, setLevel] = useState(2);
  const [ex, setEx] = useState(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await availableExercises('g-1', level);
      if (!alive) return;
      setEx(list);
      if (!isNew) {
        const meta = await getTrainerRoutine(routineId);
        if (meta) {
          setTitle(meta.title);
          setGoal(meta.goal || 'hypertrophy');
          setDays(meta.days || 3);
          setLevel(meta.level || 2);
        }
      } else {
        setTitle('새 루틴');
      }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [routineId, isNew, level]);

  const built = useMemo(() => {
    if (!ex) return null;
    return buildRoutine({
      available: ex,
      daysPerWeek: Number(days) || 3,
      goal,
      level: Number(level) || 2,
      stats: {
        LEG_PRESS_EX: { e1rm: 180 },
        SMITH_BENCH: { e1rm: 95 },
        LAT_PULLDOWN_W: { e1rm: 70 },
      },
    });
  }, [ex, days, goal, level]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const id = await saveTrainerRoutine({
        title: title.trim() || '새 루틴',
        goal, level, days: built?.days.length ?? days,
        routineId: isNew ? null : routineId,
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

  if (!loaded || !built) {
    return (
      <>
        <TopBar title={isNew ? '루틴 추가' : '루틴'} back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }

  const day = built.days[Math.min(dayIdx, built.days.length - 1)];

  return (
    <>
      <TopBar
        title={isNew ? '루틴 추가' : '루틴 편집'}
        sub="헬스장 기구 기준"
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
            <select className="input" value={days} onChange={(e) => { setDays(Number(e.target.value)); setDayIdx(0); }}>
              {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}일</option>)}
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
      </Card>

      <div className="row row--wrap" style={{ marginBottom: 12 }}>
        {built.days.map((d, i) => (
          <button
            key={d.day_index}
            type="button"
            className={`btn btn--sm ${i === dayIdx ? '' : 'btn--ghost'}`}
            onClick={() => setDayIdx(i)}
          >
            {d.name}
          </button>
        ))}
      </div>

      {!day?.items?.length && (
        <Card><Empty title="이 날 배정된 종목이 없습니다" /></Card>
      )}

      {day?.items?.map((it) => (
        <Card key={it.exercise_code}>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="row row--wrap" style={{ gap: 6, marginBottom: 4 }}>
                <strong style={{ fontSize: 15.5 }}>{it.name}</strong>
                {it.is_substitute && <Chip kind="sub">대체</Chip>}
              </div>
              <Chip kind="machine">{it.machine_name ?? '맨몸'}</Chip>
              <div className="small muted" style={{ marginTop: 8 }}>
                {it.duration_min
                  ? `${it.duration_min}분 · ${it.intensity}`
                  : `${it.sets}세트 × ${it.rep_range[0]}–${it.rep_range[1]}회 · 휴식 ${it.rest_sec}초`}
              </div>
              {!it.duration_min && <Stack total={it.sets} done={0} current={0} />}
            </div>
            {it.suggested_kg != null
              ? <Plate value={it.suggested_kg} unit="kg" />
              : <Plate value="—" unit="kg" ghost />}
          </div>
        </Card>
      ))}

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
        <button
          type="button"
          className="btn btn--stop btn--block"
          style={{ marginTop: 8 }}
          onClick={remove}
        >
          보관함에서 삭제
        </button>
      )}

      <Note style={{ marginTop: 12 }}>
        <p className="small">
          종목은 헬스장 보유 기구로만 짜입니다. 없는 기구는 자동으로 빠지거나 대체됩니다.
        </p>
      </Note>
    </>
  );
}
