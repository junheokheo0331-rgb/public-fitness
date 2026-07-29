import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, Card, Chip, Note, Plate, Gauge, won } from '../../ui/bits.jsx';
import { gymRoster, gymMachines, getGym, machineCatalog } from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';

/* 관장 현황.

   관장이 매일 확인하고 싶은 건 두 가지다: 이번 달에 몇 명이 만료되는가,
   그리고 내 헬스장이 검색에서 어떻게 보이는가.
   나머지는 필요할 때 들어가서 본다. */

export default function OwnerHome() {
  const { session } = useSession();
  const [d, setD] = useState(null);
  const catalog = machineCatalog();

  useEffect(() => {
    (async () => {
      const [roster, machines, gym] = await Promise.all([
        gymRoster(session.gymId), gymMachines(session.gymId), getGym(session.gymId),
      ]);
      setD({ roster, machines, gym });
    })();
  }, [session.gymId]);

  if (!d) return <><TopBar title="현황" /><Card><p className="muted small">불러오는 중…</p></Card></>;

  const active = d.roster.filter((m) => m.active);
  const soon = active.filter((m) => {
    const left = Math.ceil((new Date(m.ends) - new Date()) / 86400000);
    return left <= 30 && left >= 0;
  });
  const coverage = Math.round((d.machines.length / catalog.length) * 100);

  return (
    <>
      <TopBar title={d.gym.name} sub="관장 콘솔" />

      <div className="cols2">
        <Card>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div>
              <p className="eyebrow">유효 회원</p>
              <p className="card__note">현재 이용 중</p>
            </div>
            <Plate value={active.length} unit="명" />
          </div>
        </Card>

        <Card>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div>
              <p className="eyebrow">30일 내 만료</p>
              <p className="card__note">재등록 안내 대상</p>
            </div>
            <Plate value={soon.length} unit="명" ghost />
          </div>
        </Card>
      </div>

      {soon.length > 0 && (
        <Card title="곧 만료되는 회원" flush>
          <ul className="list">
            {soon.map((m) => (
              <li key={m.id} className="list__item" style={{ cursor: 'default' }}>
                <div className="list__body">
                  <div className="list__title">{m.name}</div>
                  <div className="list__meta">{m.plan}</div>
                </div>
                <div className="list__right">{m.ends.replace(/-/g, '.')}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="검색 노출" note="회원이 기구로 헬스장을 찾을 때">
        <div className="row row--between tiny muted" style={{ marginBottom: 5 }}>
          <span>등록된 기구 {d.machines.length} / {catalog.length}종</span>
          <span className="mono">{coverage}%</span>
        </div>
        <Gauge value={coverage} good={coverage >= 70} />
        {coverage < 70 && (
          <Note kind="volt" title="등록되지 않은 기구가 있으면 검색에서 빠집니다">
            <p className="small">
              회원이 &lsquo;레그컬 있는 곳&rsquo;으로 찾을 때, 실제로 있어도 등록이 안 되어 있으면
              결과에 나오지 않습니다.
            </p>
          </Note>
        )}
        <Link className="btn btn--ghost btn--block btn--sm" to="/o/machines" style={{ marginTop: 10 }}>
          보유 기구 관리
        </Link>
      </Card>

      <Card title="가격표" note="앱에서는 안내만 하고 결제는 현장에서 받습니다">
        <ul className="list">
          {d.gym.plans.map((p) => (
            <li key={p.id} className="list__item" style={{ cursor: 'default' }}>
              <div className="list__body">
                <div className="list__title">{p.name}</div>
                <div className="list__meta">
                  {p.kind === 'pt' ? `PT ${p.sessions}회` : `${p.months}개월`}
                </div>
              </div>
              <div className="list__right mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                {won(p.price)}
              </div>
            </li>
          ))}
        </ul>
        <Note>
          <p className="small">
            정가를 함께 등록해주세요. PT 중도 해지 시 회당 단가 계산의 기준이 되고,
            분쟁이 생겼을 때 근거가 됩니다.
          </p>
        </Note>
      </Card>
    </>
  );
}
