import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar, Card, Chip, Note, Plate, Stack, Empty } from '../../ui/bits.jsx';
import { myMembership, myPt, getGym, mySavedRoutines } from '../../lib/api.js';

/* 내 헬스장 — 앱에서 제일 자주 열릴 화면.

   여기 들어오는 이유는 셋 중 하나다.
     1. 오늘 뭐 하지          → 저장된 루틴
     2. PT 몇 회 남았지        → 잔여 세션
     3. 이 헬스장이 뭘 해주지  → 제공 항목
   그래서 이 순서로 놓았다. */

const OFFER_LINK = {
  routine: '/my',
  template: '/my',
  body: '/body',
  refund: '/refund',
};

export default function MyGym() {
  const nav = useNavigate();
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ms = await myMembership();
      if (!ms) { if (alive) setState({ none: true }); return; }
      const [gym, pt, routines] = await Promise.all([
        getGym(ms.gym_id), myPt(), mySavedRoutines(ms.gym_id),
      ]);
      if (alive) setState({ ms, gym, pt, routines });
    })();
    return () => { alive = false; };
  }, []);

  if (!state) return <><TopBar title="내 헬스장" /><Card><p className="muted small">불러오는 중…</p></Card></>;

  if (state.none) {
    return (
      <>
        <TopBar title="내 헬스장" />
        <Card>
          <Empty
            title="다니는 헬스장이 없습니다"
            action={<button className="btn" onClick={() => nav('/')}>주변 헬스장 보기</button>}
          >
            헬스장에서 등록하면 관장님이 회원 정보를 넣어주고, 여기에 나타납니다.
          </Empty>
        </Card>
      </>
    );
  }

  const { ms, gym, pt, routines } = state;
  const ptLeft = pt ? pt.total_sessions - pt.used_sessions : 0;

  return (
    <>
      <TopBar title={gym.name} sub={`${ms.plan_name} · ${ms.ends_on.replace(/-/g, '.')}까지`} />

      {/* 1. 오늘 뭐 하지 */}
      <Card title="저장된 루틴" note={`${gym.name} 기구 기준`}>
        {routines.length === 0 ? (
          <Empty title="아직 루틴이 없습니다">
            보유 기구로 자동으로 짜 드릴 수 있습니다.
          </Empty>
        ) : (
          <ul className="list">
            {routines.map((r) => (
              <li key={r.id}>
                <Link className="list__item" to={`/my/routine/${r.id}`}>
                  <div className="list__body">
                    <div className="row row--wrap" style={{ gap: 6 }}>
                      <span className="list__title">{r.title}</span>
                      {r.origin === 'trainer' && <Chip kind="sub">트레이너</Chip>}
                      {r.origin === 'owner' && <Chip>관장님 추천</Chip>}
                    </div>
                    <div className="list__meta">
                      주 {r.days}회 · {r.updated.replace(/-/g, '.')} 수정
                    </div>
                  </div>
                  <div className="list__right">→</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <button className="btn btn--ghost btn--block btn--sm" style={{ marginTop: 12 }}>
          보유 기구로 새 루틴 짜기
        </button>
      </Card>

      {/* 2. PT 몇 회 남았지 */}
      {pt && (
        <Card>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div>
              <p className="eyebrow">PT</p>
              <p className="card__note">{pt.trainer_name} 트레이너</p>
              <Stack total={pt.total_sessions} done={pt.used_sessions} current={pt.used_sessions} />
            </div>
            <Plate value={ptLeft} unit="회 남음" />
          </div>
        </Card>
      )}

      {/* 3. 이 헬스장이 뭘 해주지 */}
      <Card title="이 헬스장에서 쓸 수 있는 것" flush>
        <ul className="list">
          {gym.offers.map((o) => (
            <li key={o.key}>
              <Link className="list__item" to={OFFER_LINK[o.key] ?? '/my'}>
                <div className="list__body">
                  <div className="list__title">{o.title}</div>
                  <div className="list__meta">{o.desc}</div>
                </div>
                <div className="list__right">→</div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="row row--wrap" style={{ padding: '0 4px 8px' }}>
        <Chip kind="machine">보유 기구 {gym.machines.length}종</Chip>
        <Chip>{gym.open}</Chip>
        <Chip>회원 {gym.members}명</Chip>
      </div>

      <Note>
        <p className="small">
          기구가 바뀌면 관장님이 등록해주고, 루틴도 따라서 바뀝니다.
          없어진 기구가 루틴에 남아 있으면 알려드립니다.
        </p>
      </Note>
    </>
  );
}
