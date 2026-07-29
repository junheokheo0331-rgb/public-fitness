import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar, Card, Chip, Plate, Empty, km } from '../../ui/bits.jsx';
import { listNearbyGyms, myMembership, getGym } from '../../lib/api.js';

/* 첫 화면.

   다니는 헬스장이 있으면 그게 맨 위다. 앱을 여는 이유의 대부분은
   "오늘 뭐 하지"이지 "어디 등록하지"가 아니다.
   등록한 곳이 없을 때만 탐색이 주인공이 된다. */

export default function MemberHome() {
  const nav = useNavigate();
  const [gyms, setGyms] = useState(null);
  const [mine, setMine] = useState(undefined);   // undefined=로딩, null=없음

  useEffect(() => {
    let alive = true;
    (async () => {
      const [list, ms] = await Promise.all([listNearbyGyms(), myMembership()]);
      if (!alive) return;
      setGyms(list);
      if (!ms) { setMine(null); return; }
      const g = await getGym(ms.gym_id);
      if (alive) setMine({ ...ms, gym: g });
    })();
    return () => { alive = false; };
  }, []);

  const daysLeft = mine
    ? Math.ceil((new Date(mine.ends_on) - new Date()) / 86400000)
    : null;

  return (
    <>
      <TopBar title="어디서 운동하시나요" sub="부산 서면 기준" />

      {mine === undefined && <Card><p className="muted small">불러오는 중…</p></Card>}

      {mine && (
        <Card className="stack-y">
          <p className="eyebrow">다니는 곳</p>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <h2 className="card__title" style={{ fontSize: 19 }}>{mine.gym.name}</h2>
              <p className="card__note">{mine.plan_name} · {mine.ends_on.replace(/-/g, '.')}까지</p>
            </div>
            <Plate value={daysLeft} unit="일 남음" />
          </div>

          <div className="row row--wrap">
            <Chip kind="machine">보유 기구 {mine.gym.machines.length}종</Chip>
            <Chip>{mine.gym.open}</Chip>
          </div>

          <button className="btn btn--block" onClick={() => nav('/my')}>
            내 헬스장 들어가기
          </button>
        </Card>
      )}

      {mine === null && (
        <Card>
          <Empty title="아직 등록한 헬스장이 없습니다">
            아래에서 가까운 곳을 골라 보세요. 등록 전에도 그 헬스장 기구로
            어떤 루틴이 나오는지 미리 볼 수 있습니다.
          </Empty>
        </Card>
      )}

      <div className="row row--between" style={{ margin: '18px 2px 8px' }}>
        <p className="eyebrow" style={{ margin: 0 }}>주변 헬스장</p>
        <span className="tiny muted">가까운 순</span>
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

      <p className="tiny muted" style={{ padding: '0 4px' }}>
        지도로 보려면 위치 권한이 필요합니다. 목록만으로도 전부 이용할 수 있습니다.
      </p>
    </>
  );
}
