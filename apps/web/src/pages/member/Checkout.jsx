import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, Note, TopBar, won } from '../../ui/bits.jsx';
import { completeDemoPayment, createPaymentOrder, getPricePlan, sb } from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';

export default function Checkout() {
  const { planId } = useParams();
  const nav = useNavigate();
  const { session } = useSession();
  const [plan, setPlan] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);
  useEffect(() => { getPricePlan(planId).then(setPlan).catch((e) => setMessage(e.message)); }, [planId]);

  if (!plan) return <><TopBar title="결제" back /><Card><p className="small muted">{message || '상품을 불러오는 중…'}</p></Card></>;
  const duration = plan.kind === 'pt' ? `${plan.sessions}회` : plan.kind === 'daily' ? `${plan.valid_days || 1}일 이용권` : plan.months ? `${plan.months}개월` : '이용권';

  const pay = async () => {
    if (!agreed) return;
    setBusy(true); setMessage('');
    try {
      const order = await createPaymentOrder(plan);
      if (!sb) {
        await completeDemoPayment(order.id);
        setMessage('테스트 결제가 완료되었습니다.');
        setTimeout(() => nav(plan.kind === 'daily' ? '/my' : '/me'), 900);
      } else {
        setPendingOrder(order);
        setMessage(session.email?.endsWith('@gymlink.test')
          ? '주문이 생성되었습니다. 아래에서 테스트 결제를 완료하세요.'
          : '주문이 생성되었습니다. 실제 운영 전 PG 결제창을 연결해야 합니다.');
      }
    } catch (error) { setMessage(error.message || '결제를 시작하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const finishDemoPayment = async () => {
    if (!pendingOrder || !session.email?.endsWith('@gymlink.test')) return;
    setBusy(true); setMessage('');
    try {
      await completeDemoPayment(pendingOrder.id);
      setPendingOrder(null);
      setMessage('테스트 결제가 완료되어 회원권에 반영되었습니다.');
      setTimeout(() => nav(plan.kind === 'daily' ? '/my' : '/me'), 1000);
    } catch (error) { setMessage(error.message || '테스트 결제를 완료하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  return <>
    <TopBar title="결제 확인" sub={plan.gym_name} back />
    {message && <Note kind={message.includes('못') ? 'stop' : 'go'}><p className="small">{message}</p></Note>}
    <Card title={plan.name} note={duration}>
      <div className="checkout-total"><span>결제 금액</span><strong>{won(plan.price)}</strong></div>
      {plan.list_price > plan.price && <p className="tiny muted">정가 {won(plan.list_price)} · 할인 {won(plan.list_price - plan.price)}</p>}
      {plan.terms && <Note title="이용·환불 조건"><p className="small">{plan.terms}</p></Note>}
    </Card>
    <Card title="결제 전 확인">
      <label className="check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>상품 정보, 이용 조건과 환불 기준을 확인했습니다.</span></label>
      <p className="tiny muted" style={{ marginTop: 10 }}>카드 정보는 GymLink가 저장하지 않으며 실제 운영 결제는 PG 결제창에서 처리됩니다.</p>
    </Card>
    {!pendingOrder && <button className="btn btn--block" disabled={!agreed || busy} onClick={pay}>{busy ? '처리 중…' : `${won(plan.price)} 결제하기`}</button>}
    {pendingOrder && session.email?.endsWith('@gymlink.test') && (
      <button className="btn btn--block" disabled={busy} onClick={finishDemoPayment}>{busy ? '처리 중…' : '테스트 결제 완료'}</button>
    )}
    <Link className="btn btn--ghost btn--block" style={{ marginTop: 8 }} to={`/gym/${plan.gym_id}`}>상품 다시 보기</Link>
  </>;
}
