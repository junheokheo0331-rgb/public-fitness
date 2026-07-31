import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { TopBar, Card, Chip, Note, Field, Empty } from '../../ui/bits.jsx';
import { myClients, trainerRoutines, assignRoutine } from '../../lib/api.js';

/* 보관함 루틴을 골라 회원에게 숙제로 보낸다. */

const GOAL_LABEL = {
  hypertrophy: '근비대', fatloss: '감량', strength: '스트렝스', conditioning: '컨디션',
};

export default function SendRoutine() {
  const { memberId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();

  const [client, setClient] = useState(undefined);
  const [routines, setRoutines] = useState(null);
  const [picked, setPicked] = useState(params.get('routine'));
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [cs, rs] = await Promise.all([myClients(), trainerRoutines()]);
      setClient(cs.find((c) => c.id === memberId) ?? null);
      setRoutines(rs);
      const pref = params.get('routine');
      if (pref && rs.some((r) => r.id === pref)) setPicked(pref);
    })();
  }, [memberId, params]);

  if (client === undefined || !routines) {
    return (
      <>
        <TopBar title="숙제 내기" back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }
  if (!client) {
    return (
      <>
        <TopBar title="숙제 내기" back />
        <Card><Empty title="담당 회원이 아닙니다" /></Card>
      </>
    );
  }

  async function send() {
    setPhase('sending');
    setError(null);
    try {
      await assignRoutine({
        memberId,
        routineId: picked,
        note: note.trim() || null,
        dueDate: due || null,
      });
      setPhase('done');
    } catch (err) {
      console.error(err);
      setError(err.message || '보내지 못했습니다.');
      setPhase('idle');
    }
  }

  if (phase === 'done') {
    const r = routines.find((x) => x.id === picked);
    return (
      <>
        <TopBar title="숙제 보냄" back />
        <Note kind="go" title={`${client.name} 회원에게 전달됐습니다`}>
          <p className="small">
            &lsquo;{r?.title}&rsquo; 이(가) 회원 앱의 내 헬스장 → 저장된 루틴에 숙제로 보입니다.
          </p>
        </Note>
        <button type="button" className="btn btn--block" onClick={() => nav(`/t/clients/${memberId}`)}>
          회원 상세로
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 8 }}
          onClick={() => nav('/t/clients')}
        >
          담당 회원 목록
        </button>
      </>
    );
  }

  return (
    <>
      <TopBar title={client.name} sub="숙제 내기" back />

      {error && <Note kind="stop"><p className="small">{error}</p></Note>}

      <Card title="보관함에서 고르기" flush>
        {routines.length === 0 ? (
          <div style={{ padding: 16 }}>
            <Empty title="만들어 둔 루틴이 없습니다">
              먼저 루틴을 추가한 뒤 숙제를 보내세요.
            </Empty>
            <Link className="btn btn--block" to={`/t/routines/new?member=${memberId}`}>
              루틴 추가
            </Link>
          </div>
        ) : (
          <ul className="list">
            {routines.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="list__item"
                  style={{ width: '100%' }}
                  aria-pressed={picked === r.id}
                  onClick={() => setPicked(r.id)}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 20, height: 20, flex: 'none', borderRadius: 999,
                      border: `1px solid ${picked === r.id ? 'var(--volt)' : 'var(--line)'}`,
                      background: picked === r.id ? 'var(--volt)' : '#fff',
                    }}
                  />
                  <span className="list__body">
                    <span className="list__title">{r.title}</span>
                    <span className="list__meta">
                      주 {r.days}회 · {GOAL_LABEL[r.goal] ?? r.goal} · {r.updated.replace(/-/g, '.')}
                    </span>
                  </span>
                  {picked === r.id && <Chip kind="sub">선택</Chip>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {routines.length > 0 && (
        <button
          type="button"
          className="btn btn--ghost btn--block btn--sm"
          style={{ marginBottom: 12 }}
          onClick={() => nav(`/t/routines/new?member=${memberId}`)}
        >
          + 새 루틴 만들고 쓰기
        </button>
      )}

      <Card title="숙제 메모">
        <Field label="알림장" hint="주의점·이번 주 목표를 적어 주세요.">
          <textarea
            className="input"
            rows={3}
            style={{ minHeight: 80, resize: 'vertical' }}
            placeholder="이번 주는 하체 위주로. 무릎이 불편하면 레그프레스 발 위치를 높이세요."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Field label="언제까지 (선택)">
          <input
            className="input input--num"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
      </Card>

      <button
        type="button"
        className="btn btn--block"
        onClick={send}
        disabled={!picked || phase === 'sending'}
      >
        {phase === 'sending' ? '보내는 중…' : '숙제 보내기'}
      </button>

      <Note style={{ marginTop: 12 }}>
        <p className="small">
          보낸 루틴은 회원 소유의 사본이 됩니다. 원본을 고쳐도 이미 보낸 숙제는 바뀌지 않습니다.
        </p>
      </Note>
    </>
  );
}
