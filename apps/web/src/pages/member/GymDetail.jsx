import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { TopBar, Card, Chip, Note, Plate, won } from '../../ui/bits.jsx';
import { useSession } from '../../lib/session.jsx';
import {
  getGym, availableExercises, machineCatalog, gymMachineInventory, gymPhotos, listTrainersByGym, myMemberships,
} from '../../lib/api.js';

const MACHINE_CATEGORIES = {
  all: '전체', rack: '랙', bench: '벤치', free: '프리웨이트', cable: '케이블',
  machine: '머신', cardio: '유산소', etc: '소도구',
};

export default function GymDetail() {
  const { gymId } = useParams();
  const { session, switchGym } = useSession();
  const [gym, setGym] = useState(null);
  const [preview, setPreview] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [trainers, setTrainers] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [machineQuery, setMachineQuery] = useState('');
  const [machineCategory, setMachineCategory] = useState('all');
  const [memberships, setMemberships] = useState([]);
  const [switching, setSwitching] = useState(false);
  const catalog = machineCatalog();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [g, ex, ph, tr, inv, membershipsForMe] = await Promise.all([
        getGym(gymId), availableExercises(gymId), gymPhotos(gymId), listTrainersByGym(gymId), gymMachineInventory(gymId), myMemberships(),
      ]);
      if (!alive) return;
      setGym(g);
      setPhotos(ph);
      setTrainers(tr);
      setInventory(inv);
      setMemberships(membershipsForMe);
      setPreview(buildRoutine({ available: ex, daysPerWeek: 3, goal: 'hypertrophy', level: 1 }));
    })();
    return () => { alive = false; };
  }, [gymId]);

  if (!gym) return <><TopBar title="불러오는 중" back /></>;

  const names = (codes) => codes.map((c) => catalog.find((m) => m.code === c)?.name ?? c);
  const machineRows = inventory.map((row) => {
    const standard = catalog.find((m) => m.code === row.code);
    return { ...standard, ...row, name: row.metadata?.display_name || row.name || standard?.name || row.code };
  });
  const machineCategories = ['all', ...new Set(machineRows.map((m) => m.category).filter(Boolean))];
  const needle = machineQuery.trim().toLocaleLowerCase('ko-KR');
  const filteredMachines = machineRows.filter((m) => (
    (machineCategory === 'all' || m.category === machineCategory)
    && (!needle || [m.name, m.brand, m.model_name, m.series, ...(m.provides || [])]
      .filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(needle))
  ));
  const canSwitch = memberships.some((membership) => membership.gym_id === gymId);
  const isMine = session.gymId === gymId;

  const makeMine = async () => {
    setSwitching(true);
    try { await switchGym(gymId); } finally { setSwitching(false); }
  };

  return (
    <>
      <TopBar title={gym.name} sub={`${gym.dong} · ${gym.open}`} back />

      {isMine ? (
        <Note kind="go"><p className="small">현재 운동·루틴에 연결된 내 헬스장입니다.</p></Note>
      ) : canSwitch ? (
        <button type="button" className="btn btn--block" style={{ marginBottom: 12 }} disabled={switching} onClick={makeMine}>
          {switching ? '변경 중…' : '이곳을 내 헬스장으로 변경'}
        </button>
      ) : null}

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

      <Card title="머신·기구 전체 보기" note="브랜드·모델·원암 가능 여부까지 확인하세요">
        <input className="input" type="search" value={machineQuery} onChange={(e) => setMachineQuery(e.target.value)} placeholder="머신명, 브랜드, 모델 검색" />
        <div className="row row--wrap" style={{ gap: 6, margin: '10px 0 6px' }}>
          {machineCategories.map((category) => <button key={category} type="button" className={`chip ${machineCategory === category ? 'chip--pick' : ''}`} onClick={() => setMachineCategory(category)}>{MACHINE_CATEGORIES[category] || category}</button>)}
        </div>
        <p className="tiny muted">검색 결과 {filteredMachines.length}종 · 실제 등록 정보 기준</p>
        <ul className="list machine-public-list">
          {filteredMachines.map((m) => {
            const machinePhotos = photos.filter((p) => p.machine_code === m.code);
            return <li key={m.code} className="list__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              {machinePhotos[0]?.url && <img className="machine-public-list__thumb" src={machinePhotos[0].url} alt={m.name} />}
              <div className="list__body">
                <div className="row row--wrap" style={{ gap: 5 }}><span className="list__title">{m.name}</span>{m.qty > 1 && <Chip kind="machine">{m.qty}대</Chip>}{m.supports_unilateral === true && <Chip kind="sub">좌우 독립</Chip>}</div>
                <div className="list__meta">{[m.brand, m.model_name || m.series, MACHINE_CATEGORIES[m.category]].filter(Boolean).join(' · ') || '모델 정보 확인 중'}</div>
                {(m.available_attachments?.length > 0 || m.note) && <div className="tiny muted" style={{ marginTop: 4 }}>{m.available_attachments?.length > 0 && `그립·부착물: ${m.available_attachments.join(', ')}`}{m.available_attachments?.length > 0 && m.note ? ' · ' : ''}{m.note}</div>}
              </div>
            </li>;
          })}
        </ul>
        {filteredMachines.length === 0 && <p className="small muted">조건에 맞는 등록 기구가 없습니다.</p>}
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

      <Card title="가격표" note="헬스장이 등록한 공개 판매가와 정가입니다">
        <ul className="list">
          {gym.plans.map((p) => (
            <li key={p.id} className="list__item" style={{ cursor: 'default' }}>
              <div className="list__body">
                <div className="list__title">{p.name}</div>
                <div className="list__meta">
                  {p.kind === 'pt' ? `${p.sessions}회` : p.kind === 'daily' ? `${p.valid_days || 1}일 이용` : p.months ? `${p.months}개월` : '부가 상품'}
                  {p.kind === 'daily' && ` · ${p.metadata?.reentry_allowed ? '재입장 가능' : '1회 입장'}`}
                  {p.list_price > p.price && ` · 정가 ${won(p.list_price)}`}
                </div>
              </div>
              <div className="list__right mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                <div>{won(p.price)}</div>
                <Link className="btn btn--sm" style={{ marginTop: 6 }} to={`/checkout/${p.id}`}>결제</Link>
              </div>
            </li>
          ))}
        </ul>
        {gym.plans.length === 0 && <p className="small muted">등록된 공개 가격표가 없습니다.</p>}
      </Card>
    </>
  );
}
