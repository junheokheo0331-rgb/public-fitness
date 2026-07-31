import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { TopBar, Card, Chip, Note, Plate, won } from '../../ui/bits.jsx';
import {
  getGym, availableExercises, machineCatalog, gymPhotos, listTrainersByGym,
} from '../../lib/api.js';

export default function GymDetail() {
  const { gymId } = useParams();
  const [gym, setGym] = useState(null);
  const [preview, setPreview] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [trainers, setTrainers] = useState(null);
  const catalog = machineCatalog();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [g, ex, ph, tr] = await Promise.all([
        getGym(gymId), availableExercises(gymId), gymPhotos(gymId), listTrainersByGym(gymId),
      ]);
      if (!alive) return;
      setGym(g);
      setPhotos(ph);
      setTrainers(tr);
      setPreview(buildRoutine({ available: ex, daysPerWeek: 3, goal: 'hypertrophy', level: 1 }));
    })();
    return () => { alive = false; };
  }, [gymId]);

  if (!gym) return <><TopBar title="불러오는 중" back /></>;

  const names = (codes) => codes.map((c) => catalog.find((m) => m.code === c)?.name ?? c);
  const missing = catalog.filter((m) => !gym.machines.includes(m.code));

  return (
    <>
      <TopBar title={gym.name} sub={`${gym.dong} · ${gym.open}`} back />

      {photos.length > 0 && (
        <div className="photostrip" style={{ marginBottom: 12 }}>
          {photos.map((p) => (
            <div key={p.id} className="photo" style={{ width: 152, height: 108 }}>
              {p.url
                ? <img src={p.url} alt={p.caption ?? ''} />
                : <span className="photo__ph" style={{ background: p.tone }} />}
              {p.caption && <span className="photo__cap">{p.caption}</span>}
            </div>
          ))}
        </div>
      )}

      <Card>
        <div className="row row--between" style={{ alignItems: 'flex-start' }}>
          <div>
            <p className="eyebrow">보유 기구</p>
            <p className="card__note" style={{ maxWidth: 260 }}>
              {names(gym.machines).slice(0, 6).join(' · ')}
              {gym.machines.length > 6 && ` 외 ${gym.machines.length - 6}종`}
            </p>
          </div>
          <Plate value={gym.machines.length} unit="종" />
        </div>
      </Card>

      <Card title="소속 트레이너" note="이력·포트폴리오를 확인할 수 있어요" flush>
        {!trainers && <p className="muted small" style={{ padding: 16 }}>불러오는 중…</p>}
        {trainers?.length === 0 && (
          <p className="muted small" style={{ padding: 16 }}>공개 중인 트레이너가 없습니다.</p>
        )}
        <ul className="list">
          {trainers?.map((t) => (
            <li key={t.id}>
              <Link className="list__item" to={`/trainers/${t.id}`}>
                <div className="list__body">
                  <div className="list__title">{t.name}</div>
                  <div className="list__meta">{t.headline}</div>
                  <div className="row row--wrap" style={{ gap: 4, marginTop: 4 }}>
                    {(t.specialties || []).slice(0, 3).map((s) => (
                      <Chip key={s} kind="sub">{s}</Chip>
                    ))}
                  </div>
                </div>
                <div className="list__right">
                  <div>★ {t.rating_avg}</div>
                  <div className="tiny">{won(t.price_per_session)}/회</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="이 헬스장 기구로 짜면" note="주 3회 · 근비대 · 초보 기준">
        {preview?.days.map((d) => (
          <div key={d.day_index} style={{ marginBottom: 12 }}>
            <div className="row row--between" style={{ marginBottom: 4 }}>
              <strong className="small">{d.name}</strong>
              <span className="tiny muted mono">{d.items.length}종목</span>
            </div>
            <div className="row row--wrap" style={{ gap: 5 }}>
              {d.items.map((i) => (
                <Chip key={i.exercise_code} kind={i.is_freeform ? 'sub' : undefined}>
                  {i.name}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        {preview?.warnings.length > 0 && (
          <Note kind="volt" title="이 헬스장에서 못 하는 것">
            {preview.warnings.map((w, i) => <p key={i}>{w}</p>)}
          </Note>
        )}
      </Card>

      {missing.length > 0 && (
        <Card title="없는 기구" note="다른 곳과 비교할 때 참고하세요">
          <div className="row row--wrap" style={{ gap: 5 }}>
            {missing.map((m) => <Chip key={m.code}>{m.name}</Chip>)}
          </div>
        </Card>
      )}

      <Card title="가격" note="앱에서 결제하지 않습니다. 헬스장에서 직접 등록하세요.">
        <ul className="list">
          {gym.plans.map((p) => (
            <li key={p.id} className="list__item" style={{ cursor: 'default' }}>
              <div className="list__body">
                <div className="list__title">{p.name}</div>
                <div className="list__meta">
                  {p.kind === 'pt' ? `${p.sessions}회` : `${p.months}개월`}
                  {p.list_price > p.price && ` · 정가 ${won(p.list_price)}`}
                </div>
              </div>
              <div className="list__right mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                {won(p.price)}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
