import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getMuscleRecoveryStatus, getMainLiftE1RM, getDailyVolumesThisWeek,
} from '@gymlink/core/analytics';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import { TopBar, Card, Chip, Plate } from '../../ui/bits.jsx';
import BodyMap from '../../ui/BodyMap.jsx';

export default function WorkoutAnalyze() {
  const { state } = useWorkout();

  const recovery = useMemo(
    () => getMuscleRecoveryStatus(state.logs, state.programs),
    [state.logs, state.programs],
  );

  const lifts = useMemo(
    () => getMainLiftE1RM(state.logs, state.settings, state.programs),
    [state.logs, state.settings, state.programs],
  );

  const week = useMemo(
    () => getDailyVolumesThisWeek(state.logs),
    [state.logs],
  );

  const maxVol = Math.max(1, ...week.days.map((d) => d.volume));
  const muscleList = Object.values(recovery)
    .filter((m) => m.lastTrainedAt)
    .sort((a, b) => a.recoveryPct - b.recoveryPct);

  return (
    <>
      <TopBar title="운동 분석" sub="회복 · 볼륨 · 추정 1RM" back />

      <Card title="근육 회복도">
        <BodyMap recovery={recovery} gender={state.settings.gender} />
        <p className="tiny muted" style={{ marginTop: 8 }}>
          초록 80%+ · 노랑 40–80% · 빨강 40% 미만 · 회색 미훈련
        </p>
      </Card>

      <Card
        title="주간 볼륨"
        note={week.changePct != null ? `지난주 대비 ${week.changePct > 0 ? '+' : ''}${week.changePct}%` : undefined}
      >
        <div className="volbar">
          {week.days.map((d) => (
            <div key={d.key} className={`volbar__col ${d.isToday ? 'volbar__col--today' : ''}`}>
              <div
                className="volbar__bar"
                style={{ height: `${Math.round((d.volume / maxVol) * 100)}%` }}
                title={`${d.volume}kg`}
              />
              <span className="volbar__label">{d.label}</span>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          이번 주 {week.total.toLocaleString()}kg · 지난 주 {week.lastWeek.toLocaleString()}kg
        </p>
      </Card>

      <Card title="메인 리프트 추정 1RM">
        <div className="row row--wrap" style={{ gap: 10 }}>
          {['스쿼트', '벤치프레스', '데드리프트'].map((lift) => {
            const L = lifts[lift];
            return (
              <div key={lift} className="e1card">
                <p className="e1card__lift">{lift}</p>
                <Plate
                  value={L?.currentE1 ?? '—'}
                  unit="kg"
                  sub={L?.deltaFromLastWeek != null ? `주간 ${L.deltaFromLastWeek > 0 ? '+' : ''}${L.deltaFromLastWeek}` : '기록 없음'}
                />
                {L?.latestDate && (
                  <p className="tiny muted">최근 {L.latestDate}</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="근육별 회복" flush>
        {!muscleList.length && <p className="small muted" style={{ padding: 16 }}>아직 훈련 기록이 없습니다.</p>}
        <ul className="list">
          {muscleList.map((m) => (
            <li key={m.muscle}>
              <div className="list__item">
                <div className="list__body">
                  <div className="list__title">{m.label}</div>
                  <div className="list__meta">
                    회복 {m.recoveryPct}%
                    {m.hoursSinceLast != null ? ` · ${m.hoursSinceLast}h 전` : ''}
                  </div>
                </div>
                <Chip kind={m.recoveryPct >= 80 ? 'go' : m.recoveryPct >= 40 ? 'sub' : 'stop'}>
                  {m.recoveryPct}%
                </Chip>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Link to="/workout/settings" className="btn btn--ghost btn--block btn--sm">
        기준 중량 · 알고리즘 설정
      </Link>
    </>
  );
}
