import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { progressiveOverloadLines } from '@gymlink/core/progress';
import { TopBar, Card, Chip, Note, Empty } from '../../ui/bits.jsx';
import {
  myClients, memberHomework, getTrainerRoutine, getSavedRoutine,
  getExerciseStats, lastSetsForExercise, listWorkoutSessions,
} from '../../lib/api.js';

/* 트레이너용 — 회원 숙제/기록 기준 다음 목표 */

export default function ClientOverload() {
  const { memberId } = useParams();
  const [client, setClient] = useState(undefined);
  const [rows, setRows] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cs, hw, stats, logs] = await Promise.all([
        myClients(),
        memberHomework(memberId),
        getExerciseStats(),
        listWorkoutSessions(10),
      ]);
      if (!alive) return;
      setClient(cs.find((c) => c.id === memberId) ?? null);
      setSessions(logs);

      const latestHw = hw[0];
      let body = null;
      if (latestHw?.routine_id) {
        const tr = await getTrainerRoutine(latestHw.routine_id);
        body = tr?.body;
        if (!body) {
          const saved = await getSavedRoutine(latestHw.routine_id);
          body = saved?.body;
        }
      }

      const items = body?.days?.[0]?.items || [];
      const built = [];
      for (const it of items) {
        const prev = await lastSetsForExercise(it.exercise_code || it.id);
        const po = progressiveOverloadLines(it, prev || [], stats);
        const prevText = (prev || [])
          .filter((s) => s.done && +s.reps > 0)
          .map((s) => `${s.w}×${s.reps}${s.rir != null ? `(R${s.rir})` : ''}`)
          .join(' / ');
        built.push({
          name: it.name,
          code: it.exercise_code,
          prevText: prevText || null,
          po,
          lift: it.lift,
          mode: it.mode,
        });
      }
      if (alive) setRows({ homework: latestHw, items: built });
    })();
    return () => { alive = false; };
  }, [memberId]);

  if (client === undefined) {
    return (
      <>
        <TopBar title="다음 목표" back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <TopBar title="다음 목표" back />
        <Card><Empty title="담당 회원이 아닙니다" /></Card>
      </>
    );
  }

  return (
    <>
      <TopBar title={client.name} sub="다음 목표 미리보기" back />

      <Note kind="volt" title="자동조절 규칙">
        <p className="small">메인: 지난 수행 기준으로 세션당 소폭 증·감. 증량 단위가 크면 반복이 먼저 오릅니다.</p>
        <p className="small">보조: 반복 +1 → 상한이면 증량 후 하한으로.</p>
        <p className="small">레스트포즈: 총 반복으로 진행.</p>
      </Note>

      {rows?.homework && (
        <Card title="최근 숙제" note={rows.homework.title}>
          <p className="small muted" style={{ margin: 0 }}>
            {rows.homework.sent_at?.replace(/-/g, '.')} 전송
            {rows.homework.note ? ` · ${rows.homework.note}` : ''}
          </p>
        </Card>
      )}

      {!rows && <Card><p className="muted small">불러오는 중…</p></Card>}

      {rows && rows.items.length === 0 && (
        <Card>
          <Empty title="과부하를 계산할 루틴이 없습니다">
            먼저 루틴을 저장해 숙제로 보내세요.
          </Empty>
          <Link className="btn btn--block" to={`/t/clients/${memberId}`}>
            회원 상세로
          </Link>
        </Card>
      )}

      {rows?.items.map((r) => (
        <Card key={r.code || r.name}>
          <div className="row row--between" style={{ marginBottom: 8 }}>
            <strong>{r.name}</strong>
            <div className="row" style={{ gap: 4 }}>
              {r.lift && <Chip kind="sub">{r.lift}</Chip>}
              {r.mode === 'restpause' && <Chip>RP</Chip>}
            </div>
          </div>
          {r.prevText ? (
            <p className="tiny muted" style={{ margin: '0 0 8px' }}>📌 지난 수행 · {r.prevText}</p>
          ) : (
            <p className="tiny muted" style={{ margin: '0 0 8px' }}>아직 기록 없음 · 첫 세션은 감각으로</p>
          )}
          <p className="tiny" style={{ color: 'var(--volt-ink)', margin: '0 0 8px' }}>{r.po.rule}</p>
          <ul className="overload__list">
            {r.po.lines.map((l) => (
              <li key={l.set}>
                <span className="mono">세트 {l.set}</span>
                <span className="overload__link">{l.text}</span>
                <Chip kind="sub">{l.kind}</Chip>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {sessions.length > 0 && (
        <Card title="최근 세션 로그" note="회원 앱에서 기록한 것">
          <ul className="list">
            {sessions.slice(0, 5).map((s) => (
              <li key={s.id} className="list__item" style={{ cursor: 'default' }}>
                <div className="list__body">
                  <div className="list__title">{s.date}</div>
                  <div className="list__meta">
                    {(s.exercises || []).length}종목 ·{' '}
                    {(s.exercises || []).reduce((a, e) => a + (e.sets || []).filter((x) => x.done).length, 0)}세트 완료
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Link className="btn btn--ghost btn--block" to={`/t/clients/${memberId}`}>
        회원 상세로
      </Link>
    </>
  );
}
