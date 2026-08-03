import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar, Card, Chip, Note, Plate, Stack, Empty } from '../../ui/bits.jsx';
import {
  myMembership, myPt, getGym, mySavedRoutines, createAutoRoutine,
  listGymTemplates, copyRoutine, memberHomework,
} from '../../lib/api.js';

const GOAL = {
  hypertrophy: '근비대', fatloss: '감량', strength: '스트렝스', conditioning: '컨디션',
};

export default function MyGym() {
  const nav = useNavigate();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const reload = useCallback(async () => {
    const ms = await myMembership();
    if (!ms) { setState({ none: true }); return; }
    const [gym, pt, routines, templates, hw] = await Promise.all([
      getGym(ms.gym_id),
      myPt(),
      mySavedRoutines(ms.gym_id),
      listGymTemplates(ms.gym_id),
      memberHomework('u-member'),
    ]);
    setState({ ms, gym, pt, routines, templates, hw });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (!state) return <><TopBar title="내 헬스장" /><Card><p className="muted small">불러오는 중…</p></Card></>;

  if (state.none) {
    return (
      <>
        <TopBar title="내 헬스장" />
        <Card>
          <Empty
            title="다니는 헬스장이 없습니다"
            action={<button type="button" className="btn" onClick={() => nav('/')}>주변 헬스장 보기</button>}
          >
            헬스장에서 등록하면 관장님이 회원 정보를 넣어주고, 여기에 나타납니다.
          </Empty>
        </Card>
      </>
    );
  }

  const { ms, gym, pt, routines, templates, hw } = state;
  const ptLeft = pt ? pt.total_sessions - pt.used_sessions : 0;
  const mine = routines.filter((r) => r.origin === 'auto' || r.origin === 'member');
  const fromOwner = routines.filter((r) => r.origin === 'owner');
  const fromTrainer = routines.filter((r) => r.origin === 'trainer');
  const openTemplates = templates.filter(
    (t) => !fromOwner.some((r) => r.title === t.title || r.id === t.id),
  );

  const makeAuto = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const row = await createAutoRoutine({
        gymId: ms.gym_id,
        days: 3,
        goal: 'hypertrophy',
        level: 2,
      });
      setMsg('이 헬스장 기구로 루틴을 만들었습니다.');
      nav(`/my/routine/${row.id}`);
    } catch (e) {
      setMsg(e.message || '생성 실패');
    } finally {
      setBusy(false);
    }
  };

  const takeTemplate = async (id) => {
    setBusy(true);
    try {
      const nid = await copyRoutine(id, ms.gym_id);
      setMsg('관장 추천을 내 루틴으로 가져왔습니다.');
      await reload();
      nav(`/my/routine/${nid}`);
    } catch (e) {
      setMsg(e.message || '가져오기 실패');
    } finally {
      setBusy(false);
    }
  };

  const renderList = (list) => (
    <ul className="list">
      {list.map((r) => (
        <li key={r.id}>
          <Link className="list__item" to={`/my/routine/${r.id}`}>
            <div className="list__body">
              <div className="row row--wrap" style={{ gap: 6 }}>
                <span className="list__title">{r.title}</span>
                {r.origin === 'trainer' && <Chip kind="sub">트레이너</Chip>}
                {r.origin === 'owner' && <Chip>관장님 추천</Chip>}
                {r.origin === 'auto' && <Chip kind="machine">기구 맞춤</Chip>}
                {r.stale && <Chip kind="stop">기구 확인</Chip>}
              </div>
              <div className="list__meta">
                주 {r.days}회 · {GOAL[r.goal] || r.goal}
                {r.due ? ` · ~${r.due.replace(/-/g, '.')}` : ''}
                {r.body?.days?.[0]?.items?.length
                  ? ` · ${r.body.days.reduce((a, d) => a + (d.items?.length || 0), 0)}종목`
                  : ''}
              </div>
              {r.warnings?.[0] && (
                <div className="tiny" style={{ color: 'var(--stop)', marginTop: 4 }}>{r.warnings[0]}</div>
              )}
            </div>
            <div className="list__right">→</div>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <TopBar title={gym.name} sub={`${ms.plan_name} · ${ms.ends_on.replace(/-/g, '.')}까지`} />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Card title="오늘 뭐 하지" note={`${gym.name} · 보유 ${gym.machines.length}종`}>
        {routines.length === 0 ? (
          <Empty title="아직 루틴이 없습니다">
            아래 버튼으로 이 헬스장 기구만 쓰는 루틴을 만드세요.
          </Empty>
        ) : (
          <>
            {fromTrainer.length > 0 && (
              <>
                <p className="eyebrow" style={{ margin: '0 0 8px' }}>트레이너 숙제</p>
                {renderList(fromTrainer)}
              </>
            )}
            {fromOwner.length > 0 && (
              <>
                <p className="eyebrow" style={{ margin: '12px 0 8px' }}>관장 추천 (내 보관)</p>
                {renderList(fromOwner)}
              </>
            )}
            {mine.length > 0 && (
              <>
                <p className="eyebrow" style={{ margin: '12px 0 8px' }}>내 루틴 · 기구 맞춤</p>
                {renderList(mine)}
              </>
            )}
          </>
        )}
        <button
          type="button"
          className="btn btn--block"
          style={{ marginTop: 12 }}
          disabled={busy}
          onClick={makeAuto}
        >
          {busy ? '만드는 중…' : '보유 기구로 새 루틴 짜기'}
        </button>
      </Card>

      {openTemplates.length > 0 && (
        <Card title="관장님 추천 루틴" note="가져오면 내 루틴에 복사됩니다" flush>
          <ul className="list">
            {openTemplates.map((t) => (
              <li key={t.id}>
                <div className="list__item" style={{ cursor: 'default' }}>
                  <div className="list__body">
                    <div className="list__title">{t.title}</div>
                    <div className="list__meta">
                      주 {t.days}회 · {GOAL[t.goal] || t.goal}
                      {t.body?.days ? ` · ${t.body.days.reduce((a, d) => a + (d.items?.length || 0), 0)}종목` : ''}
                    </div>
                  </div>
                  <button type="button" className="btn btn--sm" disabled={busy} onClick={() => takeTemplate(t.id)}>
                    가져오기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hw?.length > 0 && (
        <Card title="받은 숙제 기록" flush>
          <ul className="list">
            {hw.slice(0, 5).map((h) => (
              <li key={h.id}>
                <Link className="list__item" to={`/my/routine/${h.saved_id || h.routine_id}`}>
                  <div className="list__body">
                    <div className="list__title">{h.title}</div>
                    <div className="list__meta">
                      {h.sent_at?.replace(/-/g, '.')} 수신
                      {h.due ? ` · ~${h.due.replace(/-/g, '.')}` : ''}
                    </div>
                  </div>
                  <div className="list__right">→</div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pt && (
        <Card>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div>
              <p className="eyebrow">PT</p>
              <p className="card__note">{pt.trainer_name} 트레이너</p>
              <Stack total={pt.total_sessions} done={pt.used_sessions} current={pt.used_sessions} />
            </div>
            <Plate value={ptLeft} unit="회 남음" />
          </div>
          <button
            type="button"
            className="btn btn--block"
            style={{ marginTop: 12 }}
            onClick={() => nav(pt.trainer_id ? `/book?trainer=${pt.trainer_id}` : '/book')}
          >
            PT 예약하기
          </button>
        </Card>
      )}

      <Card title="이 헬스장에서 쓸 수 있는 것" flush>
        <ul className="list">
          <li>
            <button type="button" className="list__item" style={{ width: '100%' }} onClick={makeAuto}>
              <div className="list__body">
                <div className="list__title">기구 기준 루틴</div>
                <div className="list__meta">이 헬스장에 있는 기구로만 짠 주간 루틴</div>
              </div>
              <div className="list__right">→</div>
            </button>
          </li>
          <li>
            <Link className="list__item" to="/body">
              <div className="list__body">
                <div className="list__title">체성분 기록</div>
                <div className="list__meta">측정 결과지를 찍어서 기록</div>
              </div>
              <div className="list__right">→</div>
            </Link>
          </li>
          <li>
            <Link className="list__item" to="/refund">
              <div className="list__body">
                <div className="list__title">해지 시 환불액</div>
                <div className="list__meta">지금 해지하면 얼마 돌려받는지</div>
              </div>
              <div className="list__right">→</div>
            </Link>
          </li>
        </ul>
      </Card>

      <div className="row row--wrap" style={{ padding: '0 4px 8px' }}>
        <Chip kind="machine">보유 기구 {gym.machines.length}종</Chip>
        <Chip>{gym.open}</Chip>
        <Chip>회원 {gym.members}명</Chip>
      </div>

      <Note>
        <p className="small">
          관장이 기구를 바꾸면 <b>기구 맞춤</b> 루틴은 자동으로 다시 짜입니다.
          트레이너 숙제·관장 추천은 내용이 그대로 남고, 없는 기구만 경고로 표시합니다.
        </p>
      </Note>
    </>
  );
}
