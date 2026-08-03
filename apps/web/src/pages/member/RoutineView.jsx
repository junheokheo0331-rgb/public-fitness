import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { TopBar, Card, Chip, Note, Plate, Stack } from '../../ui/bits.jsx';
import {
  myMembership, availableExercises, getSavedRoutine,
  saveRoutine, getExerciseStats,
} from '../../lib/api.js';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';

export default function RoutineView() {
  const { routineId } = useParams();
  const nav = useNavigate();
  const { store } = useWorkout();
  const [data, setData] = useState(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [savedMsg, setSavedMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const ms = await myMembership();
    const gymId = ms?.gym_id || 'g-1';
    const [ex, meta, stats] = await Promise.all([
      availableExercises(gymId),
      getSavedRoutine(routineId),
      getExerciseStats(),
    ]);
    const built = meta?.body?.days?.length
      ? meta.body
      : buildRoutine({
        available: ex,
        daysPerWeek: meta?.days ?? 3,
        goal: meta?.goal ?? 'hypertrophy',
        level: meta?.level ?? 1,
        stats,
      });
    setData({ meta, built, gymId, available: ex, stats });
  };

  useEffect(() => { load(); }, [routineId]);

  async function save() {
    const { meta, built, gymId } = data;
    await saveRoutine({
      gymId, title: meta?.title ?? '내 루틴',
      body: built, goal: meta?.goal ?? 'hypertrophy', level: meta?.level ?? 1,
      days: built.days.length, routineId: meta?.id, origin: meta?.origin || 'member',
    });
    setSavedMsg('저장했습니다.');
    setTimeout(() => setSavedMsg(null), 2500);
  }

  async function rebuildToGym() {
    if (!data) return;
    setBusy(true);
    try {
      const built = buildRoutine({
        available: data.available,
        daysPerWeek: data.meta?.days ?? data.built.days.length ?? 3,
        goal: data.meta?.goal ?? 'hypertrophy',
        level: data.meta?.level ?? 2,
        stats: data.stats,
      });
      const origin = (data.meta?.origin === 'trainer' || data.meta?.origin === 'owner')
        ? data.meta.origin
        : 'auto';
      await saveRoutine({
        gymId: data.gymId,
        title: data.meta?.title ?? '기구 맞춤 루틴',
        body: built,
        goal: data.meta?.goal ?? 'hypertrophy',
        level: data.meta?.level ?? 2,
        days: built.days.length,
        routineId: data.meta?.id,
        origin,
      });
      setSavedMsg('이 헬스장 기구에 맞춰 다시 짰습니다.');
      await load();
      setTimeout(() => setSavedMsg(null), 2500);
    } finally {
      setBusy(false);
    }
  }

  const startWorkout = () => {
    const day = data.built.days[dayIdx];
    store.startFromGymDay({
      title: `${data.meta?.title || '루틴'} · ${day.name}`,
      day,
      sourceRoutineId: routineId,
    });
    nav('/workout/live');
  };

  if (!data) return <><TopBar title="루틴" back /><Card><p className="muted small">불러오는 중…</p></Card></>;

  const { meta, built } = data;
  const day = built.days[dayIdx];
  const stale = meta?.stale || meta?.warnings?.length;

  return (
    <>
      <TopBar
        title={meta?.title ?? '루틴'}
        sub={`주 ${built.days.length}회`}
        back
        right={<button type="button" className="btn btn--sm" onClick={save}>저장</button>}
      />

      {savedMsg && <Note kind="go"><p className="small">{savedMsg}</p></Note>}

      {meta?.origin === 'trainer' && (
        <Note kind="volt" title="트레이너가 보낸 숙제입니다">
          {meta.note && <p className="small">{meta.note}</p>}
          {meta.due && <p className="small">기한 ~{String(meta.due).replace(/-/g, '.')}</p>}
        </Note>
      )}

      {meta?.origin === 'owner' && (
        <Note kind="volt" title="관장님 추천 루틴">
          <p className="small">이 헬스장 기구 기준으로 관장이 공개한 루틴입니다.</p>
        </Note>
      )}

      {!!stale && (
        <Note kind="stop" title="기구가 바뀌었을 수 있습니다">
          {(meta.warnings || []).map((w, i) => <p key={i} className="small">{w}</p>)}
          <button type="button" className="btn btn--sm" style={{ marginTop: 8 }} disabled={busy} onClick={rebuildToGym}>
            기구에 맞춰 다시 짜기
          </button>
        </Note>
      )}

      <button type="button" className="btn btn--block" onClick={startWorkout}>
        이 날 운동 시작
      </button>
      {(meta?.origin === 'auto' || meta?.origin === 'member' || !meta?.origin) && (
        <button
          type="button"
          className="btn btn--ghost btn--block btn--sm"
          style={{ marginTop: 8 }}
          disabled={busy}
          onClick={rebuildToGym}
        >
          {busy ? '조정 중…' : '보유 기구에 맞춰 다시 짜기'}
        </button>
      )}

      <div className="row row--wrap" style={{ margin: '12px 0' }}>
        {built.days.map((d, i) => (
          <button
            key={d.day_index ?? i}
            type="button"
            className={`btn btn--sm ${i === dayIdx ? '' : 'btn--ghost'}`}
            onClick={() => setDayIdx(i)}
          >
            {d.name}
          </button>
        ))}
      </div>

      {day?.items?.map((it) => (
        <Card key={(it.exercise_code || it.name) + (it.id || '')}>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="row row--wrap" style={{ gap: 6, marginBottom: 4 }}>
                <strong style={{ fontSize: 15.5 }}>{it.name}</strong>
                {it.is_substitute && <Chip kind="sub">대체 기구</Chip>}
                {it.is_freeform && <Chip kind="sub">변형 가능</Chip>}
              </div>
              <div className="row row--wrap" style={{ gap: 5 }}>
                <Chip kind="machine">{it.machine_name ?? '맨몸'}</Chip>
              </div>
              {(it.setup_note || it.note) && (
                <div className="tiny muted" style={{ marginTop: 5 }}>{it.setup_note || it.note}</div>
              )}
              <div className="small muted" style={{ marginTop: 8 }}>
                {it.duration_min
                  ? `${it.duration_min}분 · ${it.intensity || ''}`
                  : `${it.sets}세트 × ${it.rep_range?.[0]}–${it.rep_range?.[1]}회 · RIR ${it.target_rir} · 휴식 ${it.rest_sec}초`}
              </div>
              {!it.duration_min && <Stack total={it.sets} done={0} current={0} />}
            </div>

            {it.suggested_kg != null
              ? <Plate value={it.suggested_kg} unit="kg" sub="지난 기록 기준" />
              : it.duration_min
                ? <Plate value={it.duration_min} unit="분" ghost />
                : <Plate value="—" unit="kg" ghost sub="감으로 시작" />}
          </div>
        </Card>
      ))}

      {(built.warnings?.length > 0) && (
        <Note kind="volt" title="이 헬스장에 없는 기구">
          {built.warnings.map((w, i) => <p key={i}>{w}</p>)}
        </Note>
      )}
    </>
  );
}
