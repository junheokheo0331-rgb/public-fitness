import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TopBar, Card, Chip, Plate, Empty, Note } from '../../ui/bits.jsx';
import {
  myClients, trainerRoutines, memberHomework, bodyLog,
} from '../../lib/api.js';

const GOAL_LABEL = {
  hypertrophy: '근비대', fatloss: '감량', strength: '스트렝스', conditioning: '컨디션',
};

/* 회원 누르면: 보낸 숙제 + 내 루틴 보관함 → 여기서 숙제 내기 */

export default function ClientDetail() {
  const { memberId } = useParams();
  const nav = useNavigate();
  const [client, setClient] = useState(undefined);
  const [routines, setRoutines] = useState(null);
  const [homework, setHomework] = useState(null);
  const [lastBody, setLastBody] = useState(null);
  const [error, setError] = useState('');

  const reload = async () => {
    setError('');
    try {
      const [cs, rs, hw] = await Promise.all([
        myClients(), trainerRoutines(), memberHomework(memberId),
      ]);
      const c = cs.find((x) => x.id === memberId) ?? null;
      setClient(c);
      setRoutines(rs);
      setHomework(hw);
      if (c) {
        const log = await bodyLog(memberId);
        setLastBody(log[0] ?? null);
      }
    } catch (err) {
      console.error('회원 상세 조회 실패', err);
      setError('회원 관리 정보를 불러오지 못했습니다.');
      setClient(null);
    }
  };

  useEffect(() => { reload(); }, [memberId]);

  if (client === undefined) {
    return (
      <>
        <TopBar title="회원" back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <TopBar title="회원" back />
        <Card>
          {error ? (
            <div>
              <Empty title={error} />
              <button type="button" className="btn btn--block" onClick={reload}>다시 불러오기</button>
            </div>
          ) : <Empty title="담당 회원이 아닙니다" />}
        </Card>
      </>
    );
  }

  return (
    <>
      <TopBar title={client.name} sub={`PT ${client.sessions_left}회 남음`} back />

      <Card>
        <div className="row row--between" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <p className="eyebrow">담당 회원</p>
            <h2 className="card__title" style={{ fontSize: 18 }}>{client.name}</h2>
            <p className="card__note">
              {client.next ? `다음 수업 ${client.next}` : '다음 수업 미정'}
              {client.last_body ? ` · 최근 측정 ${client.last_body.replace(/-/g, '.')}` : ''}
            </p>
          </div>
          <Plate value={client.sessions_left} unit="회" />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="btn grow"
            onClick={() => nav(`/t/clients/${memberId}/send`)}
          >
            숙제 내기
          </button>
          <Link
            className={`btn btn--ghost grow ${!client.consent_proxy ? 'is-disabled' : ''}`}
            to={`/t/clients/${memberId}/body`}
            style={!client.consent_proxy ? { pointerEvents: 'none', opacity: .45 } : undefined}
          >
            측정 입력
          </Link>
        </div>
        <button
          type="button"
          className="btn btn--volt btn--block"
          style={{ marginTop: 8 }}
          onClick={() => nav(`/t/clients/${memberId}/overload`)}
        >
          다음 목표 보기
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 8 }}
          onClick={() => nav('/t/schedule')}
        >
          고정 일정 · 예약 관리
        </button>
        {!client.consent_proxy && (
          <p className="tiny muted" style={{ marginTop: 8 }}>대리입력 동의가 없어 측정은 회원이 직접 해야 합니다.</p>
        )}
      </Card>

      {lastBody && (
        <Card title="최근 체성분">
          <div className="row row--wrap" style={{ gap: 8 }}>
            <Chip kind="machine">체중 {lastBody.weight_kg}kg</Chip>
            <Chip>골격근 {lastBody.skeletal_muscle_kg}kg</Chip>
            <Chip>체지방 {lastBody.body_fat_pct}%</Chip>
          </div>
        </Card>
      )}

      <div className="row row--between" style={{ margin: '16px 2px 8px' }}>
        <p className="eyebrow" style={{ margin: 0 }}>이 회원에게 보낸 숙제</p>
        <button
          type="button"
          className="tiny"
          style={{ border: 0, background: none, color: 'var(--volt)', fontWeight: 700, cursor: 'pointer' }}
          onClick={() => nav(`/t/clients/${memberId}/send`)}
        >
          + 새 숙제
        </button>
      </div>

      <Card flush>
        {!homework && <p className="muted small" style={{ padding: 16 }}>불러오는 중…</p>}
        {homework?.length === 0 && (
          <div style={{ padding: 16 }}>
            <Empty title="아직 보낸 숙제가 없습니다">
              아래 보관함 루틴을 골라 숙제로 보내세요.
            </Empty>
          </div>
        )}
        <ul className="list">
          {homework?.map((h) => (
            <li key={h.id}>
              <div className="list__item" style={{ cursor: 'default' }}>
                <div className="list__body">
                  <div className="list__title">{h.title}</div>
                  <div className="list__meta">
                    {h.sent_at.replace(/-/g, '.')} 전송
                    {h.due ? ` · ~${h.due.replace(/-/g, '.')}` : ''}
                    {h.note ? ` · ${h.note}` : ''}
                  </div>
                </div>
                <Chip kind="sub">숙제</Chip>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="row row--between" style={{ margin: '18px 2px 8px' }}>
        <p className="eyebrow" style={{ margin: 0 }}>내 루틴 보관함</p>
        <button
          type="button"
          className="tiny"
          style={{ border: 0, background: none, color: 'var(--volt)', fontWeight: 700, cursor: 'pointer' }}
          onClick={() => nav(`/t/routines/new?member=${memberId}`)}
        >
          + 루틴 추가
        </button>
      </div>

      <Card flush>
        {!routines && <p className="muted small" style={{ padding: 16 }}>불러오는 중…</p>}
        {routines?.length === 0 && (
          <div style={{ padding: 16 }}>
            <Empty title="저장된 루틴이 없습니다">
              회원이 운동할 헬스장 환경에 맞춰 루틴을 만들어 두세요.
            </Empty>
          </div>
        )}
        <ul className="list">
          {routines?.map((r) => (
            <li key={r.id}>
              <div className="list__item" style={{ cursor: 'default' }}>
                <div className="list__body">
                  <div className="list__title">{r.title}</div>
                  <div className="list__meta">
                    주 {r.days}회 · {GOAL_LABEL[r.goal] ?? r.goal} · {r.updated.replace(/-/g, '.')}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Link className="btn btn--sm" to={`/t/clients/${memberId}/workout/${r.id}`}>운동 시작</Link>
                  <Link className="btn btn--sm btn--ghost" to={`/t/routines/${r.id}?member=${memberId}`}>편집</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => nav(`/t/routines/new?member=${memberId}`)}
        >
          루틴 추가
        </button>
      </div>

      <Note style={{ marginTop: 12 }}>
        <p className="small">
          보관함 루틴은 원본입니다. 숙제로 보내면 회원 앱에 사본이 생기고,
          나중에 원본을 고쳐도 이미 보낸 숙제는 그대로입니다.
        </p>
      </Note>
    </>
  );
}
