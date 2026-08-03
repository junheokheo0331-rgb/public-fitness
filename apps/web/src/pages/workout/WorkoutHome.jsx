import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTodayStr, weekStart, dateStrOf } from '@gymlink/core/time';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import { TopBar, Card, Chip, Empty } from '../../ui/bits.jsx';
import { myMembership, mySavedRoutines, getGym } from '../../lib/api.js';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const ORIGIN = {
  auto: '기구 맞춤', owner: '관장 추천', trainer: '숙제', member: '내 루틴',
};

export default function WorkoutHome() {
  const nav = useNavigate();
  const { state, store } = useWorkout();
  const today = getTodayStr();

  const [gymRoutines, setGymRoutines] = useState(null);
  const [gymLabel, setGymLabel] = useState('');
  const [showExtra, setShowExtra] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ms = await myMembership();
      if (!ms) { if (alive) setGymRoutines([]); return; }
      const [list, gym] = await Promise.all([
        mySavedRoutines(ms.gym_id),
        getGym(ms.gym_id),
      ]);
      if (alive) {
        setGymRoutines(list);
        setGymLabel(gym?.name || '');
      }
    })();
    return () => { alive = false; };
  }, []);

  const weekDays = useMemo(() => {
    const start = weekStart(new Date());
    return DAY_LABELS.map((label, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = dateStrOf(d);
      const sessions = store.getSessions(dateStr);
      return { label, dateStr, sessions, isToday: dateStr === today };
    });
  }, [state.logs, today, store]);

  const active = state.session;

  const startFree = () => {
    if (active) { nav('/workout/live'); return; }
    store.startSession({ free: true, dateStr: today });
    nav('/workout/live');
  };

  const startGymRoutine = (r) => {
    if (active) { nav('/workout/live'); return; }
    const day = r.body?.days?.[0];
    if (!day?.items?.length) {
      nav(`/my/routine/${r.id}`);
      return;
    }
    store.startFromGymDay({
      title: r.title,
      day,
      sourceRoutineId: r.id,
      dateStr: today,
    });
    nav('/workout/live');
  };

  const startProgram = (pid) => {
    if (active) { nav('/workout/live'); return; }
    store.startSession({ programId: pid, dateStr: today });
    nav('/workout/live');
  };

  return (
    <>
      <TopBar
        title="운동"
        sub={active ? '진행 중' : (gymLabel || '루틴 · 기록')}
        right={
          <Link to="/workout/settings" className="btn btn--sm btn--ghost">설정</Link>
        }
      />

      {active && (
        <Card>
          <div className="row row--between">
            <div className="grow">
              <p className="eyebrow">진행 중</p>
              <strong style={{ fontSize: 16 }}>{active.title}</strong>
              <p className="tiny muted" style={{ margin: '4px 0 0' }}>{active.dateStr}</p>
            </div>
            <button type="button" className="btn btn--sm" onClick={() => nav('/workout/live')}>
              이어하기
            </button>
          </div>
        </Card>
      )}

      <Card title="오늘 할 루틴" note={gymLabel || undefined}>
        {gymRoutines === null && <p className="muted small">불러오는 중…</p>}
        {gymRoutines?.length === 0 && (
          <Empty
            title="아직 루틴이 없습니다"
            action={
              <button type="button" className="btn btn--sm" onClick={() => nav('/my')}>
                내 헬스장에서 만들기
              </button>
            }
          >
            다니는 헬스장 기구로 루틴을 짜 두면 여기서 바로 시작합니다.
          </Empty>
        )}
        {gymRoutines?.length > 0 && (
          <ul className="list">
            {gymRoutines.map((r) => (
              <li key={r.id}>
                <div className="list__item" style={{ cursor: 'default' }}>
                  <button
                    type="button"
                    className="list__body"
                    style={{
                      border: 0, background: 'none', textAlign: 'left',
                      cursor: 'pointer', padding: 0, flex: 1, minWidth: 0,
                    }}
                    onClick={() => nav(`/my/routine/${r.id}`)}
                  >
                    <div className="row row--wrap" style={{ gap: 6 }}>
                      <span className="list__title">{r.title}</span>
                      <Chip kind="sub">{ORIGIN[r.origin] || r.origin}</Chip>
                      {r.stale && <Chip kind="stop">기구</Chip>}
                    </div>
                    <div className="list__meta">주 {r.days}회</div>
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => startGymRoutine(r)}>
                    시작
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="이번 주">
        <div className="wk-week">
          {weekDays.map((d) => (
            <Link
              key={d.dateStr}
              to={`/workout/day/${d.dateStr}`}
              className={`wk-day ${d.isToday ? 'wk-day--today' : ''}`}
            >
              <span className="wk-day__label">{d.label}</span>
              <span className="wk-day__num">{Number(d.dateStr.slice(8))}</span>
              <span className={`wk-day__dot ${d.sessions.length ? 'on' : ''}`} />
            </Link>
          ))}
        </div>
      </Card>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <button type="button" className="btn btn--ghost grow" onClick={startFree}>
          자유 운동
        </button>
        <Link className="btn btn--ghost grow" to="/workout/analyze">기록 보기</Link>
      </div>

      <button
        type="button"
        className="tiny"
        style={{
          display: 'block', width: '100%', border: 0, background: 'none',
          color: 'var(--ink-3)', fontWeight: 600, cursor: 'pointer', marginBottom: 8,
        }}
        onClick={() => setShowExtra((v) => !v)}
      >
        {showExtra ? '간단 프로그램 접기' : '간단 프로그램 더보기'}
      </button>

      {showExtra && (
        <Card title="간단 프로그램" note="헬스장 루틴과 별개 · 연습용" flush>
          <ul className="list">
            {state.programs.map((p) => (
              <li key={p.id}>
                <div className="list__item" style={{ cursor: 'default' }}>
                  <div className="list__body">
                    <div className="list__title">{p.title}</div>
                    <div className="list__meta">{p.items?.length || 0}종목</div>
                  </div>
                  <button type="button" className="btn btn--sm" onClick={() => startProgram(p.id)}>
                    시작
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
