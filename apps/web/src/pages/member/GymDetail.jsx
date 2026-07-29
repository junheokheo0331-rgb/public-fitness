import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { TopBar, Card, Chip, Note, Plate, won } from '../../ui/bits.jsx';
import { getGym, availableExercises, machineCatalog, gymPhotos } from '../../lib/api.js';

/* 등록하기 전에 루틴을 먼저 보여준다.

   다짐을 비롯한 기존 서비스는 가격과 사진까지 보여준다. 거기서
   더 갈 수 있는 곳은 "여기 등록하면 내가 뭘 하게 되는가"다.
   보유 기구가 입력이니 등록 전에도 계산할 수 있다. */

export default function GymDetail() {
  const { gymId } = useParams();
  const [gym, setGym] = useState(null);
  const [preview, setPreview] = useState(null);
  const [photos, setPhotos] = useState([]);
  const catalog = machineCatalog();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [g, ex, ph] = await Promise.all([
        getGym(gymId), availableExercises(gymId), gymPhotos(gymId),
      ]);
      if (!alive) return;
      setGym(g);
      setPhotos(ph);
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

        <p className="tiny muted" style={{ marginTop: 4 }}>
          노란 배지는 케이블·프리웨이트 종목입니다. 세팅을 바꿔 얼마든지 변형할 수 있습니다.
        </p>

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
        <Note>
          <p className="small">
            등록 후 해지하면 이용한 기간을 뺀 금액에서 총액의 10%를 공제하고 돌려받습니다.
            앱이 그 금액을 계산해 드립니다.
          </p>
        </Note>
      </Card>
    </>
  );
}
