import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar, Card, Chip, Note, Empty, won, km } from '../../ui/bits.jsx';
import {
  getPtRequest, listApplications, selectPtApplication,
} from '../../lib/api.js';

export default function PtRequestDetail() {
  const { requestId } = useParams();
  const nav = useNavigate();
  const [req, setReq] = useState(null);
  const [apps, setApps] = useState(null);
  const [picking, setPicking] = useState(null);

  const reload = async () => {
    const [r, a] = await Promise.all([
      getPtRequest(requestId),
      listApplications(requestId),
    ]);
    setReq(r);
    setApps(a);
  };

  useEffect(() => { reload(); }, [requestId]);

  const pick = async (appId) => {
    if (!confirm('이 트레이너로 매칭할까요?')) return;
    setPicking(appId);
    try {
      await selectPtApplication(requestId, appId);
      await reload();
    } finally {
      setPicking(null);
    }
  };

  if (req === null && apps === null) {
    return (
      <>
        <TopBar title="PT 신청" back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }

  if (!req) {
    return (
      <>
        <TopBar title="PT 신청" back />
        <Card><Empty title="신청을 찾을 수 없습니다" /></Card>
      </>
    );
  }

  const mine = req.member_id === 'u-member';

  return (
    <>
      <TopBar
        title={`${req.goal} · ${req.sessions}회`}
        sub={req.dong}
        back
      />

      <Card>
        <div className="row row--wrap" style={{ marginBottom: 10 }}>
          {req.status === 'open' && <Chip kind="sub">모집중</Chip>}
          {req.status === 'matched' && <Chip kind="go">매칭 완료</Chip>}
          <Chip>{req.schedule}</Chip>
          <Chip kind="machine">{won(req.budget_max)}까지</Chip>
        </div>
        {req.note && <p style={{ margin: 0, fontSize: 14.5 }}>{req.note}</p>}
        <p className="tiny muted" style={{ margin: '10px 0 0' }}>
          {req.created.replace(/-/g, '.')} 신청 · 제안 {apps?.length ?? 0}건
        </p>
      </Card>

      <div className="row row--between" style={{ margin: '16px 2px 8px' }}>
        <p className="eyebrow" style={{ margin: 0 }}>트레이너 제안서</p>
        <span className="tiny muted">가격 낮은 순</span>
      </div>

      {!apps && <Card><p className="muted small">불러오는 중…</p></Card>}

      {apps?.length === 0 && (
        <Card>
          <Empty title="아직 제안이 없습니다">
            근처 트레이너에게 요청이 전달됐어요. 조금 기다려 주세요.
          </Empty>
        </Card>
      )}

      {apps?.map((a) => {
        const t = a.trainer;
        const accepted = a.status === 'accepted';
        const rejected = a.status === 'rejected';
        return (
          <Card key={a.id} className={accepted ? 'card--picked' : ''}>
            <div className="row row--between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
              <div className="grow">
                <div className="row" style={{ gap: 6, marginBottom: 2 }}>
                  <h2 className="card__title" style={{ fontSize: 17 }}>{t?.name ?? '트레이너'}</h2>
                  {accepted && <Chip kind="go">선택됨</Chip>}
                  {rejected && <Chip>미선택</Chip>}
                </div>
                <p className="card__note">{t?.headline}</p>
              </div>
              <div className="right">
                <div className="mono" style={{ fontWeight: 700, color: 'var(--volt)' }}>
                  {won(a.proposed_price)}
                </div>
                <div className="tiny muted">회당 {won(a.proposed_per)}</div>
              </div>
            </div>

            <div className="row row--wrap" style={{ marginBottom: 10 }}>
              <Chip kind="machine">★ {t?.rating_avg} ({t?.review_count})</Chip>
              <Chip>{t?.years}년차</Chip>
              <Chip>{t?.gym_name}</Chip>
              {t?.distance_m != null && <Chip>{km(t.distance_m)}</Chip>}
            </div>

            {t?.certs?.length > 0 && (
              <p className="tiny muted" style={{ margin: '0 0 8px' }}>
                자격 · {t.certs.join(' · ')}
              </p>
            )}

            <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)' }}>
              {a.message}
            </p>

            {mine && req.status === 'open' && (
              <button
                type="button"
                className="btn btn--block"
                disabled={!!picking}
                onClick={() => pick(a.id)}
              >
                {picking === a.id ? '매칭 중…' : '이 트레이너로 선택'}
              </button>
            )}

            {accepted && (
              <button type="button" className="btn btn--block" onClick={() => nav('/my')}>
                내 헬스장에서 보기
              </button>
            )}
          </Card>
        );
      })}

      {mine && req.status === 'open' && apps?.length > 0 && (
        <Note title="하나만 고르면 돼요">
          <p>선택하지 않은 제안은 자동으로 닫힙니다. 매칭 후 PT 세션이 시작됩니다.</p>
        </Note>
      )}
    </>
  );
}
