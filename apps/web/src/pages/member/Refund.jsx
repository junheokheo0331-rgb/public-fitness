import { useEffect, useState } from 'react';
import { calcRefund } from '@gymlink/core/refund';
import { TopBar, Card, Note, Plate, won } from '../../ui/bits.jsx';
import { myMembership, myPt, getGym } from '../../lib/api.js';

/* 해지하면 얼마 돌려받나.

   서울시 실내체육시설 피해구제의 73.8%가 헬스장이고, 대부분 해지·환불이다.
   그 분쟁의 뿌리는 "얼마 돌려받는지 아무도 모른다"는 것이다.
   결제를 안 받는 우리가 이걸 계산해서 보여주면, 결제를 받는 쪽보다
   오히려 소비자 편에 설 수 있다. */

export default function Refund() {
  const [d, setD] = useState(null);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [fault, setFault] = useState('consumer');

  useEffect(() => {
    (async () => {
      const ms = await myMembership();
      const [pt, gym] = await Promise.all([myPt(), ms ? getGym(ms.gym_id) : null]);
      setD({ ms, pt, gym });
    })();
  }, []);

  if (!d) return <><TopBar title="해지 시 환불액" back /><Card><p className="muted small">불러오는 중…</p></Card></>;
  if (!d.ms) return <><TopBar title="해지 시 환불액" back /><Card><p className="small">등록된 회원권이 없습니다.</p></Card></>;

  const mem = calcRefund({
    amount: d.ms.paid_amount, serviceFrom: d.ms.starts_on, serviceTo: d.ms.ends_on, asOf, fault,
  });
  const pt = d.pt && calcRefund({
    amount: d.pt.paid_amount, serviceFrom: d.ms.starts_on,
    totalSessions: d.pt.total_sessions, usedSessions: d.pt.used_sessions,
    listPrice: d.pt.list_price, asOf, fault,
  });

  return (
    <>
      <TopBar title="해지 시 환불액" sub={d.gym?.name} back />

      <Card>
        <div className="row row--wrap" style={{ gap: 8 }}>
          <button className={`btn btn--sm ${fault === 'consumer' ? '' : 'btn--ghost'}`} onClick={() => setFault('consumer')}>
            내 사정으로 해지
          </button>
          <button className={`btn btn--sm ${fault === 'business' ? '' : 'btn--ghost'}`} onClick={() => setFault('business')}>
            헬스장 사정 (폐업 등)
          </button>
        </div>
        <label className="field" style={{ marginTop: 12, marginBottom: 0 }}>
          <span className="field__label">해지일 기준</span>
          <input className="input input--num" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
      </Card>

      <Card title={d.ms.plan_name}>
        <div className="row row--between" style={{ alignItems: 'flex-start' }}>
          <div className="small muted">
            결제 {won(mem.total)}<br />
            이용 {mem.usedDays}일분 −{won(mem.usedAmount)}<br />
            위약금 {fault === 'business' ? '없음' : `10% −${won(mem.penalty)}`}
          </div>
          <Plate value={mem.refund.toLocaleString('ko-KR')} unit="원" />
        </div>
      </Card>

      {pt && (
        <Card title={`PT ${d.pt.total_sessions}회 · ${d.pt.used_sessions}회 사용`}>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div className="small muted">
              결제 {won(pt.total)}<br />
              사용 {pt.usedSessions}회 × {won(pt.unit)} −{won(pt.usedAmount)}<br />
              위약금 {fault === 'business' ? '없음' : `10% −${won(pt.penalty)}`}
            </div>
            <Plate value={pt.refund.toLocaleString('ko-KR')} unit="원" />
          </div>
          <Note kind="volt" title="여기가 다투어지는 지점입니다">
            <p className="small">
              회당 단가를 할인 전 정가({won(d.pt.list_price)} ÷ {d.pt.total_sessions}회 ={' '}
              {won(Math.round(d.pt.list_price / d.pt.total_sessions))})로 잡는 게 업계 관행이지만,
              결제액 기준으로 계산해야 한다는 주장도 있습니다.
              결제액 기준이면 환불액이 더 큽니다.
            </p>
          </Note>
        </Card>
      )}

      <Note title="근거">
        <p className="small">
          방문판매법 제31조 — 헬스장 회원권은 계속거래라 언제든 해지할 수 있습니다.<br />
          방문판매법 제32조 — 과다한 위약금은 청구할 수 없고, 이는 강행규정이라
          이에 어긋나는 약관은 효력이 없습니다.<br />
          소비자분쟁해결기준(체육시설업) — 이용일수를 뺀 뒤 총액의 10%를 공제합니다.
        </p>
        <p className="small" style={{ marginTop: 8 }}>
          참고용 계산입니다. 실제 금액은 계약 조건과 헬스장과의 협의에 따라 달라질 수 있습니다.
        </p>
      </Note>
    </>
  );
}
