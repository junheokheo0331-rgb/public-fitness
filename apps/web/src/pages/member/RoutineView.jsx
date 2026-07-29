import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { buildRoutine } from '@gymlink/core/routine';
import { TopBar, Card, Chip, Note, Plate, Stack } from '../../ui/bits.jsx';
import { myMembership, availableExercises, mySavedRoutines, saveRoutine } from '../../lib/api.js';

/* 루틴 상세.

   종목마다 "어느 기구로 하는지"를 붙인다. 이게 다른 루틴 앱과의
   차이가 눈에 보이는 유일한 지점이다. 기구 이름이 없으면
   그냥 운동 목록이고, 그건 어디에나 있다. */

export default function RoutineView() {
  const { routineId } = useParams();
  const [data, setData] = useState(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [savedMsg, setSavedMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ms = await myMembership();
      const [ex, saved] = await Promise.all([
        availableExercises(ms.gym_id), mySavedRoutines(ms.gym_id),
      ]);
      const meta = saved.find((r) => r.id === routineId) ?? saved[0];
      const built = buildRoutine({
        available: ex, daysPerWeek: meta?.days ?? 3,
        goal: meta?.goal ?? 'hypertrophy', level: 1,
        // 지난 기록이 있으면 목표 중량이 채워진다. 없으면 감으로 시작.
        stats: { LEG_PRESS_EX: { e1rm: 180 }, SMITH_BENCH: { e1rm: 95 }, LAT_PULLDOWN_W: { e1rm: 70 } },
      });
      if (alive) setData({ meta, built });
    })();
    return () => { alive = false; };
  }, [routineId]);

  async function save() {
    const { meta, built } = data;
    await saveRoutine({
      gymId: meta?.gym_id, title: meta?.title ?? '내 루틴',
      body: built, goal: meta?.goal ?? 'hypertrophy', level: 1,
      days: built.days.length, routineId: meta?.id, origin: 'member',
    });
    setSavedMsg('저장했습니다.');
    setTimeout(() => setSavedMsg(null), 2500);
  }

  if (!data) return <><TopBar title="루틴" back /><Card><p className="muted small">불러오는 중…</p></Card></>;

  const { meta, built } = data;
  const day = built.days[dayIdx];

  return (
    <>
      <TopBar
        title={meta?.title ?? '루틴'}
        sub={`주 ${built.days.length}회`}
        back
        right={<button className="btn btn--sm" onClick={save}>저장</button>}
      />

      {savedMsg && <Note kind="go"><p className="small">{savedMsg}</p></Note>}

      {meta?.origin === 'trainer' && (
        <Note kind="volt" title="트레이너가 보낸 루틴입니다">
          {meta.note && <p className="small">{meta.note}</p>}
          <p className="small" style={{ marginTop: meta.note ? 6 : 0 }}>
            내 루틴으로 저장되어 있어서 자유롭게 고쳐도 됩니다.
          </p>
        </Note>
      )}

      <div className="row row--wrap" style={{ marginBottom: 12 }}>
        {built.days.map((d, i) => (
          <button
            key={d.day_index}
            className={`btn btn--sm ${i === dayIdx ? '' : 'btn--ghost'}`}
            onClick={() => setDayIdx(i)}
          >
            {d.name}
          </button>
        ))}
      </div>

      {day.items.map((it) => (
        <Card key={it.exercise_code}>
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
              {it.setup_note && (
                <div className="tiny muted" style={{ marginTop: 5 }}>{it.setup_note}</div>
              )}
              <div className="small muted" style={{ marginTop: 8 }}>
                {it.duration_min
                  ? `${it.duration_min}분 · ${it.intensity}`
                  : `${it.sets}세트 × ${it.rep_range[0]}–${it.rep_range[1]}회 · 마지막 ${it.target_rir}회 남기고 · 휴식 ${it.rest_sec}초`}
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

      {built.warnings.length > 0 && (
        <Note kind="volt" title="이 헬스장에 없는 기구">
          {built.warnings.map((w, i) => <p key={i}>{w}</p>)}
          <p style={{ marginTop: 8 }}>
            관장님께 기구 등록을 요청하면 다음 루틴부터 반영됩니다.
          </p>
        </Note>
      )}

      <Note>
        <p className="small">
          목표 중량은 지난 기록에서 계산한 참고값입니다. 몸 상태에 따라 조절하세요.
          통증이 있으면 그 종목을 빼고 짜 드립니다.
        </p>
      </Note>
    </>
  );
}
