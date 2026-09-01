import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { editableToItem } from '@gymlink/core/catalog';
import { TopBar, Card, Field, Note, Chip } from '../../ui/bits.jsx';
import ExercisePicker, { toEditableExercise } from '../../ui/ExercisePicker.jsx';
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
  const gymId = session.gymId;
  const nav = useNavigate();

  const [title, setTitle] = useState('우리 헬스장 입문 루틴');
  const [goal, setGoal] = useState('hypertrophy');
  const [level, setLevel] = useState(1);
  const [preview, setPreview] = useState(null);
  const [gymName, setGymName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [available, setAvailable] = useState([]);
  const [dayIdx, setDayIdx] = useState(0);
  const [query, setQuery] = useState('');

  const load = async () => {
    if (!gymId) return;
    const [ex, gym] = await Promise.all([
      availableExercises(gymId, level),
      getGym(gymId),
    ]);
    setAvailable(ex);
    setGymName(gym?.name || '');
    setPreview((current) => current || { days: [{ day_index: 0, name: 'DAY 1', items: [] }], warnings: [] });
  };

  const fillDraft = async () => {
    if (!gymId) return;
    const ex = await availableExercises(gymId, level);
    setAvailable(ex);
    const body = buildRoutine({
      available: ex,
      daysPerWeek: Math.max(2, preview?.days?.length || 3),
      goal,
      level: Number(level) || 1,
      stats: {},
    });
    setPreview(body);
  };

  useEffect(() => { load(); }, [gymId, level]);

  if (!gymId) return <><TopBar title="우리 헬스장 루틴 만들기" back /><Card><Note kind="stop"><p className="small">먼저 운영할 헬스장 등록이 필요합니다.</p></Note></Card></>;

  const publish = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await saveOwnerTemplate({
        gymId,
        title: title.trim() || '관장 추천 루틴',
        goal,
        level,
        days: preview.days.length,
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

  const addExercise = (choice) => {
    const item = editableToItem(toEditableExercise(choice));
    setPreview((current) => ({
      ...current,
      days: current.days.map((day, index) => (
        index === dayIdx ? { ...day, items: [...day.items, item] } : day
      )),
    }));
    setQuery('');
  };

  const removeExercise = (indexToRemove) => {
    setPreview((current) => ({
      ...current,
      days: current.days.map((day, index) => (
        index === dayIdx ? { ...day, items: day.items.filter((_, itemIndex) => itemIndex !== indexToRemove) } : day
      )),
    }));
  };

  const patchItem = (itemIndex, fields) => setPreview((current) => ({
    ...current,
    days: current.days.map((day, index) => index === dayIdx ? {
      ...day, items: day.items.map((item, ii) => ii === itemIndex ? { ...item, ...fields } : item),
    } : day),
  }));

  const patchDay = (fields) => setPreview((current) => ({
    ...current, days: current.days.map((day, index) => index === dayIdx ? { ...day, ...fields } : day),
  }));

  const addDay = () => setPreview((current) => {
    const next = current.days.length;
    setDayIdx(next);
    return { ...current, days: [...current.days, { day_index: next, name: `DAY ${next + 1}`, items: [] }] };
  });

  const removeDay = () => {
    if (preview.days.length <= 1) return;
    setPreview((current) => ({ ...current, days: current.days.filter((_, i) => i !== dayIdx).map((day, i) => ({ ...day, day_index: i })) }));
    setDayIdx(Math.max(0, dayIdx - 1));
  };

  return (
    <>
      <TopBar title="우리 헬스장 루틴 만들기" sub={gymName || '회원 공개 루틴'} back />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Note kind="volt" title="관장이 직접 구성하고 회원이 가져갑니다">
        <p className="small" style={{ margin: 0 }}>
          일반 루틴처럼 운동·세트·반복·휴식을 직접 편집합니다. 종목을 고를 때 현재 헬스장 기구로 가능한 운동이 먼저 뜹니다.
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
          <Field label="난이도">
            <select className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              <option value={1}>입문</option>
              <option value={2}>중급</option>
              <option value={3}>고급</option>
            </select>
          </Field>
        </div>
        <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={fillDraft}>
          추천 초안 채우기 (선택)
        </button>
      </Card>

      {preview && (
        <Card title="루틴 편집" note={`${preview.days.length}일 · 종목 ${preview.days.reduce((a, d) => a + d.items.length, 0)}개`}>
          {preview.warnings?.length > 0 && (
            <Note kind="stop"><p className="small">{preview.warnings.join(' / ')}</p></Note>
          )}
          <div className="row row--wrap" style={{ marginBottom: 12 }}>
            {preview.days.map((day, index) => (
              <button key={day.day_index ?? index} type="button" className={`btn btn--sm ${dayIdx === index ? '' : 'btn--ghost'}`} onClick={() => setDayIdx(index)}>{day.name}</button>
            ))}
            <button type="button" className="btn btn--sm btn--ghost" onClick={addDay}>+ 운동일</button>
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <input className="input grow" aria-label="운동일 이름" value={preview.days[dayIdx]?.name || ''} onChange={(e) => patchDay({ name: e.target.value })} />
            {preview.days.length > 1 && <button type="button" className="btn btn--sm btn--ghost" onClick={removeDay}>이 운동일 삭제</button>}
          </div>
          <ExercisePicker available={available} query={query} onQueryChange={setQuery} onAdd={addExercise} />
          <ul className="list" style={{ marginTop: 12 }}>
            {preview.days[dayIdx]?.items.map((item, index) => (
              <li key={`${item.exercise_code}-${index}`} className="owner-routine-item">
                <div className="list__item" style={{ cursor: 'default' }}>
                  <div className="list__body">
                    <div className="list__title">{item.name}</div>
                    <div className="list__meta">{item.machine_name || '맨몸'}{!item.duration_min ? ` · ${item.sets}세트 ${item.rep_range?.[0]}–${item.rep_range?.[1]}회` : ''}</div>
                  </div>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => removeExercise(index)}>삭제</button>
                </div>
                {!item.duration_min && <div className="owner-routine-item__fields">
                  <Field label="세트"><input className="input" type="number" min="1" max="20" value={item.sets || 3} onChange={(e) => patchItem(index, { sets: Number(e.target.value) || 1 })} /></Field>
                  <Field label="최소 반복"><input className="input" type="number" min="1" value={item.rep_range?.[0] || 8} onChange={(e) => patchItem(index, { rep_range: [Number(e.target.value) || 1, item.rep_range?.[1] || 12] })} /></Field>
                  <Field label="최대 반복"><input className="input" type="number" min="1" value={item.rep_range?.[1] || 12} onChange={(e) => patchItem(index, { rep_range: [item.rep_range?.[0] || 8, Number(e.target.value) || 1] })} /></Field>
                  <Field label="휴식(초)"><input className="input" type="number" min="0" step="15" value={item.rest_sec || 90} onChange={(e) => patchItem(index, { rest_sec: Number(e.target.value) || 0 })} /></Field>
                </div>}
                <Field label="코칭 메모"><input className="input" placeholder="자세·강도·대체 동작 안내" value={item.setup_note || item.note || ''} onChange={(e) => patchItem(index, { setup_note: e.target.value })} /></Field>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <button type="button" className="btn btn--block" disabled={busy || !preview} onClick={publish}>
        {busy ? '게시 중…' : '회원에게 추천으로 게시'}
      </button>
    </>
  );
}
