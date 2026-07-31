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
            <li key={c.id}>
              <Link className="list__item" to={`/t/clients/${c.id}`}>
                <div className="list__body">
                  <div className="list__title">{c.name}</div>
                  <div className="list__meta">
                    PT {c.sessions_left}회 남음 ·{' '}
                    {c.last_body ? `최근 측정 ${c.last_body.replace(/-/g, '.')}` : '측정 기록 없음'}
                    {c.next ? ` · 다음 ${c.next}` : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {!c.consent_proxy && <Chip kind="sub">대리입력 불가</Chip>}
                  <span className="list__right">›</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <p className="tiny muted" style={{ padding: '0 4px' }}>
        회원을 누르면 루틴 보관함·숙제·측정을 관리할 수 있습니다.
      </p>
    </>
  );
}
