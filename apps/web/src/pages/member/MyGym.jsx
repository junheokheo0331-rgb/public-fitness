import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar, Card, Chip, Note, Plate, Stack, Empty } from '../../ui/bits.jsx';
import { useSession } from '../../lib/session.jsx';
import {
  myMembership, myPt, getGym, mySavedRoutines,
  listGymTemplates, copyRoutine, memberHomework, myPortableRoutines, adaptRoutineToGym, myAccessCredential,
} from '../../lib/api.js';

const GOAL = {
  hypertrophy: '근비대', fatloss: '감량', strength: '스트렝스', conditioning: '컨디션',
};

export default function MyGym() {
  const nav = useNavigate();
  const { session } = useSession();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const reload = useCallback(async () => {
    try {
      const ms = await myMembership();
      if (!ms) { setState({ none: true }); return; }
      const [gym, pt, routines, templates, hw, portable, access] = await Promise.all([
        getGym(ms.gym_id),
        myPt(),
        mySavedRoutines(ms.gym_id),
        listGymTemplates(ms.gym_id),
        memberHomework(session.id),
        myPortableRoutines(ms.gym_id),
        myAccessCredential(ms.gym_id),
      ]);
      setState({ ms, gym, pt, routines, templates, hw, portable, access });
    } catch (error) {
      setState({ error: error.message || '내 헬스장 정보를 불러오지 못했습니다.' });
    }
  }, [session.id]);

  useEffect(() => { reload(); }, [reload]);

  if (!state) return <><TopBar title="내 헬스장" /><Card><p className="muted small">불러오는 중…</p></Card></>;

  if (state.error) return <><TopBar title="내 헬스장" /><Card><Empty title="정보를 불러오지 못했습니다" action={<button type="button" className="btn btn--sm" onClick={() => { setState(null); reload(); }}>다시 불러오기</button>}>{state.error}</Empty></Card></>;

  if (state.none) {
    return (
      <>
        <TopBar title="내 헬스장" right={<Link className="btn btn--sm btn--ghost" to="/#nearby-gyms">변경</Link>} />
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

  const { ms, gym, pt, routines, templates, hw, portable, access } = state;
  const ptLeft = pt ? pt.total_sessions - pt.used_sessions : 0;
  const mine = routines.filter((r) => r.origin === 'auto' || r.origin === 'member');
  const fromOwner = routines.filter((r) => r.origin === 'owner');
  const fromTrainer = routines.filter((r) => r.origin === 'trainer');
  const openTemplates = templates.filter(
    (t) => !fromOwner.some((r) => r.title === t.title || r.id === t.id),
  );
  const isDayPass = ms.price_plans?.kind === 'daily';

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

  const moveRoutine = async (id) => {
    setBusy(true);
    setMsg(null);
    try {
      const result = await adaptRoutineToGym(id, ms.gym_id);
      setMsg(result.replacements.length
        ? `${result.replacements.length}개 운동을 현재 헬스장 머신으로 바꿨습니다.`
        : '현재 헬스장에서 그대로 수행할 수 있습니다.');
      await reload();
      nav(`/my/routine/${result.routine.id}`);
    } catch (error) {
      setMsg(error.message || '루틴을 옮기지 못했습니다.');
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
                {r.origin === 'auto' && <Chip kind="machine">내 헬스장 맞춤</Chip>}
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
      <TopBar title={gym.name} sub={`${ms.plan_name} · ${ms.ends_on.replace(/-/g, '.')}까지`} right={<Link className="btn btn--sm btn--ghost" to="/#nearby-gyms">헬스장 변경</Link>} />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      {isDayPass && (
        <Card title="오늘의 일일권" note={`${ms.ends_on.replace(/-/g, '.')}까지`}>
          <div className="row row--between">
            <div>
              <p className="eyebrow">입장 패스</p>
              <strong>{gym.name}</strong>
              <p className="tiny muted" style={{ marginTop: 4 }}>{ms.price_plans?.metadata?.reentry_allowed ? '유효기간 내 재입장 가능' : '1회 입장'}</p>
            </div>
            <div className="day-pass-code mono">{access?.qr_secret ? access.qr_secret.slice(-8).toUpperCase() : '발급 중'}</div>
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>프런트에서 이 입장 코드를 보여주세요. 출입기 연동 헬스장은 자동 등록됩니다.</p>
        </Card>
      )}

      <Card title="오늘 뭐 하지" note={`${gym.name} · 보유 ${gym.machines.length}종`}>
        {routines.length === 0 ? (
          <Empty title="아직 루틴이 없습니다">
            아래 버튼에서 원하는 운동을 골라 첫 루틴을 만들어보세요.
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
                <p className="eyebrow" style={{ margin: '12px 0 8px' }}>내 루틴 · 헬스장 맞춤</p>
                {renderList(mine)}
              </>
            )}
          </>
        )}
        <button
          type="button"
          className="btn btn--block"
          style={{ marginTop: 12 }}
          onClick={() => nav('/workout/programs/new')}
        >
          루틴 짜기
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

      {portable?.length > 0 && (
        <Card title="이전 헬스장 루틴" note="세트·반복은 유지하고 현재 머신에 맞춥니다" flush>
          <ul className="list">
            {portable.map((routine) => (
              <li key={routine.id}>
                <div className="list__item">
                  <div className="list__body">
                    <div className="list__title">{routine.title}</div>
                    <div className="list__meta">기존 운동 의도를 유지해 자동 대체</div>
                  </div>
                  <button type="button" className="btn btn--sm" disabled={busy} onClick={() => moveRoutine(routine.id)}>현재 헬스장에 맞추기</button>
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
                <div className="list__title">내 헬스장 루틴</div>
                <div className="list__meta">선택한 헬스장 환경에 맞춘 주간 루틴</div>
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
          헬스장을 옮기거나 머신 구성이 바뀌면 <b>내 루틴</b>을 새 환경에 맞게 조정할 수 있습니다.
          트레이너 숙제·관장 추천은 내용이 그대로 남고, 없는 기구만 경고로 표시합니다.
        </p>
      </Note>
    </>
  );
}
