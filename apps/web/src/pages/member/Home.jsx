import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Chip, Plate, km } from '../../ui/bits.jsx';
import LocationPicker from '../../ui/LocationPicker.jsx';
import { listNearbyGyms, myMembership, getGym, myPtRequests } from '../../lib/api.js';

/* 카닥식 홈: 지역 → PT 신청(역경매) / 헬스장 찾기 → 목록 */

export default function MemberHome() {
  const nav = useNavigate();
  const [gyms, setGyms] = useState(null);
  const [mine, setMine] = useState(undefined);
  const [myReqs, setMyReqs] = useState([]);

  const load = async () => {
    const [list, ms, reqs] = await Promise.all([
      listNearbyGyms(),
      myMembership(),
      myPtRequests(),
    ]);
    setGyms(list);
    setMyReqs(reqs);
    if (!ms) { setMine(null); return; }
    const g = await getGym(ms.gym_id);
    setMine({ ...ms, gym: g });
  };

  useEffect(() => { load(); }, []);

  const openReq = myReqs.find((r) => r.status === 'open');
  const daysLeft = mine
    ? Math.ceil((new Date(mine.ends_on) - new Date()) / 86400000)
    : null;

  return (
    <>
      <div className="home-loc">
        <LocationPicker onChange={() => load()} />
      </div>

      <p className="home-q">무엇을 도와드릴까요?</p>

      <div className="svc">
        <button type="button" className="svc__card" onClick={() => nav('/book')}>
          <span className="svc__badge">예약</span>
          <strong className="svc__title">PT 예약</strong>
          <span className="svc__desc">캘린더에서<br />시간 고르기</span>
          <span className="svc__art" aria-hidden="true">BOOK</span>
        </button>
        <button type="button" className="svc__card" onClick={() => nav('/pt/new')}>
          <span className="svc__badge svc__badge--sky">신청</span>
          <strong className="svc__title">PT 신청</strong>
          <span className="svc__desc">올리면 트레이너가<br />제안서를 보내요</span>
          <span className="svc__art svc__art--dim" aria-hidden="true">ASK</span>
        </button>
      </div>

      {openReq ? (
        <button type="button" className="promo" onClick={() => nav(`/pt/${openReq.id}`)}>
          <div className="grow">
            <p className="promo__eyebrow">진행 중</p>
            <p className="promo__title">
              {openReq.goal} {openReq.sessions}회 · 제안 {openReq.apply_count}건
            </p>
            <p className="promo__sub">제안서를 읽고 트레이너를 고르세요</p>
          </div>
          <span className="promo__go" aria-hidden="true">›</span>
        </button>
      ) : (
        <button type="button" className="promo" onClick={() => nav('/pt/new')}>
          <div className="grow">
            <p className="promo__eyebrow">역경매</p>
            <p className="promo__title">PT 신청 올리고 제안 받기</p>
            <p className="promo__sub">내가 고르는 PT · 트레이너가 이력서를 보냅니다</p>
          </div>
          <span className="promo__go" aria-hidden="true">›</span>
        </button>
      )}

      {mine && (
        <Card className="stack-y">
          <p className="eyebrow">다니는 곳</p>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <h2 className="card__title" style={{ fontSize: 18 }}>{mine.gym.name}</h2>
              <p className="card__note">{mine.plan_name} · {mine.ends_on.replace(/-/g, '.')}까지</p>
            </div>
            <Plate value={daysLeft} unit="일 남음" />
          </div>
          <div className="row row--wrap">
            <Chip kind="machine">보유 기구 {mine.gym.machines.length}종</Chip>
            <Chip>{mine.gym.open}</Chip>
          </div>
          <button className="btn btn--block" type="button" onClick={() => nav('/my')}>
            내 헬스장 들어가기
          </button>
        </Card>
      )}

      <div id="nearby-gyms" className="row row--between" style={{ margin: '18px 2px 8px' }}>
        <p className="eyebrow" style={{ margin: 0 }}>주변 헬스장</p>
        <Link className="tiny" style={{ color: 'var(--volt)', fontWeight: 700 }} to="/pt">
          내 PT 신청 ›
        </Link>
      </div>

      <Card flush>
        {!gyms && <p className="muted small" style={{ padding: 16 }}>불러오는 중…</p>}
        <ul className="list">
          {gyms?.map((g) => (
            <li key={g.id}>
              <Link className="list__item" to={`/gym/${g.id}`}>
                <div className="list__body">
                  <div className="list__title">{g.name}</div>
                  <div className="list__meta">{g.dong} · 기구 {g.machines.length}종 · {g.open}</div>
                </div>
                <div className="list__right">{km(g.distance_m)}</div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
