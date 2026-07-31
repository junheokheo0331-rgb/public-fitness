import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar, Card, Chip, won } from '../../ui/bits.jsx';
import { myPtRequests } from '../../lib/api.js';

export default function PtRequestList() {
  const nav = useNavigate();
  const [rows, setRows] = useState(null);

  useEffect(() => { myPtRequests().then(setRows); }, []);

  return (
    <>
      <TopBar
        title="내 PT 신청"
        sub="제안서를 읽고 고르세요"
        right={
          <button type="button" className="btn btn--sm" onClick={() => nav('/pt/new')}>
            새 신청
          </button>
        }
      />

      {!rows && <Card><p className="muted small">불러오는 중…</p></Card>}

      {rows?.length === 0 && (
        <Card>
          <p className="card__title" style={{ marginBottom: 6 }}>아직 신청이 없어요</p>
          <p className="card__note" style={{ marginBottom: 14 }}>
            PT 받고 싶다고 올리면, 트레이너들이 제안서를 보냅니다.
          </p>
          <button className="btn btn--block" type="button" onClick={() => nav('/pt/new')}>
            PT 신청하기
          </button>
        </Card>
      )}

      {rows?.length > 0 && (
        <Card flush>
          <ul className="list">
            {rows.map((r) => (
              <li key={r.id}>
                <Link className="list__item" to={`/pt/${r.id}`}>
                  <div className="list__body">
                    <div className="list__title row" style={{ gap: 6 }}>
                      <span>{r.goal} · {r.sessions}회</span>
                      {r.status === 'matched' && <Chip kind="go">매칭됨</Chip>}
                      {r.status === 'open' && r.apply_count > 0 && (
                        <Chip kind="sub">제안 {r.apply_count}</Chip>
                      )}
                      {r.status === 'open' && r.apply_count === 0 && (
                        <Chip>대기중</Chip>
                      )}
                    </div>
                    <div className="list__meta">
                      {r.dong} · {won(r.budget_max)}까지 · {r.created.replace(/-/g, '.')}
                    </div>
                  </div>
                  <div className="list__right">›</div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
