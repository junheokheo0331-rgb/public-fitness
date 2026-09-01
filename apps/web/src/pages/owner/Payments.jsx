import { useEffect, useMemo, useState } from 'react';
import { TopBar, Card, Chip, Empty, Note, won } from '../../ui/bits.jsx';
import { gymPaymentOrders } from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';

const STATUS = { paid: '결제 완료', pending: '결제 대기', failed: '실패', cancelled: '취소', refunded: '환불' };

export default function Payments() {
  const { session } = useSession();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!session.gymId) return undefined;
    let alive = true;
    gymPaymentOrders(session.gymId).then((rows) => alive && setOrders(rows)).catch((cause) => alive && setError(cause.message || '결제 내역을 불러오지 못했습니다.'));
    return () => { alive = false; };
  }, [session.gymId]);
  const rows = useMemo(() => (orders || []).filter((order) => (
    (filter === 'all' || order.status === filter)
    && `${order.member_name || ''} ${order.order_name || ''}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [orders, filter, query]);
  const paidTotal = (orders || []).filter((order) => order.status === 'paid').reduce((sum, order) => sum + Number(order.amount || 0), 0);

  if (!session.gymId) return <><TopBar title="결제 내역" back /><Card><Empty title="연결된 헬스장이 없습니다">사업장이 연결되면 결제 내역을 확인할 수 있습니다.</Empty></Card></>;
  return <>
    <TopBar title="결제 내역" sub={orders ? `완료 ${won(paidTotal)} · 전체 ${orders.length}건` : '불러오는 중…'} back />
    {error && <Note kind="stop"><p className="small">{error}</p></Note>}
    <Card flush>
      <div className="roster-tools">
        <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="회원·상품 검색" />
        <div className="seg">
          {[['all', '전체'], ['paid', '완료'], ['pending', '대기']].map(([value, label]) => <button key={value} type="button" className={`seg__btn ${filter === value ? 'is-on' : ''}`} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </div>
      {orders && !rows.length && <Empty title="표시할 결제 내역이 없습니다">회원이 앱에서 주문하면 상태와 금액이 여기에 기록됩니다.</Empty>}
      {!!rows.length && <ul className="list">{rows.map((order) => <li key={order.id} className="list__item" style={{ cursor: 'default' }}>
        <div className="list__body"><strong className="list__title">{order.member_name || '회원'} · {order.order_name}</strong><div className="list__meta">{new Date(order.created_at).toLocaleString('ko-KR')} · {order.provider === 'demo' ? '테스트 결제' : order.provider}</div></div>
        <div className="list__right"><strong>{won(order.amount)}</strong><div style={{ marginTop: 5 }}><Chip kind={order.status === 'paid' ? 'go' : undefined}>{STATUS[order.status] || order.status}</Chip></div></div>
      </li>)}</ul>}
    </Card>
    <p className="tiny muted">카드번호는 저장하지 않습니다. 운영 결제는 PG 승인 결과와 결제 식별자만 기록합니다.</p>
  </>;
}
