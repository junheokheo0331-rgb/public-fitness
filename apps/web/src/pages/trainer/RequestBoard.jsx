import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar, Card, Chip, Empty, won, km } from '../../ui/bits.jsx';
import LocationPicker from '../../ui/LocationPicker.jsx';
import { getCurrentArea, listOpenPtRequests } from '../../lib/api.js';

/* 트레이너용 — 지역 설정하면 근처 PT 신청이 카닥 목록처럼 뜬다. */

export default function RequestBoard() {
  const [area, setArea] = useState(null);
  const [rows, setRows] = useState(null);

  const load = async (a) => {
    setRows(null);
    const list = await listOpenPtRequests(a?.id);
    setRows(list);
  };

  useEffect(() => {
    getCurrentArea().then((a) => {
      setArea(a);
      load(a);
    });
  }, []);

  return (
    <>
      <TopBar title="PT 요청" sub="근처 회원이 올린 신청" />

      <Card>
        <p className="eyebrow">활동 지역</p>
        <LocationPicker
          onChange={(a) => {
            setArea(a);
            load(a);
          }}
        />
      </Card>

      <div className="row row--between" style={{ margin: '14px 2px 8px' }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          {area?.label ?? '지역'} · 열린 요청
        </p>
        <span className="tiny muted">가까운 순</span>
      </div>

      {!rows && <Card><p className="muted small">불러오는 중…</p></Card>}

      {rows?.length === 0 && (
        <Card>
          <Empty title="이 지역에 열린 요청이 없습니다">
            지역을 바꾸거나, 새 요청이 올라올 때까지 기다려 주세요.
          </Empty>
        </Card>
      )}

      <Card flush>
        <ul className="list">
          {rows?.map((r) => (
            <li key={r.id}>
              <Link className="list__item" to={`/t/requests/${r.id}`}>
                <div className="list__body">
                  <div className="list__title row" style={{ gap: 6 }}>
                    <span>{r.goal} · {r.sessions}회</span>
                    {r.already_applied && <Chip kind="sub">지원함</Chip>}
                    {r.apply_count > 0 && !r.already_applied && (
                      <Chip>경쟁 {r.apply_count}</Chip>
                    )}
                  </div>
                  <div className="list__meta">
                    {r.member_name} · {r.dong} · {r.schedule}
                    {r.budget_max ? ` · ${won(r.budget_max)}까지` : ''}
                  </div>
                </div>
                <div className="list__right">{km(r.distance_m)}</div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
