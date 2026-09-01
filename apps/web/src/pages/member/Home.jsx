import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Chip, Plate, km } from '../../ui/bits.jsx';
import LocationPicker from '../../ui/LocationPicker.jsx';
import GymMap from '../../ui/GymMap.jsx';
import { listNearbyGyms, myMembership, getGym, myPtRequests } from '../../lib/api.js';

/* 카닥식 홈: 지역 → PT 신청(역경매) / 헬스장 찾기 → 목록 */

export default function MemberHome() {
  const nav = useNavigate();
  const [gyms, setGyms] = useState(null);
  const [mine, setMine] = useState(undefined);
  const [myReqs, setMyReqs] = useState([]);
  const [sort, setSort] = useState('distance');
  const [view, setView] = useState('map');
  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState(null);

  const load = async (nextSort = sort, nextOrigin = origin) => {
    const [list, ms, reqs] = await Promise.all([
      listNearbyGyms({ sort: nextSort, lat: nextOrigin?.lat, lng: nextOrigin?.lng }),
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

  const changeSort = (next) => {
    setSort(next);
    load(next, origin);
  };

  const changeLocation = (next) => {
    setOrigin(next);
    load(sort, next);
  };

  const openReq = myReqs.find((r) => r.status === 'open');
  const daysLeft = mine
    ? Math.ceil((new Date(mine.ends_on) - new Date()) / 86400000)
    : null;
  const shownGyms = gyms?.filter((g) => `${g.name} ${g.dong ?? g.road_address ?? ''}`.includes(query.trim()))
    .sort((a, b) => Number(b.id === mine?.gym_id) - Number(a.id === mine?.gym_id)) ?? [];
  const machineCount = (g) => g.machines?.length ?? g.machine_count ?? 0;
  const minPrice = (g) => {
    if (g.min_month_price != null) return g.min_month_price;
    const values = (g.plans ?? []).filter((p) => p.kind === 'membership').map((p) => p.price);
    return values.length ? Math.min(...values) : null;
  };

  return (
    <>
      <p className="home-q">무엇을 도와드릴까요?</p>

      {mine && (
        <Card className="stack-y my-gym-card">
          <div className="row row--between">
            <p className="eyebrow">내 헬스장</p>
            <Chip kind="machine">이용 중</Chip>
          </div>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <h2 className="card__title" style={{ fontSize: 20 }}>{mine.gym.name}</h2>
              <p className="card__note">{mine.plan_name} · {mine.ends_on.replace(/-/g, '.')}까지</p>
            </div>
            <Plate value={daysLeft} unit="일 남음" />
          </div>
          <div className="row row--wrap">
            <Chip kind="machine">보유 기구 {mine.gym.machines.length}종</Chip>
            <Chip>{mine.gym.open}</Chip>
          </div>
          <button className="btn btn--block" type="button" onClick={() => nav('/workout')}>
            내 헬스장 · 루틴 보기
          </button>
        </Card>
      )}

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

      <div id="nearby-gyms" className="row row--between" style={{ margin: '18px 2px 8px' }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>{mine ? '다른 헬스장 찾아보기' : '주변 헬스장'}</p>
          <p className="tiny muted" style={{ margin: '5px 0 0' }}>가격·기구·트레이너를 한 번에 비교하세요</p>
        </div>
        <Link className="tiny" style={{ color: 'var(--volt)', fontWeight: 700 }} to="/pt">
          내 PT 신청 ›
        </Link>
      </div>

      <Card className="gym-finder">
        <div className="home-loc">
          <LocationPicker onChange={changeLocation} />
        </div>
        <label className="sr" htmlFor="gym-search">헬스장 검색</label>
        <input
          id="gym-search" className="input" type="search" placeholder="헬스장 이름이나 동네 검색"
          value={query} onChange={(e) => setQuery(e.target.value)}
        />
        <div className="finder-controls">
          <div className="seg" aria-label="정렬 방식">
            {[['distance', '거리순'], ['price', '가격순'], ['rating', '별점순']].map(([key, label]) => (
              <button key={key} className="seg__btn" aria-pressed={sort === key} onClick={() => changeSort(key)}>{label}</button>
            ))}
          </div>
          <div className="seg" aria-label="보기 방식">
            {[['map', '지도'], ['list', '목록']].map(([key, label]) => (
              <button key={key} className="seg__btn" aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>
            ))}
          </div>
        </div>
      </Card>

      {gyms && view === 'map' && <GymMap gyms={shownGyms} origin={origin} />}

      <Card flush className={view === 'map' ? 'gym-results--compact' : ''}>
        {!gyms && <p className="muted small" style={{ padding: 16 }}>불러오는 중…</p>}
        {gyms && shownGyms.length === 0 && <p className="muted small" style={{ padding: 16 }}>검색 결과가 없습니다.</p>}
        <ul className="list">
          {shownGyms.map((g, index) => (
            <li key={g.id}>
              <Link className="list__item" to={`/gym/${g.id}`}>
                <span className="result-rank">{index + 1}</span>
                <div className="list__body">
                  <div className="list__title">{g.name}</div>
                  <div className="list__meta">{g.dong ?? g.road_address} · 기구 {machineCount(g)}종 · {g.open ?? `★ ${g.rating_avg}`}</div>
                  <div className="row row--wrap" style={{ gap: 5, marginTop: 5 }}>
                    {g.id === mine?.gym_id && <Chip kind="machine">내 헬스장</Chip>}
                    {minPrice(g) != null && <Chip kind="sub">월 {Math.round(minPrice(g) / 10000)}만원부터</Chip>}
                    {g.rating_avg > 0 && <Chip>★ {g.rating_avg}</Chip>}
                  </div>
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
