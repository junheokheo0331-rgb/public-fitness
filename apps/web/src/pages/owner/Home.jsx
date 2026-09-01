import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, Card, Chip, Empty, Note, Plate, Gauge, won } from '../../ui/bits.jsx';
import { gymRoster, gymMachineInventory, gymPhotos, getGym } from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';

/* 관장 현황.

   관장이 매일 확인하고 싶은 건 두 가지다: 이번 달에 몇 명이 만료되는가,
   그리고 내 헬스장이 검색에서 어떻게 보이는가.
   나머지는 필요할 때 들어가서 본다. */

export default function OwnerHome() {
  const { session } = useSession();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!session.gymId) { setD(null); return undefined; }
    let alive = true;
    (async () => {
      try {
        const [roster, machines, photos, gym] = await Promise.all([
          gymRoster(session.gymId), gymMachineInventory(session.gymId), gymPhotos(session.gymId), getGym(session.gymId),
        ]);
        if (alive) setD({ roster, machines, photos, gym });
      } catch (cause) {
        if (alive) setError(cause.message || '운영 정보를 불러오지 못했습니다.');
      }
    })();
    return () => { alive = false; };
  }, [session.gymId]);

  if (!session.gymId) return <><TopBar title="현황" sub="관장 콘솔" /><Card><Empty title="연결된 헬스장이 없습니다">본사에서 사업장 확인을 마치면 머신·가격표·회원 관리가 열립니다.</Empty></Card></>;
  if (error) return <><TopBar title="현황" sub="관장 콘솔" /><Note kind="stop"><p className="small">{error}</p></Note></>;

  if (!d) return <><TopBar title="현황" /><Card><p className="muted small">불러오는 중…</p></Card></>;

  const active = d.roster.filter((m) => m.active);
  const soon = active.filter((m) => {
    const left = Math.ceil((new Date(m.ends) - new Date()) / 86400000);
    return left <= 30 && left >= 0;
  });
  const completedFields = d.machines.reduce((sum, machine) => sum
    + Number(Boolean(machine.brand))
    + Number(Boolean(machine.model_name))
    + Number(d.photos.some((photo) => photo.machine_code === machine.code)), 0);
  const profileScore = d.machines.length ? Math.round((completedFields / (d.machines.length * 3)) * 100) : 0;

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

      <Card title="머신 정보 완성도" note="브랜드·모델·사진을 채우면 회원이 비교하기 쉬워집니다">
        <div className="row row--between tiny muted" style={{ marginBottom: 5 }}>
          <span>등록 머신 {d.machines.length}개</span>
          <span className="mono">{profileScore}%</span>
        </div>
        <Gauge value={profileScore} good={profileScore >= 70} />
        {profileScore < 70 && (
          <Note kind="volt" title="설치된 머신을 실제 모습 그대로 보여주세요">
            <p className="small">
              제조사와 모델명, 실제 사진을 채우면 회원이 지도에서 헬스장을 비교할 때 더 정확한 정보를 볼 수 있습니다.
            </p>
          </Note>
        )}
        <Link className="btn btn--ghost btn--block btn--sm" to="/o/machines" style={{ marginTop: 10 }}>
          머신 정보 관리
        </Link>
      </Card>

      <Card>
        <div className="row row--between" style={{ alignItems: 'center' }}>
          <div>
            <p className="eyebrow">우리 헬스장 루틴</p>
            <p className="card__title" style={{ fontSize: 16 }}>직접 만들어 회원에게 공개</p>
            <p className="card__note">운동·세트·반복·휴식을 세부 편집</p>
          </div>
          <Link className="btn btn--sm" to="/o/recommend">루틴 만들기</Link>
        </div>
      </Card>

      <Card title="가격표" note="회원이 지도 상세에서 확인하는 공개 가격">
        <ul className="list">
          {d.gym.plans.map((p) => (
            <li key={p.id} className="list__item" style={{ cursor: 'default' }}>
              <div className="list__body">
                <div className="list__title">{p.name}</div>
                <div className="list__meta">
                  {p.kind === 'pt' ? `PT ${p.sessions}회` : p.kind === 'daily' ? `${p.valid_days || 1}일 이용` : p.months ? `${p.months}개월` : '부가 상품'}
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
        <Link className="btn btn--ghost btn--block btn--sm" to="/o/prices" style={{ marginTop: 10 }}>
          가격표 추가·수정
        </Link>
      </Card>
    </>
  );
}
