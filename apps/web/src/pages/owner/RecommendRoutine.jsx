import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { TopBar, Card, Field, Note, Chip } from '../../ui/bits.jsx';
import {
  availableExercises, saveOwnerTemplate, getGym,
} from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';

const GOALS = [
  { key: 'hypertrophy', label: '근비대' },
  { key: 'fatloss', label: '감량' },
  { key: 'strength', label: '스트렝스' },
  { key: 'conditioning', label: '컨디션' },
];

export default function OwnerRecommend() {
  const { session } = useSession();
  const gymId = session.gymId || 'g-1';
  const nav = useNavigate();

  const [title, setTitle] = useState('관장 추천 · 입문 루틴');
  const [goal, setGoal] = useState('hypertrophy');
  const [days, setDays] = useState(3);
  const [level, setLevel] = useState(1);
  const [preview, setPreview] = useState(null);
  const [gymName, setGymName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const rebuild = async () => {
    const [ex, gym] = await Promise.all([
      availableExercises(gymId, level),
      getGym(gymId),
    ]);
    setGymName(gym?.name || '');
    const body = buildRoutine({
      available: ex,
      daysPerWeek: Number(days) || 3,
      goal,
      level: Number(level) || 1,
      stats: {},
    });
    setPreview(body);
  };

  useEffect(() => { rebuild(); }, [gymId, days, goal, level]);

  const publish = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await saveOwnerTemplate({
        gymId,
        title: title.trim() || '관장 추천 루틴',
        goal,
        level,
        days,
        body: preview,
      });
      setMsg('회원 앱에 추천 루틴으로 게시했습니다.');
      setTimeout(() => nav('/o'), 1200);
    } catch (e) {
      setMsg(e.message || '게시 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="추천 루틴" sub={gymName || '보유 기구 기준'} back />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Note kind="volt" title="이 헬스장 기구로만">
        <p className="small" style={{ margin: 0 }}>
          회원이 「관장님 추천」에서 가져가면 사본이 생깁니다. 기구 목록이 바뀌면 템플릿도 다시 맞춰집니다.
        </p>
      </Note>

      <Card title="설정">
        <Field label="제목">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="목표">
          <div className="row row--wrap">
            {GOALS.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`chip ${goal === g.key ? 'chip--pick' : ''}`}
                onClick={() => setGoal(g.key)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="rowfields">
          <Field label="주당 일수">
            <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}일</option>)}
            </select>
          </Field>
          <Field label="난이도">
            <select className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              <option value={1}>입문</option>
              <option value={2}>중급</option>
              <option value={3}>고급</option>
            </select>
          </Field>
        </div>
        <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={rebuild}>
          미리보기 다시 짜기
        </button>
      </Card>

      {preview && (
        <Card title="미리보기" note={`종목 ${preview.days.reduce((a, d) => a + d.items.length, 0)} · 경고 ${preview.warnings?.length || 0}`}>
          {preview.warnings?.length > 0 && (
            <Note kind="stop"><p className="small">{preview.warnings.join(' / ')}</p></Note>
          )}
          {preview.days.map((d) => (
            <div key={d.day_index} style={{ marginBottom: 14 }}>
              <strong style={{ fontSize: 14 }}>{d.name}</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {d.items.map((it) => (
                  <li key={it.exercise_code + it.name} className="small" style={{ marginBottom: 4 }}>
                    {it.name}
                    <span className="muted"> · {it.machine_name || '맨몸'}</span>
                    {!it.duration_min && (
                      <span className="muted"> · {it.sets}×{it.rep_range?.[0]}–{it.rep_range?.[1]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      <button type="button" className="btn btn--block" disabled={busy || !preview} onClick={publish}>
        {busy ? '게시 중…' : '회원에게 추천으로 게시'}
      </button>
    </>
  );
}
