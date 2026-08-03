import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRoutine } from '@gymlink/core/routine';
import { TopBar, Card, Chip, Note, Plate, Gauge } from '../../ui/bits.jsx';
import {
  gymMachines, setGymMachines, machineCatalog,
  gymPhotos, uploadGymPhoto, deleteGymPhoto,
} from '../../lib/api.js';
import { availableFor, machineImpact, EXERCISES } from '../../lib/catalog.js';
import { useSession } from '../../lib/session.jsx';

/* 보유 기구 등록 — 이 프로젝트에서 제일 중요한 화면.

   차별점이 "실제 있는 기구 기준"인데, 그 목록을 넣는 사람은 관장이다.
   관장에게 이건 귀찮은 입력 노동이다. 그래서 체크할 때마다 뭐가 좋아지는지
   즉시 보여준다. 여기서 데이터가 안 쌓이면 차별점 자체가 성립하지 않는다.

   기구는 "역량"을 제공한다. 덤벨 하나 등록하면 14종목이 열리고,
   조절식 벤치를 더하면 인클라인 계열이 통째로 열린다.
   레그컬 머신처럼 하나만 여는 기구도 있다. 그 차이를 화면이 보여준다. */

const CATEGORY_LABEL = {
  rack: '랙 · 프레임', bench: '벤치', free: '프리웨이트',
  cable: '케이블', machine: '머신', cardio: '유산소', etc: '소도구',
};
const CATEGORY_ORDER = ['rack', 'bench', 'free', 'cable', 'machine', 'cardio', 'etc'];

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
  const fileRef = useRef(null);

  const [owned, setOwned] = useState(null);
  const [saved, setSaved] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [photoTarget, setPhotoTarget] = useState(null);   // 사진 올릴 기구 코드
  const [busy, setBusy] = useState(false);
  const [peek, setPeek] = useState(null);                 // 미등록 기구 미리보기

  useEffect(() => {
    (async () => {
      const [codes, ph] = await Promise.all([
        gymMachines(session.gymId), gymPhotos(session.gymId),
      ]);
      setOwned(new Set(codes));
      setPhotos(ph);
    })();
  }, [session.gymId]);

  const stats = useMemo(() => {
    if (!owned) return null;
    const list = [...owned];
    const available = availableFor(list);
    return {
      exercises: available.length,
      total: EXERCISES.length,
      patterns: new Set(available.map((e) => e.pattern)).size,
      freeform: available.filter((e) => e.is_freeform).length,
      split: maxSplit(available),
    };
  }, [owned]);

  if (!owned || !stats) {
    return <><TopBar title="보유 기구" /><Card><p className="muted small">불러오는 중…</p></Card></>;
  }

  function toggle(code) {
    const next = new Set(owned);
    next.has(code) ? next.delete(code) : next.add(code);
    setOwned(next);
    setSaved(false);
    setPeek(null);
  }

  async function save() {
    setBusy(true);
    try {
      await setGymMachines(session.gymId, [...owned]);
      setSaved(true);
      alert('저장했습니다. 기구 맞춤 루틴은 자동으로 다시 맞춰집니다.');
    } finally {
      setBusy(false);
    }
  }

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file || !photoTarget) return;
    setBusy(true);
    try {
      const machine = catalog.find((m) => m.code === photoTarget);
      const row = await uploadGymPhoto(session.gymId, photoTarget, file, machine?.name);
      setPhotos((p) => [...p, row]);
    } catch (err) {
      console.error(err);
      alert('사진을 올리지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false); setPhotoTarget(null); e.target.value = '';
    }
  }

  async function removePhoto(photo) {
    setBusy(true);
    try { await deleteGymPhoto(session.gymId, photo); setPhotos((p) => p.filter((x) => x.id !== photo.id)); }
    finally { setBusy(false); }
  }

  const byCat = {};
  for (const m of catalog) (byCat[m.category] = byCat[m.category] || []).push(m);
  const coverage = Math.round((stats.exercises / stats.total) * 100);
  const photosOf = (code) => photos.filter((p) => p.machine_code === code);

  return (
    <>
      <TopBar
        title="보유 기구"
        sub="여기 등록된 기구로만 회원 루틴이 만들어집니다"
        right={!saved && <button className="btn btn--sm" onClick={save} disabled={busy}>저장</button>}
      />

      <input ref={fileRef} type="file" accept="image/*" className="sr" onChange={onPickPhoto} />

      {/* ── 체크할 때마다 움직이는 숫자 ── */}
      <Card>
        <div className="row row--between" style={{ alignItems: 'flex-start' }}>
          <Plate value={owned.size} unit="종 보유" />
          <Plate value={stats.exercises} unit="종목 가능" ghost sub={`전체 ${stats.total}종목 중`} />
          <Plate value={stats.split || '—'} unit="분할까지" ghost sub="주간 최대" />
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="row row--between tiny muted" style={{ marginBottom: 5 }}>
            <span>회원에게 추천 가능한 종목</span>
            <span className="mono">{coverage}%</span>
          </div>
          <Gauge value={coverage} good={coverage >= 70} />
        </div>

        {stats.freeform > 0 && (
          <p className="tiny muted" style={{ marginTop: 8 }}>
            이 중 {stats.freeform}종목은 케이블·프리웨이트라 트레이너가 현장에서
            변형해 쓸 수 있습니다.
          </p>
        )}

        {stats.split === 0 && (
          <Note kind="stop" title="아직 루틴을 만들 수 없습니다">
            <p className="small">
              기구가 부족해 주 2회 전신 루틴도 완성되지 않습니다.
              회원 검색 결과에서 &lsquo;루틴 제공&rsquo;으로 표시되지 않습니다.
            </p>
          </Note>
        )}
        {stats.split >= 2 && stats.split < 4 && (
          <Note kind="volt" title={`주 ${stats.split}회까지 가능합니다`}>
            <p className="small">
              분할 운동을 찾는 회원은 아직 놓칩니다. 아래에서 미등록 기구를
              눌러보면 뭐가 열리는지 미리 보여드립니다.
            </p>
          </Note>
        )}
        {stats.split >= 4 && (
          <Note kind="go" title={`주 ${stats.split}회 분할까지 만들어집니다`}>
            <p className="small">초보부터 상급자까지 전 구간 루틴이 나옵니다.</p>
          </Note>
        )}
      </Card>

      {/* ── 체크 목록 ── */}
      <div className="cols2">
        {CATEGORY_ORDER.filter((c) => byCat[c]).map((cat) => (
          <Card key={cat} title={CATEGORY_LABEL[cat] ?? cat}>
            {byCat[cat].map((m) => {
              const on = owned.has(m.code);
              const mine = photosOf(m.code);
              const impact = !on ? machineImpact([...owned], m.code) : null;
              const opens = impact ? impact.after - impact.before : 0;
              return (
                <div key={m.code} style={{ borderBottom: '1px solid var(--line-2)', padding: '10px 0' }}>
                  <div className="row" style={{ gap: 12 }}>
                    <button
                      aria-pressed={on}
                      onClick={() => toggle(m.code)}
                      style={{
                        width: 24, height: 24, flex: 'none', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                        background: on ? 'var(--ink)' : '#fff',
                        color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13,
                      }}
                    >{on ? '✓' : ''}</button>

                    <button
                      className="grow"
                      style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0 }}
                      onClick={() => (on ? toggle(m.code) : setPeek(peek === m.code ? null : m.code))}
                    >
                      <div className="row row--wrap" style={{ gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14.5, opacity: on ? 1 : 0.6 }}>
                          {m.name}
                        </span>
                        {m.generative && <Chip kind="sub">변형 자유</Chip>}
                      </div>
                      <div className="list__meta">
                        {on
                          ? `${m.provides.length}개 역량${m.step ? ` · 최소 ${m.step}kg 단위` : ''}`
                          : opens > 0
                            ? `등록하면 ${opens}종목이 열립니다`
                            : '이미 열려 있는 종목뿐입니다'}
                      </div>
                    </button>

                    {on && (
                      <button
                        className="btn btn--sm btn--ghost"
                        onClick={() => { setPhotoTarget(m.code); fileRef.current?.click(); }}
                        disabled={busy}
                      >
                        {mine.length ? `사진 ${mine.length}` : '사진'}
                      </button>
                    )}
                  </div>

                  {/* 미등록 기구를 누르면 뭐가 열리는지 미리 보여준다 */}
                  {peek === m.code && opens > 0 && (
                    <div className="note note--volt" style={{ margin: '8px 0 0' }}>
                      <p className="tiny" style={{ margin: 0 }}>
                        <strong>{impact.unlocks.slice(0, 6).join(', ')}</strong>
                        {impact.unlocks.length > 6 && ` 외 ${impact.unlocks.length - 6}개`}
                      </p>
                    </div>
                  )}

                  {/* 올린 사진 */}
                  {mine.length > 0 && (
                    <div className="row row--wrap" style={{ gap: 6, marginTop: 8 }}>
                      {mine.map((p) => (
                        <div key={p.id} className="photo photo--sm">
                          {p.url
                            ? <img src={p.url} alt={p.caption ?? m.name} />
                            : <span className="photo__ph" style={{ background: p.tone }} />}
                          <button className="photo__x" onClick={() => removePhoto(p)} aria-label="사진 삭제">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        ))}
      </div>

      <Note title="사진을 올려주세요">
        <p className="small">
          회원이 헬스장을 고를 때 &lsquo;레그컬 있음&rsquo;이라는 글자보다 사진 한 장이
          더 많은 걸 말해줍니다. 브랜드도, 상태도, 몇 대인지도요.
        </p>
      </Note>

      <Note title="증량 단위를 꼭 확인해주세요">
        <p className="small">
          2.5kg 원판이 없는데 있다고 등록하면, 회원에게 세팅할 수 없는 중량이
          안내됩니다. 스택 머신은 보통 5kg, 레그프레스는 10kg 단위입니다.
        </p>
      </Note>

      {!saved && (
        <button className="btn btn--block" onClick={save} disabled={busy}>
          {busy ? '저장하는 중…' : '변경사항 저장'}
        </button>
      )}
    </>
  );
}
