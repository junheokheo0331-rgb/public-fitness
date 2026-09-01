import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hhmmss, mmss } from '@gymlink/core/time';
import { useWorkout } from '../lib/workout/WorkoutContext.jsx';

export default function RestBar() {
  const { state, timer, store } = useWorkout();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setTick] = useState(0);
  const session = state.session;

  useEffect(() => {
    if (!session) return undefined;
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [session]);

  if (!timer && !session) return null;

  const label = timer?.label || session?.title || '운동 중';
  const display = timer
    ? (timer.overtime ? `+${mmss(-timer.remainSec)}` : mmss(timer.remainSec))
    : hhmmss(Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)));
  const sets = session ? Object.values(session.setsMap || {}).flat() : [];
  const done = sets.filter((set) => set.done).length;
  const isLive = location.pathname === '/workout/live';

  const goLive = () => {
    if (session && !isLive) navigate('/workout/live');
  };

  return (
    <div className={`restbar ${timer?.overtime ? 'over' : ''} ${session ? 'has-session' : ''}`} role="timer" aria-live="polite">
      <button type="button" className="restbar__main" onClick={goLive} disabled={!session || isLive}>
        <span className="restbar__pulse" aria-hidden="true" />
        <span className="restbar__copy">
          <strong>{timer ? '휴식 중' : '운동 중'}</strong>
          <small>{label}{session ? ` · ${done}/${sets.length}세트` : ''}</small>
        </span>
        <span className="restbar__time mono">{display}</span>
        {session && !isLive && <span className="restbar__return">돌아가기 ›</span>}
      </button>
      {timer && (
        <div className="restbar__quick">
          <button type="button" onClick={() => store.restAdd(-15)}>−15</button>
          <button type="button" onClick={() => store.restAdd(15)}>＋15</button>
          <button type="button" onClick={() => store.clearRest()}>건너뛰기</button>
        </div>
      )}
      {timer && (
        <div className="restbar__track">
          <div className="restbar__fill" style={{ width: `${Math.round(timer.progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
