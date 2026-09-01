import { useEffect, useMemo, useState } from 'react';
import { TopBar, Card, Chip, Empty, Field, Note, won } from '../../ui/bits.jsx';
import { gymPricePlans, removeGymPricePlan, saveGymPricePlan } from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';
import { Link } from 'react-router-dom';

const KINDS = [
  ['membership', '회원권'], ['pt', 'PT'], ['daily', '일일권'], ['locker', '락커'], ['rental', '대여'],
];
const blank = () => ({ kind: 'membership', name: '', months: 1, sessions: '', valid_days: 1, valid_hours: 24, reentry_allowed: false, price: '', list_price: '', terms: '', is_active: true });

export default function Prices() {
  const { session } = useSession();
  const [plans, setPlans] = useState(null);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!session.gymId) return;
    try { setPlans(await gymPricePlans(session.gymId)); }
    catch (error) { setMessage(error.message || '가격표를 불러오지 못했습니다.'); }
  };
  useEffect(() => { load(); }, [session.gymId]);
  const active = useMemo(() => plans?.filter((p) => p.is_active !== false).length ?? 0, [plans]);

  const edit = (plan) => { setForm({ ...blank(), ...plan }); setEditing(true); setMessage(''); };
  const start = () => { setForm(blank()); setEditing(true); setMessage(''); };
  const cancel = () => { setEditing(false); setForm(blank()); };

  const save = async () => {
    setBusy(true); setMessage('');
    try {
      await saveGymPricePlan(session.gymId, form);
      await load(); cancel(); setMessage('가격표에 반영했습니다. 회원에게 즉시 공개됩니다.');
    } catch (error) { setMessage(error.message || '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const remove = async (plan) => {
    if (!confirm(`「${plan.name}」을 가격표에서 삭제할까요?`)) return;
    setBusy(true);
    try { await removeGymPricePlan(session.gymId, plan.id); await load(); }
    catch (error) { setMessage(error.message || '삭제하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  if (!session.gymId) return <><TopBar title="가격표 관리" back /><Card><Empty title="연결된 헬스장이 없습니다">사업장이 연결되면 회원권·PT·일일권 가격을 등록할 수 있습니다.</Empty></Card></>;
  return <>
    <TopBar title="가격표 관리" sub={plans ? `판매 중 ${active}개 · 전체 ${plans.length}개` : '불러오는 중'} back right={!editing && <div className="row"><Link className="btn btn--sm btn--ghost" to="/o/payments">결제 내역</Link><button className="btn btn--sm" onClick={start}>상품 추가</button></div>} />
    {message && <Note kind={message.includes('못') ? 'stop' : 'go'}><p className="small">{message}</p></Note>}

    {editing && <Card title={form.id ? '가격 수정' : '새 상품 등록'} note="판매가와 정가를 모두 공개해 환불·할인 기준을 명확히 합니다">
      <Field label="상품 종류"><select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="상품명"><input className="input" placeholder="예: 3개월 회원권" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      {form.kind === 'membership' && <Field label="이용 기간"><div className="input-affix"><input className="input" type="number" min="1" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} /><span>개월</span></div></Field>}
      {form.kind === 'pt' && <Field label="PT 횟수"><div className="input-affix"><input className="input" type="number" min="1" value={form.sessions} onChange={(e) => setForm({ ...form, sessions: e.target.value })} /><span>회</span></div></Field>}
      {form.kind === 'daily' && <>
        <div className="rowfields">
          <Field label="사용 가능 일수"><div className="input-affix"><input className="input" type="number" min="1" value={form.valid_days || 1} onChange={(e) => setForm({ ...form, valid_days: e.target.value })} /><span>일</span></div></Field>
          <Field label="입장 후 유효시간"><div className="input-affix"><input className="input" type="number" min="1" max="48" value={form.valid_hours || 24} onChange={(e) => setForm({ ...form, valid_hours: e.target.value })} /><span>시간</span></div></Field>
        </div>
        <label className="check"><input type="checkbox" checked={Boolean(form.reentry_allowed)} onChange={(e) => setForm({ ...form, reentry_allowed: e.target.checked })} /><span>유효기간 안에 재입장 허용</span></label>
      </>}
      <div className="rowfields">
        <Field label="판매가"><input className="input" type="number" min="0" step="1000" placeholder="240000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
        <Field label="정가"><input className="input" type="number" min="0" step="1000" placeholder="270000" value={form.list_price} onChange={(e) => setForm({ ...form, list_price: e.target.value })} /></Field>
      </div>
      <Field label="이용 조건·환불 안내" hint="회원이 결제 전에 보는 상품별 안내입니다."><textarea className="input" rows="4" placeholder="이용 시작일, 휴회, 양도, 환불 조건을 적어주세요." value={form.terms || ''} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></Field>
      <label className="check"><input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><span>회원에게 판매 중으로 공개</span></label>
      <div className="row" style={{ marginTop: 14 }}><button className="btn grow" disabled={busy} onClick={save}>{busy ? '저장 중…' : '가격표 저장'}</button><button className="btn btn--ghost" onClick={cancel}>취소</button></div>
    </Card>}

    {!editing && plans?.length === 0 && <Card><Empty title="등록된 가격표가 없습니다" action={<button className="btn btn--sm" onClick={start}>첫 상품 등록</button>}>회원권이나 PT 상품을 등록하면 지도 상세 화면에 공개됩니다.</Empty></Card>}
    {!editing && plans?.length > 0 && <Card title="등록 상품" note="숨김 상품은 기존 회원 기록을 보존하면서 신규 판매만 중단합니다" flush><ul className="list">{plans.map((plan) => <li key={plan.id} className="list__item" style={{ cursor: 'default' }}>
      <div className="list__body"><div className="row row--wrap" style={{ gap: 6 }}><span className="list__title">{plan.name}</span><Chip kind={plan.is_active === false ? 'sub' : 'machine'}>{plan.is_active === false ? '숨김' : '판매 중'}</Chip></div><div className="list__meta">{KINDS.find(([k]) => k === plan.kind)?.[1]}{plan.months ? ` · ${plan.months}개월` : ''}{plan.sessions ? ` · ${plan.sessions}회` : ''}{plan.kind === 'daily' ? ` · ${plan.valid_days || 1}일 · ${plan.metadata?.reentry_allowed ? '재입장 가능' : '1회 입장'}` : ''}{plan.list_price > plan.price ? ` · 정가 ${won(plan.list_price)}` : ''}</div></div>
      <div className="list__right"><strong>{won(plan.price)}</strong><div className="row" style={{ gap: 5, marginTop: 6 }}><button className="btn btn--sm btn--ghost" onClick={() => edit(plan)}>수정</button><button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => remove(plan)}>삭제</button></div></div>
    </li>)}</ul></Card>}
  </>;
}
