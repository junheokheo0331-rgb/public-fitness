import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTodayStr, weekStart, dateStrOf } from '@gymlink/core/time';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import { useSession } from '../../lib/session.jsx';
import { TopBar, Card, Chip, Empty } from '../../ui/bits.jsx';
import { myMembership, mySavedRoutines, getGym, trainerRoutines } from '../../lib/api.js';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const ORIGIN = {
  auto: '내 헬스장 맞춤', owner: '관장 추천', trainer: '숙제', member: '내 루틴',
};

export default function WorkoutHome() {
  const nav = useNavigate();
  const { state, store } = useWorkout();
  const { session: user } = useSession();
  const isTrainer = user.role === 'trainer';
  const today = getTodayStr();

  const [gymRoutines, setGymRoutines] = useState(null);
  const [gymLabel, setGymLabel] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (isTrainer) {
          const [list, gym] = await Promise.all([
            trainerRoutines(),
            user.gymId ? getGym(user.gymId) : Promise.resolve(null),
          ]);
          if (alive) {
            setGymRoutines(list);
            setGymLabel(gym?.name || '내 루틴 보관함');
          }
          return;
        }
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
      } catch (error) {
        if (alive) {
          setGymRoutines([]);
          setLoadError(error.message || '루틴을 불러오지 못했습니다.');
        }
      }
    })();
    return () => { alive = false; };
  }, [isTrainer, user.gymId]);

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
      nav(isTrainer ? `/t/routines/${r.id}` : `/my/routine/${r.id}`);
      return;
    }
    store.startFromGymDay({
      title: r.title,
      day,
      sourceRoutineId: r.id,
      sourceDayIndex: 0,
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
          <Link to={isTrainer ? '/t/routines/new' : '/workout/programs/new'} className="btn btn--sm">+ 루틴 짜기</Link>
        }
      />

      {loadError && <Card><p className="small" style={{ color: 'var(--stop)', margin: 0 }}>{loadError}</p></Card>}

      {gymLabel && !isTrainer && (
        <Card className="workout-gym-summary">
          <div className="row row--between">
            <div className="grow">
              <p className="eyebrow">내 헬스장</p>
              <strong>{gymLabel}</strong>
              <p className="tiny muted" style={{ margin: '4px 0 0' }}>이곳의 보유 머신을 종목 추천에 반영합니다.</p>
            </div>
            <Link to="/my" className="btn btn--sm btn--ghost">기구·추천</Link>
          </div>
        </Card>
      )}

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

      <Card title={isTrainer ? '내 루틴 보관함' : '오늘 할 루틴'} note={gymLabel || undefined}>
        {gymRoutines === null && <p className="muted small">불러오는 중…</p>}
        {gymRoutines?.length === 0 && (
          <Empty
            title="아직 루틴이 없습니다"
            action={
              <button type="button" className="btn btn--sm" onClick={() => nav(isTrainer ? '/t/routines/new' : '/workout/programs/new')}>
                루틴 짜기
              </button>
            }
          >
            전체 운동에서 고르고, 내 헬스장에서 가능한 종목을 추천받을 수 있습니다.
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
                    onClick={() => nav(isTrainer ? `/t/routines/${r.id}` : `/my/routine/${r.id}`)}
                  >
                    <div className="row row--wrap" style={{ gap: 6 }}>
                      <span className="list__title">{r.title}</span>
                      {!isTrainer && <Chip kind="sub">{ORIGIN[r.origin] || r.origin}</Chip>}
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

      {!isTrainer && <Card
        title="내가 만든 루틴" note="종목·세트·반복을 자유롭게 구성"
        right={<Link to="/workout/programs/new" className="btn btn--sm btn--ghost">+ 새 루틴</Link>}
        flush
      >
        <ul className="list">
          {state.programs.map((p) => (
            <li key={p.id}>
              <div className="list__item" style={{ cursor: 'default' }}>
                <Link className="list__body" to={`/workout/programs/${p.id}`}>
                  <div className="list__title">{p.title}</div>
                  <div className="list__meta">{p.items?.length || 0}종목{p.desc ? ` · ${p.desc}` : ''}</div>
                </Link>
                <button type="button" className="btn btn--sm" onClick={() => startProgram(p.id)}>
                  시작
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>}
    </>
  );
}
