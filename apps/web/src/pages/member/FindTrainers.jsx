import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar, Card, Chip, Empty, km, won } from '../../ui/bits.jsx';
import LocationPicker from '../../ui/LocationPicker.jsx';
import {
  listSpecialtyTags, searchTrainersAndGyms, getCurrentArea,
} from '../../lib/api.js';

/* 동네 헬스트레이너 찾기 — 분야 토글 → 해당 트레이너 있는 헬스장만 */

export default function FindTrainers() {
  const nav = useNavigate();
  const [tags, setTags] = useState([]);
  const [picked, setPicked] = useState([]);
  const [tab, setTab] = useState('gym'); // gym | trainer
  const [result, setResult] = useState(null);
  const [area, setArea] = useState(null);

  const load = async (specs = picked, areaId) => {
    setResult(null);
    const r = await searchTrainersAndGyms({
      specialties: specs,
      areaId: areaId ?? area?.id,
    });
    setResult(r);
  };

  useEffect(() => {
    (async () => {
      const [t, a] = await Promise.all([listSpecialtyTags(), getCurrentArea()]);
      setTags(t);
      setArea(a);
      await load([], a?.id);
    })();
  }, []);

  const toggle = (tag) => {
    setPicked((prev) => {
      const next = prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag];
      load(next, area?.id);
      return next;
    });
  };

  return (
    <>
      <TopBar title="동네 트레이너 찾기" sub="분야로 헬스장·트레이너 필터" />

      <Card>
        <p className="eyebrow">지역</p>
        <LocationPicker
          onChange={(a) => {
            setArea(a);
            load(picked, a.id);
          }}
        />
      </Card>

      <Card title="관심 분야" note="고른 분야 중 하나라도 있는 트레이너·헬스장">
        <div className="row row--wrap" style={{ gap: 6 }}>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`chip ${picked.includes(tag) ? 'chip--pick' : ''}`}
              onClick={() => toggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        {picked.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ marginTop: 10 }}
            onClick={() => { setPicked([]); load([], area?.id); }}
          >
            필터 초기화
          </button>
        )}
      </Card>

      <div className="find-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="find-tabs__btn"
          aria-selected={tab === 'gym'}
          onClick={() => setTab('gym')}
        >
          헬스장 {result ? result.gyms.length : ''}
        </button>
        <button
          type="button"
          role="tab"
          className="find-tabs__btn"
          aria-selected={tab === 'trainer'}
          onClick={() => setTab('trainer')}
        >
          트레이너 {result ? result.trainers.length : ''}
        </button>
      </div>

      {!result && <Card><p className="muted small">불러오는 중…</p></Card>}

      {result && tab === 'gym' && result.gyms.length === 0 && (
        <Card>
          <Empty title="조건에 맞는 헬스장이 없습니다">
            분야를 줄이거나 지역을 바꿔 보세요.
          </Empty>
        </Card>
      )}

      {result && tab === 'gym' && result.gyms.map((g) => (
        <Card key={g.id}>
          <button
            type="button"
            className="find-gym"
            onClick={() => nav(`/gym/${g.id}`)}
          >
            <div className="row row--between" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <h2 className="card__title" style={{ fontSize: 17 }}>{g.name}</h2>
                <p className="card__note">{g.dong} · 기구 {g.machines.length}종</p>
              </div>
              <span className="mono tiny muted">{km(g.distance_m)}</span>
            </div>
          </button>
          <p className="tiny muted" style={{ margin: '8px 0 6px' }}>
            매칭 트레이너 {g.matching_trainers.length}명
          </p>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {g.matching_trainers.map((t) => (
              <Link key={t.id} className="chip chip--sub" to={`/trainers/${t.id}`}>
                {t.name} · ★{t.rating_avg}
              </Link>
            ))}
          </div>
        </Card>
      ))}

      {result && tab === 'trainer' && (
        <Card flush>
          {result.trainers.length === 0 && (
            <div style={{ padding: 16 }}>
              <Empty title="조건에 맞는 트레이너가 없습니다" />
            </div>
          )}
          <ul className="list">
            {result.trainers.map((t) => (
              <li key={t.id}>
                <Link className="list__item" to={`/trainers/${t.id}`}>
                  <div className="list__body">
                    <div className="list__title">{t.name}</div>
                    <div className="list__meta">
                      {t.headline} · {t.gym_name}
                    </div>
                    <div className="row row--wrap" style={{ gap: 4, marginTop: 4 }}>
                      {(t.specialties || []).slice(0, 4).map((s) => (
                        <Chip key={s} kind={picked.includes(s) ? 'sub' : undefined}>{s}</Chip>
                      ))}
                    </div>
                  </div>
                  <div className="list__right">
                    <div>★ {t.rating_avg}</div>
                    <div className="tiny">{km(t.distance_m)}</div>
                    <div className="tiny">{won(t.price_per_session)}/회</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--block"
        style={{ marginTop: 12 }}
        onClick={() => nav('/pt/new')}
      >
        원하는 분이 없으면 PT 신청 올리기
      </button>
    </>
  );
}
