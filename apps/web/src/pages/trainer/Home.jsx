import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, Card, Chip, Plate, Empty } from '../../ui/bits.jsx';
import { myClients } from '../../lib/api.js';

/* 트레이너의 첫 화면은 "오늘 누가 오는가"다. 회원 목록은 그 다음이다. */

export default function TrainerHome() {
  const [clients, setClients] = useState(null);
  useEffect(() => { myClients().then(setClients); }, []);

  const today = clients?.filter((c) => c.next) ?? [];
  const lowLeft = clients?.filter((c) => c.sessions_left <= 5) ?? [];

  return (
    <>
      <TopBar title="오늘" sub="서면 스트렝스짐" />

      <Card title="예정된 수업">
        {!clients && <p className="muted small">불러오는 중…</p>}
        {clients && today.length === 0 && <Empty title="예정된 수업이 없습니다" />}
        <ul className="list">
          {today.map((c) => (
            <li key={c.id}>
              <Link className="list__item" to={`/t/clients/${c.id}/send`}>
                <div className="list__body">
                  <div className="list__title">{c.name}</div>
                  <div className="list__meta mono">{c.next}</div>
                </div>
                <div className="list__right">{c.sessions_left}회 남음</div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {lowLeft.length > 0 && (
        <Card title="세션이 얼마 안 남은 회원" note="재등록 안내가 필요합니다">
          <div className="row row--wrap">
            {lowLeft.map((c) => (
              <Chip key={c.id} kind="sub">{c.name} · {c.sessions_left}회</Chip>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="row row--between">
          <div>
            <p className="eyebrow">담당 회원</p>
            <p className="card__note">전체 인원</p>
          </div>
          <Plate value={clients?.length ?? '—'} unit="명" />
        </div>
      </Card>
    </>
  );
}
