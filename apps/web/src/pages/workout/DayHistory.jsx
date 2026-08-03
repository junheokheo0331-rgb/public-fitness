import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { sessionVolume, setVolume } from '@gymlink/core/analytics';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import { TopBar, Card, Chip, Empty } from '../../ui/bits.jsx';

export default function DayHistory() {
  const { date } = useParams();
  const { store } = useWorkout();

  const sessions = useMemo(() => store.getSessions(date), [store, date]);

  const remove = (sessionId) => {
    if (!confirm('이 세션 기록을 삭제할까요?')) return;
    store.deleteSession(date, sessionId);
  };

  return (
    <>
      <TopBar title={date} sub="운동 기록" back />

      {!sessions.length && (
        <Card>
          <Empty title="이 날 기록이 없습니다" />
        </Card>
      )}

      {sessions.map((sess) => {
        const vol = sessionVolume(sess);
        const prog = sess.programId ? store.getProgram(sess.programId) : null;
        const title = sess.title || prog?.title || (sess.free ? '자유 운동' : '운동');

        return (
          <Card key={sess.id} title={title} note={`볼륨 ${Math.round(vol).toLocaleString()}kg`}>
            {sess.startedAt && (
              <p className="tiny muted" style={{ marginBottom: 10 }}>
                {new Date(sess.startedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                {sess.endedAt && ` – ${new Date(sess.endedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            )}

            {sess.sets && Object.entries(sess.sets).map(([exId, arr]) => {
              const ex = store.findExById(exId);
              const done = (arr || []).filter((s) => s.done);
              if (!done.length) return null;
              return (
                <div key={exId} style={{ marginBottom: 12 }}>
                  <div className="row row--between">
                    <strong className="small">{ex.name || exId}</strong>
                    <Chip kind="sub">{Math.round(setVolume(arr))}kg</Chip>
                  </div>
                  <p className="tiny muted">
                    {done.map((s, i) => (
                      <span key={i}>
                        {i > 0 ? ' · ' : ''}
                        {s.w}×{s.reps}{s.rir != null ? `@R${s.rir}` : ''}
                      </span>
                    ))}
                  </p>
                </div>
              );
            })}

            <button type="button" className="btn btn--sm btn--stop" onClick={() => remove(sess.id)}>
              삭제
            </button>
          </Card>
        );
      })}
    </>
  );
}
