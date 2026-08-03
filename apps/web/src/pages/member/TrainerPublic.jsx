import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TopBar, Card, Chip, Empty, Note, km, won } from '../../ui/bits.jsx';
import { getTrainer } from '../../lib/api.js';

const KIND_LABEL = {
  career: '경력', cert: '자격', result: '성과', media: '콘텐츠',
};

export default function TrainerPublic() {
  const { trainerId } = useParams();
  const nav = useNavigate();
  const [t, setT] = useState(undefined);

  useEffect(() => {
    getTrainer(trainerId).then(setT);
  }, [trainerId]);

  if (t === undefined) {
    return (
      <>
        <TopBar title="트레이너" back />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }
  if (!t) {
    return (
      <>
        <TopBar title="트레이너" back />
        <Card><Empty title="프로필을 찾을 수 없습니다" /></Card>
      </>
    );
  }

  const portfolio = t.portfolio || [];

  return (
    <>
      <TopBar title={t.name} sub={t.gym_name} back />

      <Card>
        <p className="eyebrow">트레이너</p>
        <h2 className="card__title" style={{ fontSize: 20 }}>{t.name}</h2>
        <p className="card__note">{t.headline}</p>
        <div className="row row--wrap" style={{ gap: 6, margin: '10px 0' }}>
          <Chip kind="machine">★ {t.rating_avg} ({t.review_count})</Chip>
          <Chip>{t.years}년차</Chip>
          <Chip>{t.sessions_done.toLocaleString()}회 진행</Chip>
          {t.distance_m != null && <Chip>{km(t.distance_m)}</Chip>}
        </div>
        <div className="row row--wrap" style={{ gap: 6, marginBottom: 10 }}>
          {(t.specialties || []).map((s) => <Chip key={s} kind="sub">{s}</Chip>)}
        </div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
          {t.bio}
        </p>
        <p className="small" style={{ margin: '12px 0 0', fontWeight: 700 }}>
          회당 {won(t.price_per_session)}
        </p>
      </Card>

      <Card title="자격">
        <div className="row row--wrap" style={{ gap: 6 }}>
          {(t.certs || []).map((c) => <Chip key={c} kind="machine">{c}</Chip>)}
          {!t.certs?.length && <span className="muted small">등록된 자격 없음</span>}
        </div>
      </Card>

      <Card title="포트폴리오" note="경력 · 자격 · 성과 · 콘텐츠">
        {portfolio.length === 0 && (
          <Empty title="아직 포트폴리오가 없습니다" />
        )}
        <ul className="list">
          {portfolio.map((p) => (
            <li key={p.id} className="list__item" style={{ cursor: 'default' }}>
              <div className="list__body">
                <div className="row" style={{ gap: 6 }}>
                  <Chip kind="sub">{KIND_LABEL[p.kind] || p.kind}</Chip>
                  <span className="list__title">{p.title}</span>
                </div>
                {(p.detail || p.year) && (
                  <div className="list__meta">
                    {[p.year, p.detail].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="소속 헬스장">
        <Link className="list__item" to={`/gym/${t.gym_id}`} style={{ padding: 0 }}>
          <div className="list__body">
            <div className="list__title">{t.gym_name}</div>
            <div className="list__meta">헬스장 기구·가격 보기</div>
          </div>
          <div className="list__right">›</div>
        </Link>
      </Card>

      <button type="button" className="btn btn--block" onClick={() => nav(`/book?trainer=${t.id}`)}>
        PT 예약하기
      </button>
      <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={() => nav('/pt/new')}>
        이 분에게 PT 받고 싶어요 (신청 올리기)
      </button>
      <Note style={{ marginTop: 12 }}>
        <p className="small">
          이미 등록된 PT가 있으면 캘린더에서 바로 예약하세요. 새 트레이너를 찾으면 신청을 올려 제안서를 받을 수 있습니다.
        </p>
      </Note>
    </>
  );
}
