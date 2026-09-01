import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar, Card, Chip, Field, Note, Empty, won } from '../../ui/bits.jsx';
import {
  getPtRequest, applyToPtRequest, myTrainerProfile, listApplications,
} from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';

export default function RequestApply() {
  const { requestId } = useParams();
  const nav = useNavigate();
  const { session } = useSession();
  const [req, setReq] = useState(null);
  const [me, setMe] = useState(null);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [r, profile, apps] = await Promise.all([
        getPtRequest(requestId),
        myTrainerProfile(),
        listApplications(requestId),
      ]);
      if (!alive) return;
      setReq(r);
      setMe(profile);
      const mine = apps.find((a) => a.trainer_id === session.id);
      setApplied(!!mine);
      if (profile && r) {
        setPrice(String(profile.price_per_session * r.sessions));
        setMessage(
          `${r.goal} ${r.sessions}회, 현실적인 루틴으로 진행하겠습니다. ${profile.headline}`,
        );
      }
    })();
    return () => { alive = false; };
  }, [requestId, session.id]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await applyToPtRequest({
        requestId,
        message,
        proposedPrice: price,
      });
      setApplied(true);
    } finally {
      setBusy(false);
    }
  };

  if (!req) {
    return (
      <>
        <TopBar title="제안서 보내기" back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }

  if (req.status !== 'open') {
    return (
      <>
        <TopBar title="제안서 보내기" back />
        <Card><Empty title="이미 마감된 요청입니다" /></Card>
      </>
    );
  }

  return (
    <>
      <TopBar title="제안서 보내기" sub={`${req.goal} · ${req.sessions}회`} back />

      <Card title="회원 요청">
        <div className="row row--wrap" style={{ marginBottom: 8 }}>
          <Chip>{req.member_name}</Chip>
          <Chip>{req.schedule}</Chip>
          <Chip kind="machine">{won(req.budget_max)}까지</Chip>
        </div>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink-2)' }}>
          {req.note || '추가 메모 없음'}
        </p>
      </Card>

      {me && (
        <Card title="내 이력서 (함께 전달)">
          <p className="card__title" style={{ fontSize: 16 }}>{me.name}</p>
          <p className="card__note">{me.headline} · {me.gym_name}</p>
          <div className="row row--wrap" style={{ margin: '8px 0' }}>
            <Chip kind="machine">★ {me.rating_avg} ({me.review_count})</Chip>
            <Chip>{me.years}년차</Chip>
            <Chip>{me.sessions_done.toLocaleString()}회 진행</Chip>
          </div>
          <p className="small muted" style={{ margin: 0 }}>{me.bio}</p>
          <p className="tiny muted" style={{ margin: '8px 0 0' }}>
            자격 · {me.certs.join(' · ')}
          </p>
        </Card>
      )}

      {applied ? (
        <Note kind="go" title="제안서를 보냈습니다">
          <p>회원이 제안서를 읽고 선택하면 알림이 갑니다. (연습 모드에선 알림 없음)</p>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 10 }}
            onClick={() => nav('/t/requests')}
          >
            요청 목록으로
          </button>
        </Note>
      ) : (
        <form onSubmit={submit}>
          <Card title="제안 내용">
            <Field
              label="제안 금액 (전체)"
              hint={`회당 약 ${won(Math.round(Number(price || 0) / (req.sessions || 1)))}`}
            >
              <input
                className="input input--num"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </Field>
            <Field label="회원에게 한마디" hint="이력서와 함께 전달됩니다">
              <textarea
                className="input"
                rows={4}
                style={{ minHeight: 100, resize: 'vertical' }}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </Field>
          </Card>
          <button className="btn btn--block" type="submit" disabled={busy}>
            {busy ? '보내는 중…' : '제안서 보내기'}
          </button>
        </form>
      )}
    </>
  );
}
