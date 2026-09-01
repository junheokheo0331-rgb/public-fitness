import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRoutine } from '@gymlink/core/routine';
import { TopBar, Card, Chip, Note, Plate, Gauge, Empty, Field } from '../../ui/bits.jsx';
import {
  gymMachineInventory, saveGymMachineInventory, machineCatalog, machineBrands,
  gymPhotos, uploadGymPhoto, deleteGymPhoto,
} from '../../lib/api.js';
import { availableFor, machineImpact, EXERCISES } from '../../lib/catalog.js';
import { useSession } from '../../lib/session.jsx';

const CATEGORY_LABEL = {
  all: '전체', rack: '랙 · 프레임', bench: '벤치', free: '프리웨이트',
  cable: '케이블', machine: '머신', cardio: '유산소', etc: '소도구',
};

function maxSplit(available) {
  let best = 0;
  for (const d of [2, 3, 4, 5, 6]) {
    const r = buildRoutine({ available, daysPerWeek: d, level: 2 });
    if (r.days.length && r.warnings.length === 0) best = d;
  }
  return best;
}

export default function Machines() {
  const { session } = useSession();
  const catalog = machineCatalog();
  const manufacturerList = machineBrands();
  const fileRef = useRef(null);
  const [configs, setConfigs] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [adding, setAdding] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photoTarget, setPhotoTarget] = useState(null);

  useEffect(() => {
    if (!session.gymId) { setConfigs(null); return undefined; }
    let alive = true;
    (async () => {
      try {
        const [inventory, ph] = await Promise.all([gymMachineInventory(session.gymId), gymPhotos(session.gymId)]);
        if (alive) {
          setConfigs(Object.fromEntries(inventory.map((item) => [item.code, item])));
          setPhotos(ph);
        }
      } catch (error) {
        if (alive) setConfigs({ __loadError: { code: '__loadError', note: error.message || '불러오지 못했습니다.' } });
      }
    })();
    return () => { alive = false; };
  }, [session.gymId]);

  const ownedCodes = useMemo(() => new Set(Object.keys(configs || {})), [configs]);
  const stats = useMemo(() => {
    if (!configs) return null;
    const available = availableFor([...ownedCodes]);
    return { exercises: available.length, total: EXERCISES.length, split: maxSplit(available) };
  }, [configs, ownedCodes]);
  const categories = ['all', ...new Set(catalog.map((m) => m.category).filter(Boolean))];
  const needle = query.trim().toLocaleLowerCase('ko-KR');
  const results = catalog.filter((m) => !ownedCodes.has(m.code)
    && (category === 'all' || m.category === category)
    && (brand === 'all' || m.brand === brand || !m.brand)
    && (!needle || [m.name, m.brand, m.series, ...(m.provides || [])].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(needle)))
    .slice(0, 60);

  if (!session.gymId) return <><TopBar title="머신" back /><Card><Empty title="연결된 헬스장이 없습니다">사업장이 연결되면 머신을 등록할 수 있습니다.</Empty></Card></>;
  if (configs?.__loadError) return <><TopBar title="머신" back /><Note kind="stop"><p className="small">{configs.__loadError.note}</p></Note></>;
  if (!configs || !stats) return <><TopBar title="머신" /><Card><p className="muted small">불러오는 중…</p></Card></>;

  const patchConfig = (code, patch) => { setConfigs((current) => ({ ...current, [code]: { ...current[code], ...patch } })); setSaved(false); };
  const add = (m) => {
    setConfigs((current) => ({ ...current, [m.code]: {
      code: m.code, qty: 1, brand: m.brand || (brand !== 'all' ? brand : ''), model_name: m.series || '',
      supports_unilateral: m.unilateral ?? null, available_attachments: [],
      custom_capabilities: [], note: '', metadata: {},
    } }));
    setEditing(m.code); setSaved(false);
  };
  const remove = (m) => {
    if (!confirm(`「${m.name}」을 보유 목록에서 뺄까요?`)) return;
    setConfigs((current) => { const copy = { ...current }; delete copy[m.code]; return copy; });
    setEditing(null); setSaved(false);
  };
  const save = async () => {
    setBusy(true);
    try { await saveGymMachineInventory(session.gymId, Object.values(configs)); setSaved(true); alert('저장했습니다. 회원의 기구 열람과 루틴 매칭에 바로 반영됩니다.'); }
    catch (error) { alert(error.message || '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const photosOf = (code) => photos.filter((p) => p.machine_code === code);
  const onPickPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !photoTarget) return;
    setBusy(true);
    try {
      const machine = catalog.find((m) => m.code === photoTarget);
      const row = await uploadGymPhoto(session.gymId, photoTarget, file, machine?.name);
      setPhotos((current) => [...current, row]);
    } catch { alert('사진을 올리지 못했습니다.'); }
    finally { setBusy(false); setPhotoTarget(null); event.target.value = ''; }
  };
  const removePhoto = async (photo) => {
    setBusy(true);
    try { await deleteGymPhoto(session.gymId, photo); setPhotos((current) => current.filter((p) => p.id !== photo.id)); }
    finally { setBusy(false); }
  };
  const coverage = Math.round((stats.exercises / stats.total) * 100);

  return <>
    <TopBar title="머신" sub="제조사·모델·실물 사진을 함께 관리" back right={!saved && <button className="btn btn--sm" disabled={busy} onClick={save}>저장</button>} />
    <input ref={fileRef} type="file" accept="image/*" className="sr" onChange={onPickPhoto} />

    <Card>
      <div className="row row--between" style={{ alignItems: 'flex-start' }}><Plate value={ownedCodes.size} unit="종 보유" /><Plate value={stats.exercises} unit="종목 가능" ghost sub={`전체 ${stats.total}종목`} /><Plate value={stats.split || '—'} unit="분할까지" ghost /></div>
      <div style={{ marginTop: 14 }}><div className="row row--between tiny muted"><span>운동 매칭 범위</span><span className="mono">{coverage}%</span></div><Gauge value={coverage} good={coverage >= 70} /></div>
    </Card>

    <Card title="내 헬스장 기구" note="등록한 기구만 회원에게 공개되고 루틴에 연결됩니다" right={<button className="btn btn--sm" onClick={() => setAdding((v) => !v)}>{adding ? '닫기' : '머신 추가'}</button>}>
      {ownedCodes.size === 0 && <Empty title="등록된 기구가 없습니다">아래 검색에서 실제 보유 모델을 추가하세요.</Empty>}
      <div className="machine-inventory-grid">{[...ownedCodes].map((code) => {
        const m = catalog.find((row) => row.code === code) || { code, name: code, provides: [] };
        const config = configs[code];
        const mine = photosOf(code);
        const open = editing === code;
        const displayName = config.metadata?.display_name || m.name;
        return <section key={code} className={`machine-inventory ${open ? 'machine-inventory--open' : ''}`}>
          <button className="machine-inventory__summary" type="button" onClick={() => setEditing(open ? null : code)}>
            {mine[0]?.url ? <img src={mine[0].url} alt="" /> : <span className="machine-inventory__mark">{(config.brand || m.brand || 'GYM').slice(0, 2).toUpperCase()}</span>}
            <span className="grow"><strong>{displayName}</strong><small>{[config.brand || m.brand, config.model_name || m.series, `${config.qty || 1}대`].filter(Boolean).join(' · ')}</small></span><span aria-hidden="true">{open ? '⌃' : '⌄'}</span>
          </button>
          {open && <div className="machine-inventory__edit">
            <div className="machine-config__grid">
              <Field label="수량"><input className="input" type="number" min="1" max="99" value={config.qty || 1} onChange={(e) => patchConfig(code, { qty: Number(e.target.value) || 1 })} /></Field>
              <Field label="제조사"><input className="input" list="machine-brand-options" placeholder="검색 또는 직접 입력" value={config.brand || ''} onChange={(e) => patchConfig(code, { brand: e.target.value })} /></Field>
              <Field label="표시 이름"><input className="input" placeholder={m.name} value={config.metadata?.display_name || ''} onChange={(e) => patchConfig(code, { metadata: { ...(config.metadata || {}), display_name: e.target.value } })} /></Field>
              <Field label="모델·시리즈"><input className="input" placeholder="예: Iso-Lateral" value={config.model_name || ''} onChange={(e) => patchConfig(code, { model_name: e.target.value })} /></Field>
              <Field label="최소 증량"><input className="input" type="number" min="0" step="0.5" placeholder="kg" value={config.min_step_kg || ''} onChange={(e) => patchConfig(code, { min_step_kg: Number(e.target.value) || null })} /></Field>
              <Field label="최대 중량"><input className="input" type="number" min="0" placeholder="kg" value={config.max_load_kg || ''} onChange={(e) => patchConfig(code, { max_load_kg: Number(e.target.value) || null })} /></Field>
              <Field label="부착물·그립"><input className="input" placeholder="D핸들, 로프, 일자바" value={(config.available_attachments || []).join(', ')} onChange={(e) => patchConfig(code, { available_attachments: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={config.supports_unilateral === true} onChange={(e) => patchConfig(code, { supports_unilateral: e.target.checked })} /><span>좌우 독립 구동으로 원암·원레그 가능</span></label>
            <Field label="현장 메모"><input className="input" placeholder="시트 조절, 그립, 사용 특이사항" value={config.note || ''} onChange={(e) => patchConfig(code, { note: e.target.value })} /></Field>
            {mine.length > 0 && <div className="row row--wrap">{mine.map((p) => <div key={p.id} className="photo photo--sm">{p.url ? <img src={p.url} alt={displayName} /> : <span className="photo__ph" style={{ background: p.tone }} />}<button className="photo__x" onClick={() => removePhoto(p)} aria-label="사진 삭제">×</button></div>)}</div>}
            <div className="row row--between" style={{ marginTop: 10 }}><button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => { setPhotoTarget(code); fileRef.current?.click(); }}>사진 추가</button><button className="btn btn--sm btn--ghost" onClick={() => remove(m)}>보유 목록에서 삭제</button></div>
          </div>}
        </section>;
      })}</div>
    </Card>

    {adding && <Card title="머신 추가" note="제조사와 머신 종류를 분리해 어떤 모델도 등록할 수 있습니다">
      <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예: Cybex Eagle, 해머 하이 로우, 펜듈럼" autoFocus />
      <div className="row row--wrap" style={{ gap: 6, marginTop: 10 }}>{categories.map((c) => <button key={c} className={`chip ${category === c ? 'chip--pick' : ''}`} onClick={() => setCategory(c)}>{CATEGORY_LABEL[c] || c}</button>)}</div>
      <div className="row" style={{ marginTop: 10 }}>
        <input className="input grow" list="machine-brand-options" value={brand === 'all' ? '' : brand} onChange={(e) => setBrand(e.target.value.trim() || 'all')} placeholder="제조사 검색 또는 새 브랜드 직접 입력" />
        {brand !== 'all' && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setBrand('all')}>초기화</button>}
      </div>
      <datalist id="machine-brand-options">{manufacturerList.map((name) => <option key={name} value={name} />)}</datalist>
      {brand !== 'all' && <Note kind="go"><p className="small"><strong>{brand}</strong>로 등록됩니다. 사전에 없는 제조사도 그대로 저장됩니다. 아래에서 가장 가까운 운동 유형을 고르고 표시 이름·모델명을 자유롭게 적으세요.</p></Note>}
      <p className="tiny muted" style={{ margin: '9px 0' }}>{results.length === 60 ? '상위 60개 표시 · 이름을 더 입력해 좁혀보세요' : `${results.length}개 찾음`}</p>
      <ul className="catalog-results">{results.map((m) => {
        const impact = machineImpact([...ownedCodes], m.code); const opens = impact.after - impact.before;
        return <li key={m.code}><div className="catalog-result"><div className="grow"><div className="row row--wrap" style={{ gap: 5 }}><strong>{m.name}</strong>{m.brand && <Chip kind="sub">{m.brand}</Chip>}</div><p>{[m.series, CATEGORY_LABEL[m.category], opens > 0 ? `운동 ${opens}개 추가` : '기존 운동과 연동'].filter(Boolean).join(' · ')}</p></div><button className="btn btn--sm" onClick={() => add(m)}>추가</button></div></li>;
      })}</ul>
      {results.length === 0 && <Note kind="volt" title="검색 결과가 없습니다"><p className="small">검색어를 동작 이름으로 바꿔보세요. 예: 수직 당기기, 수평 로우, 프레스. 제조사와 실제 표시 이름은 머신을 추가한 뒤 자유롭게 입력할 수 있습니다.</p></Note>}
    </Card>}

    <Note title="왜 모델 정보까지 받나요"><p className="small">수직·수평 당기기, 독립암, 그립과 부착물, 중량 단위를 함께 저장해야 헬스장을 옮겼을 때 기존 루틴을 가장 가까운 머신으로 바꿀 수 있습니다.</p></Note>
    {!saved && <button className="btn btn--block" disabled={busy} onClick={save}>{busy ? '저장 중…' : '변경사항 저장'}</button>}
  </>;
}
