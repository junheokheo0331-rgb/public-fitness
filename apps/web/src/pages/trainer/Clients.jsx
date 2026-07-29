import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, Card, Chip } from '../../ui/bits.jsx';
import { myClients } from '../../lib/api.js';

export default function Clients() {
  const [clients, setClients] = useState(null);
  useEffect(() => { myClients().then(setClients); }, []);

  return (
    <>
      <TopBar title="담당 회원" sub={clients ? `${clients.length}명` : ''} />
      <Card flush>
        {!clients && <p className="muted small" style={{ padding: 16 }}>불러오는 중…</p>}
        <ul className="list">
          {clients?.map((c) => (
            <li key={c.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-2)' }}>
              <div className="row row--between">
                <div className="grow">
                  <div className="list__title">{c.name}</div>
                  <div className="list__meta">
                    PT {c.sessions_left}회 남음 ·{' '}
                    {c.last_body ? `최근 측정 ${c.last_body.replace(/-/g, '.')}` : '측정 기록 없음'}
                  </div>
                </div>
                {!c.consent_proxy && <Chip kind="sub">대리입력 불가</Chip>}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <Link className="btn btn--sm grow" to={`/t/clients/${c.id}/send`}>루틴 보내기</Link>
                <Link className="btn btn--sm btn--ghost grow" to={`/t/clients/${c.id}/body`}>측정 입력</Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <p className="tiny muted" style={{ padding: '0 4px' }}>
        회원이 대리입력에 동의하지 않았으면 측정 결과를 대신 넣을 수 없습니다.
        회원 본인이 직접 입력하도록 안내해주세요.
      </p>
    </>
  );
}
