import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar, Card, Chip, Field, Note } from '../../ui/bits.jsx';
import { useSession } from '../../lib/session.jsx';
import {
  myTrainerProfile, updateTrainerProfile, listSpecialtyTags,
} from '../../lib/api.js';

const KIND_OPTS = [
  { key: 'career', label: '경력' },
  { key: 'cert', label: '자격' },
  { key: 'result', label: '성과' },
  { key: 'media', label: '콘텐츠' },
];

/* 트레이너 탭 — 이력·분야·포트폴리오 직접 수정 */

export default function TrainerProfileEdit() {
  const { signOut } = useSession();
  const nav = useNavigate();
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      const [me, t] = await Promise.all([myTrainerProfile(), listSpecialtyTags()]);
      setTags(t);
      setForm({
        headline: me.headline || '',
        bio: me.bio || '',
        years: me.years || 1,
        price_per_session: me.price_per_session || 50000,
        specialties: [...(me.specialties || [])],
        certsText: (me.certs || []).join(', '),
        accepts_new: me.accepts_new !== false,
        portfolio: (me.portfolio || []).map((p) => ({ ...p })),
      });
    })();
  }, []);

  const toggleSpec = (tag) => {
    setForm((f) => ({
      ...f,
      specialties: f.specialties.includes(tag)
        ? f.specialties.filter((x) => x !== tag)
        : [...f.specialties, tag],
    }));
  };

  const patchPf = (i, patch) => {
    setForm((f) => ({
      ...f,
      portfolio: f.portfolio.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    }));
  };

  const addPf = () => {
    setForm((f) => ({
      ...f,
      portfolio: [
        ...f.portfolio,
        { id: `pf-${Date.now()}`, kind: 'career', year: '', title: '', detail: '' },
      ],
    }));
  };

  const removePf = (i) => {
    setForm((f) => ({
      ...f,
      portfolio: f.portfolio.filter((_, idx) => idx !== i),
    }));
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await updateTrainerProfile({
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        years: Number(form.years) || 1,
        price_per_session: Number(form.price_per_session) || 0,
        specialties: form.specialties,
        certs: form.certsText.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        accepts_new: form.accepts_new,
        portfolio: form.portfolio.filter((p) => p.title.trim()),
      });
      setMsg('프로필을 저장했습니다. 회원 앱에 바로 반영됩니다.');
    } finally {
      setBusy(false);
    }
  };

  if (!form) {
    return (
      <>
        <TopBar title="내 프로필" />
        <Card><p className="muted small">불러오는 중…</p></Card>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="내 프로필"
        sub="이력 · 포트폴리오"
        right={
          <button type="button" className="btn btn--sm" onClick={save} disabled={busy}>
            {busy ? '…' : '저장'}
          </button>
        }
      />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Card title="소개">
        <Field label="한 줄 소개">
          <input
            className="input"
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
          />
        </Field>
        <Field label="상세 소개">
          <textarea
            className="input"
            rows={4}
            style={{ minHeight: 96, resize: 'vertical' }}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </Field>
        <div className="rowfields">
          <Field label="경력 (년)">
            <input
              className="input input--num"
              value={form.years}
              onChange={(e) => setForm({ ...form, years: e.target.value })}
            />
          </Field>
          <Field label="회당 희망가">
            <input
              className="input input--num"
              value={form.price_per_session}
              onChange={(e) => setForm({ ...form, price_per_session: e.target.value })}
            />
          </Field>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 4 }}>
          <input
            type="checkbox"
            checked={form.accepts_new}
            onChange={(e) => setForm({ ...form, accepts_new: e.target.checked })}
          />
          <span className="small">신규 PT 모집 중</span>
        </label>
      </Card>

      <Card title="전문 분야" note="회원이 찾기 필터에서 쓰는 태그">
        <div className="row row--wrap" style={{ gap: 6 }}>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`chip ${form.specialties.includes(tag) ? 'chip--pick' : ''}`}
              onClick={() => toggleSpec(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </Card>

      <Card title="자격증">
        <Field label="쉼표로 구분">
          <input
            className="input"
            placeholder="NSCA-CPT, 생활스포츠지도사 2급"
            value={form.certsText}
            onChange={(e) => setForm({ ...form, certsText: e.target.value })}
          />
        </Field>
      </Card>

      <Card title="포트폴리오">
        {form.portfolio.map((p, i) => (
          <div key={p.id} className="exedit">
            <div className="row row--wrap" style={{ gap: 6, marginBottom: 8 }}>
              {KIND_OPTS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  className={`chip ${p.kind === k.key ? 'chip--pick' : ''}`}
                  onClick={() => patchPf(i, { kind: k.key })}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <Field label="연도">
              <input className="input" value={p.year} onChange={(e) => patchPf(i, { year: e.target.value })} />
            </Field>
            <Field label="제목">
              <input className="input" value={p.title} onChange={(e) => patchPf(i, { title: e.target.value })} />
            </Field>
            <Field label="설명">
              <input className="input" value={p.detail} onChange={(e) => patchPf(i, { detail: e.target.value })} />
            </Field>
            <button type="button" className="btn btn--sm btn--stop" onClick={() => removePf(i)}>
              항목 삭제
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={addPf}>
          + 포트폴리오 추가
        </button>
      </Card>

      <button type="button" className="btn btn--block" onClick={save} disabled={busy}>
        {busy ? '저장 중…' : '프로필 저장'}
      </button>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        style={{ marginTop: 8 }}
        onClick={() => { signOut(); nav('/'); }}
      >
        로그아웃
      </button>
    </>
  );
}
