import { useEffect, useRef, useState } from 'react';
import { parseBodySheet, toRecord } from '@gymlink/core/body';
import { BC_SOURCES } from '@gymlink/core/constants';
import { TopBar, Card, Chip, Note, Field, Plate, Empty } from '../../ui/bits.jsx';
import { bodyLog, saveBody, getConsents, grantConsent } from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';
import { preprocess, readSheet } from '../../lib/ocr.js';

/* 체성분 기록.

   흐름: 동의 → 촬영 → 기기 내 인식 → 사람이 확인 → 숫자만 저장

   ★ 사진은 서버로 가지 않는다. ★
   화면에서 그 사실을 말하고, 코드도 실제로 그렇게 되어 있다.
   말만 하고 올리면 그건 거짓말이고, 안 올리는데 말 안 하면
   사용자는 여전히 불안해한다. 둘 다 해야 한다.

   측정기 제조사 이름을 쓰지 않는다. 제휴로 오인되면 상표 문제가 된다. */

const FIELD_DEFS = [
  { key: 'weight_kg',          label: '체중',       unit: 'kg' },
  { key: 'skeletal_muscle_kg', label: '골격근량',   unit: 'kg' },
  { key: 'body_fat_kg',        label: '체지방량',   unit: 'kg' },
  { key: 'body_fat_pct',       label: '체지방률',   unit: '%'  },
  { key: 'bmr_kcal',           label: '기초대사량', unit: 'kcal' },
];

export default function Body() {
  const { session } = useSession();
  const fileRef = useRef(null);

  const [consents, setConsents] = useState(null);
  const [log, setLog] = useState([]);
  const [phase, setPhase] = useState('idle');   // idle | reading | review | saving
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState(null);
  const [draft, setDraft] = useState({});
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setConsents(await getConsents());
      setLog(await bodyLog(session.id));
    })();
  }, [session.id]);

  /* ---------- 동의 게이트 ---------- */
  if (consents && !consents.health_sensitive) {
    return (
      <>
        <TopBar title="체성분" />
        <Card title="체성분을 기록하려면 동의가 필요합니다">
          <p className="small">
            체중·골격근량·체지방률은 개인정보보호법상 건강에 관한 정보라서,
            다른 항목과 <strong>따로</strong> 동의를 받게 되어 있습니다.
            동의하지 않아도 나머지 기능은 그대로 쓸 수 있습니다.
          </p>
          <hr className="hr" />
          <p className="small muted">저장하는 것</p>
          <p className="small">측정일과 숫자 몇 개.</p>
          <p className="small muted" style={{ marginTop: 8 }}>저장하지 않는 것</p>
          <p className="small">결과지 사진. 인식은 휴대폰 안에서 끝나고 사진은 전송되지 않습니다.</p>
          <hr className="hr" />
          <p className="small">
            언제든 철회할 수 있고, 철회하면 기록도 함께 지워집니다.
          </p>
          <button
            className="btn btn--block"
            style={{ marginTop: 12 }}
            onClick={async () => {
              await grantConsent('health_sensitive');
              setConsents(await getConsents());
            }}
          >
            동의하고 시작하기
          </button>
        </Card>
      </>
    );
  }

  /* ---------- 촬영 → 인식 ---------- */
  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhase('reading');
    setProgress(0);
    try {
      const canvas = await preprocess(file);
      const text = await readSheet(canvas, setProgress);
      const p = parseBodySheet(text);
      setParsed(p);
      setDraft(Object.fromEntries(FIELD_DEFS.map((f) => [f.key, p.values[f.key] ?? ''])));
      setPhase('review');
    } catch (err) {
      console.error(err);
      setError('사진을 읽지 못했습니다. 밝은 곳에서 결과지가 화면에 꽉 차게 다시 찍어보세요.');
      setPhase('idle');
    } finally {
      e.target.value = '';   // 같은 파일 다시 고를 수 있게
    }
  }

  function startManual() {
    setParsed({ values: {}, fields: {}, confidence: null, issues: [], lowConfidence: false });
    setDraft(Object.fromEntries(FIELD_DEFS.map((f) => [f.key, ''])));
    setPhase('review');
  }

  async function save() {
    setPhase('saving');
    try {
      const values = {};
      for (const f of FIELD_DEFS) {
        const v = String(draft[f.key] ?? '').trim();
        if (v !== '') values[f.key] = Number(v);
      }
      const rec = toRecord(
        { values, confidence: parsed?.confidence ?? null },
        {
          memberId: session.id,
          gymId: session.gymId,
          measuredAt: new Date(`${measuredAt}T09:00:00`).toISOString(),
          source: parsed?.confidence == null ? 'manual' : 'photo_ocr',
        },
      );
      rec.verified_by_member = true;   // 사람이 화면에서 확인했다
      await saveBody(rec);
      setLog(await bodyLog(session.id));
      setPhase('idle');
      setParsed(null);
    } catch (err) {
      console.error(err);
      setError('저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setPhase('review');
    }
  }

  const latest = log[0];
  const prev = log[1];
  const delta = latest && prev
    ? {
        w: (latest.weight_kg - prev.weight_kg).toFixed(1),
        m: (latest.skeletal_muscle_kg - prev.skeletal_muscle_kg).toFixed(1),
        f: (latest.body_fat_pct - prev.body_fat_pct).toFixed(1),
      }
    : null;

  return (
    <>
      <TopBar title="체성분" sub="측정 결과를 기록해 두면 루틴에 반영됩니다" />

      {error && <Note kind="stop"><p className="small">{error}</p></Note>}

      {/* ── 인식 중 ── */}
      {phase === 'reading' && (
        <Card title="읽는 중">
          <p className="small muted">사진은 휴대폰 안에서만 처리됩니다. 전송하지 않습니다.</p>
          <div className="gauge" style={{ marginTop: 10 }}>
            <div className="gauge__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="tiny muted mono" style={{ marginTop: 6 }}>{Math.round(progress * 100)}%</p>
        </Card>
      )}

      {/* ── 확인 화면 ── */}
      {(phase === 'review' || phase === 'saving') && parsed && (
        <Card title="숫자가 맞는지 확인해주세요">
          {parsed.confidence != null && (
            <div className="row row--wrap" style={{ marginBottom: 10 }}>
              <Chip kind={parsed.lowConfidence ? 'sub' : 'go'}>
                인식 신뢰도 {Math.round(parsed.confidence * 100)}%
              </Chip>
              {parsed.lowConfidence && <Chip kind="sub">확인 필요</Chip>}
            </div>
          )}

          {parsed.issues.map((msg, i) => (
            <Note key={i} kind="volt"><p className="small">{msg}</p></Note>
          ))}

          <Field label="측정일">
            <input
              className="input input--num" type="date"
              value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)}
            />
          </Field>

          <div className="rowfields">
            {FIELD_DEFS.map((f) => {
              const conf = parsed.fields?.[f.key]?.confidence;
              const shaky = conf != null && conf < 0.7;
              return (
                <Field key={f.key} label={`${f.label} (${f.unit})`}>
                  <input
                    className={`input input--num ${shaky ? 'input--warn' : ''}`}
                    type="number" inputMode="decimal" step="0.1"
                    value={draft[f.key]}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                </Field>
              );
            })}
          </div>

          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn btn--ghost grow" onClick={() => { setPhase('idle'); setParsed(null); }}>
              취소
            </button>
            <button className="btn grow" onClick={save} disabled={phase === 'saving' || !draft.weight_kg}>
              {phase === 'saving' ? '저장하는 중…' : '저장'}
            </button>
          </div>

          <p className="tiny muted" style={{ marginTop: 10 }}>
            저장되는 것은 위 숫자와 측정일뿐입니다. 사진은 이 화면을 벗어나는 순간 사라집니다.
          </p>
        </Card>
      )}

      {/* ── 기본 화면 ── */}
      {phase === 'idle' && (
        <>
          {latest ? (
            <Card>
              <p className="eyebrow">최근 측정 · {latest.measured_at.replace(/-/g, '.')}</p>
              <div className="row row--between" style={{ alignItems: 'flex-start', marginTop: 6 }}>
                <Plate value={latest.weight_kg} unit="kg" sub={delta && `지난번 대비 ${delta.w > 0 ? '+' : ''}${delta.w}kg`} />
                <Plate value={latest.skeletal_muscle_kg} unit="kg 근육" ghost sub={delta && `${delta.m > 0 ? '+' : ''}${delta.m}`} />
                <Plate value={latest.body_fat_pct} unit="% 지방" ghost sub={delta && `${delta.f > 0 ? '+' : ''}${delta.f}`} />
              </div>
            </Card>
          ) : (
            <Card><Empty title="기록이 없습니다">결과지를 찍어서 시작해보세요.</Empty></Card>
          )}

          <Card title="새 기록">
            <input
              ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={onPick} className="sr"
            />
            <button className="btn btn--block" onClick={() => fileRef.current?.click()}>
              결과지 촬영해서 입력
            </button>
            <button className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={startManual}>
              숫자 직접 입력
            </button>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              인식은 휴대폰 안에서 처리하고, 사진은 저장하거나 전송하지 않습니다.
              읽은 숫자는 저장 전에 직접 확인하실 수 있습니다.
            </p>
          </Card>

          {log.length > 0 && (
            <Card title="지난 기록" flush>
              <ul className="list">
                {log.map((b) => (
                  <li key={b.id} className="list__item" style={{ cursor: 'default' }}>
                    <div className="list__body">
                      <div className="list__title mono">{b.measured_at.replace(/-/g, '.')}</div>
                      <div className="list__meta">
                        <Chip>{BC_SOURCES[b.source] ?? b.source}</Chip>
                      </div>
                    </div>
                    <div className="list__right">
                      <div>{b.weight_kg}kg</div>
                      <div className="tiny">근육 {b.skeletal_muscle_kg} · 지방 {b.body_fat_pct}%</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}
