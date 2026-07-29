import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar, Card, Chip, Note, Field, Empty } from '../../ui/bits.jsx';
import { myClients, trainerRoutines, assignRoutine } from '../../lib/api.js';

/* 루틴 송출 — 트레이너가 회원에게 숙제를 보낸다.

   "공유"가 아니라 "복사"다. 트레이너가 나중에 자기 루틴을 고쳐도
   회원이 받은 것은 그대로 남아야 한다. PT 기록의 성격이 있어서
   나중에 "그때 뭘 시켰는지"가 남아야 하기 때문이다.

   담당 회원인지는 화면이 아니라 서버(assign_routine RPC)가 판정한다. */

export default function SendRoutine() {
  const { memberId } = useParams();
  const nav = useNavigate();

  const [client, setClient] = useState(undefined);
  const [routines, setRoutines] = useState(null);
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [phase, setPhase] = useState('idle');   // idle | sending | done
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [cs, rs] = await Promise.all([myClients(), trainerRoutines()]);
      setClient(cs.find((c) => c.id === memberId) ?? null);
      setRoutines(rs);
    })();
  }, [memberId]);

  if (client === undefined || !routines) {
    return <><TopBar title="루틴 보내기" back /><Card><p className="muted small">불러오는 중…</p></Card></>;
  }
  if (!client) {
    return <><TopBar title="루틴 보내기" back /><Card><Empty title="담당 회원이 아닙니다" /></Card></>;
  }

  async function send() {
    setPhase('sending');
    setError(null);
    try {
      await assignRoutine({
        memberId, routineId: picked,
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
        <TopBar title="보냈습니다" back />
        <Note kind="go" title={`${client.name} 회원에게 전달됐습니다`}>
          <p className="small">
            &lsquo;{r?.title}&rsquo; 이(가) 회원 앱의 내 헬스장 &gt; 저장된 루틴에 바로 보입니다.
          </p>
          <p className="small" style={{ marginTop: 6 }}>
            회원 소유의 사본으로 갔습니다. 트레이너님이 원본을 고쳐도 보낸 것은
            그대로 남습니다.
          </p>
        </Note>
        <button className="btn btn--block" onClick={() => nav('/t/clients')}>담당 회원으로</button>
      </>
    );
  }

  return (
    <>
      <TopBar title={client.name} sub="루틴 보내기" back />

      {error && <Note kind="stop"><p className="small">{error}</p></Note>}

      <Card title="어떤 루틴을 보낼까요" flush>
        {routines.length === 0 ? (
          <Empty title="만들어 둔 루틴이 없습니다">
            회원 헬스장의 보유 기구로 먼저 루틴을 만들어보세요.
          </Empty>
        ) : (
          <ul className="list">
            {routines.map((r) => (
              <li key={r.id}>
                <button
                  className="list__item"
                  style={{ width: '100%' }}
                  aria-pressed={picked === r.id}
                  onClick={() => setPicked(r.id)}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 20, height: 20, flex: 'none', borderRadius: 999,
                      border: `1px solid ${picked === r.id ? 'var(--ink)' : 'var(--line)'}`,
                      background: picked === r.id ? 'var(--ink)' : '#fff',
                    }}
                  />
                  <span className="list__body">
                    <span className="list__title">{r.title}</span>
                    <span className="list__meta">
                      주 {r.days}회 · {r.updated.replace(/-/g, '.')} 수정
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="회원에게 남길 말">
        <Field label="알림장" hint="운동 중 주의할 점이나 이번 주 목표를 적어주세요.">
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
          <input className="input input--num" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </Card>

      <button className="btn btn--block" onClick={send} disabled={!picked || phase === 'sending'}>
        {phase === 'sending' ? '보내는 중…' : '보내기'}
      </button>

      <Note style={{ marginTop: 12 }}>
        <p className="small">
          보낸 루틴은 회원 소유의 사본이 됩니다. 회원이 직접 고칠 수 있고,
          트레이너님이 원본을 수정해도 이미 보낸 것은 바뀌지 않습니다.
        </p>
      </Note>
    </>
  );
}
