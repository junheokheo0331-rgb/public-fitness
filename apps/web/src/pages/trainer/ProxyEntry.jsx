import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { parseBodySheet, toRecord } from '@gymlink/core/body';
import { TopBar, Card, Chip, Note, Field, Empty } from '../../ui/bits.jsx';
import { myClients, saveBody } from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';
import { preprocess, readSheet } from '../../lib/ocr.js';

/* 트레이너 대리입력.

   회원 본인이 넣는 것과 법적으로 다른 물건이다.
   회원 → 헬스장 → 우리로 정보가 흐르므로 제3자 제공 동의가 하나 더 필요하다.

   화면에서 막는 건 안내일 뿐이고, 실제로 막는 건 DB의 RLS 정책이다.
   (PT 관계 + 민감정보 동의 + 대리입력 동의 + consent_id, 넷 다 있어야 INSERT 통과)
   화면 검사를 우회해도 서버에서 거부된다. 그게 맞는 순서다. */

const FIELD_DEFS = [
  { key: 'weight_kg',          label: '체중',       unit: 'kg' },
  { key: 'skeletal_muscle_kg', label: '골격근량',   unit: 'kg' },
  { key: 'body_fat_kg',        label: '체지방량',   unit: 'kg' },
  { key: 'body_fat_pct',       label: '체지방률',   unit: '%'  },
];

export default function ProxyEntry() {
  const { memberId } = useParams();
  const { session } = useSession();
  const fileRef = useRef(null);

  const [client, setClient] = useState(undefined);
  const [phase, setPhase] = useState('idle');   // idle | reading | review | saving | done
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState(null);
  const [draft, setDraft] = useState({});
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(null);

  useEffect(() => {
    myClients().then((cs) => setClient(cs.find((c) => c.id === memberId) ?? null));
  }, [memberId]);

  if (client === undefined) {
    return <><TopBar title="측정 결과 입력" back /><Card><p className="muted small">불러오는 중…</p></Card></>;
  }
  if (!client) {
    return <><TopBar title="측정 결과 입력" back /><Card><Empty title="담당 회원이 아닙니다" /></Card></>;
  }

  /* ── 동의 게이트 ── */
  if (!client.consent_proxy) {
    return (
      <>
        <TopBar title={client.name} sub="측정 결과 입력" back />
        <Card title="대신 입력할 수 없습니다">
          <p className="small">
            {client.name} 회원이 <strong>대리 입력에 동의하지 않았습니다.</strong>
          </p>
          <hr className="hr" />
          <p className="small muted">왜 막혀 있나요</p>
          <p className="small">
            체성분은 개인정보보호법상 건강에 관한 정보입니다. 회원 본인이 넣는 것과
            달리, 트레이너가 대신 넣으면 회원의 정보가 제3자를 거쳐 전달되는 구조가
            되어 별도의 동의가 필요합니다.
          </p>
          <hr className="hr" />
          <p className="small muted">어떻게 하면 되나요</p>
          <p className="small">
            회원에게 앱 &gt; 내 정보 &gt; 동의 관리에서 <strong>&lsquo;트레이너의 대리 입력&rsquo;</strong>을
            켜 달라고 안내해주세요. 회원이 직접 입력하는 건 지금도 됩니다.
          </p>
          <Note kind="volt" style={{ marginTop: 12 }}>
            <p className="small">
              동의를 대신 눌러주지 마세요. 동의한 사람과 누른 사람이 다르면
              그 동의는 효력이 없고, 기록도 함께 무효가 됩니다.
            </p>
          </Note>
        </Card>
      </>
    );
  }

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
      setError('사진을 읽지 못했습니다. 결과지가 화면에 꽉 차게 다시 찍어보세요.');
      setPhase('idle');
    } finally {
      e.target.value = '';
    }
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
          memberId,
          gymId: session.gymId,
          measuredAt: new Date(`${measuredAt}T09:00:00`).toISOString(),
          source: 'proxy',
          enteredBy: session.id,
          // 실제로는 회원의 proxy_entry 동의 행 id 를 서버에서 조회해 넣는다.
          // 목 모드에서는 자리만 채운다. 없으면 toRecord() 가 예외를 던진다.
          consentId: `consent-${memberId}-proxy`,
        },
      );
      await saveBody(rec);
      setPhase('done');
    } catch (err) {
      console.error(err);
      setError(err.message || '저장하지 못했습니다.');
      setPhase('review');
    }
  }

  return (
    <>
      <TopBar title={client.name} sub="측정 결과 입력" back
        right={<Chip kind="go">대리입력 동의됨</Chip>} />

      {error && <Note kind="stop"><p className="small">{error}</p></Note>}

      {phase === 'done' && (
        <Note kind="go" title="저장했습니다">
          <p className="small">
            {client.name} 회원의 앱에도 바로 보입니다. 회원이 언제든 수정하거나
            삭제할 수 있습니다.
          </p>
        </Note>
      )}

      {phase === 'reading' && (
        <Card title="읽는 중">
          <p className="small muted">사진은 이 기기 안에서만 처리됩니다.</p>
          <div className="gauge" style={{ marginTop: 10 }}>
            <div className="gauge__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="tiny muted mono" style={{ marginTop: 6 }}>{Math.round(progress * 100)}%</p>
        </Card>
      )}

      {(phase === 'review' || phase === 'saving') && parsed && (
        <Card title="숫자 확인">
          {parsed.confidence != null && (
            <div className="row row--wrap" style={{ marginBottom: 10 }}>
              <Chip kind={parsed.lowConfidence ? 'sub' : 'go'}>
                인식 신뢰도 {Math.round(parsed.confidence * 100)}%
              </Chip>
            </div>
          )}
          {parsed.issues.map((msg, i) => (
            <Note key={i} kind="volt"><p className="small">{msg}</p></Note>
          ))}

          <Field label="측정일">
            <input className="input input--num" type="date"
              value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} />
          </Field>

          <div className="rowfields">
            {FIELD_DEFS.map((f) => {
              const conf = parsed.fields?.[f.key]?.confidence;
              return (
                <Field key={f.key} label={`${f.label} (${f.unit})`}>
                  <input
                    className={`input input--num ${conf != null && conf < 0.7 ? 'input--warn' : ''}`}
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
        </Card>
      )}

      {(phase === 'idle' || phase === 'done') && (
        <Card title="새 측정 결과">
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            onChange={onPick} className="sr" />
          <button className="btn btn--block" onClick={() => fileRef.current?.click()}>
            결과지 촬영해서 입력
          </button>
          <p className="tiny muted" style={{ marginTop: 10 }}>
            입력한 사람이 기록에 남습니다. 회원 화면에도 &lsquo;트레이너 입력&rsquo;으로 표시됩니다.
          </p>
        </Card>
      )}
    </>
  );
}
