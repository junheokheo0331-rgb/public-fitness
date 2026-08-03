import { mmss } from '@gymlink/core/time';
import { useWorkout } from '../lib/workout/WorkoutContext.jsx';

export default function RestBar() {
  const { timer, store } = useWorkout();
  if (!timer) return null;

  const label = timer.label || '휴식';
  const display = timer.overtime
    ? `+${mmss(-timer.remainSec)}`
    : mmss(timer.remainSec);

  return (
    <div className={`restbar ${timer.overtime ? 'over' : ''}`} role="timer" aria-live="polite">
      <div className="restbar__top">
        <span className="restbar__label">{label}</span>
        <span className="restbar__time mono">{display}</span>
      </div>
      <div className="restbar__track">
        <div
          className="restbar__fill"
          style={{ width: `${Math.round(timer.progress * 100)}%` }}
        />
      </div>
      <div className="restbar__actions">
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => store.restAdd(-15)}>-15</button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => store.restAdd(15)}>+15</button>
        <button type="button" className="btn btn--sm" onClick={() => store.clearRest()}>건너뛰기</button>
      </div>
    </div>
  );
}
