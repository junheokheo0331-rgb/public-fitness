import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar, Card, Field, Note, won } from '../../ui/bits.jsx';
import LocationPicker from '../../ui/LocationPicker.jsx';
import { createPtRequest, getCurrentArea } from '../../lib/api.js';

const GOALS = ['근비대', '감량', '자세교정', '입문', '스트렝스', '체형'];
const SCHEDULES = ['평일 저녁', '평일 낮', '주말 오전', '주말 오후', '시간 협의'];

export default function PtRequestNew() {
  const nav = useNavigate();
  const [area, setArea] = useState(null);
  const [goal, setGoal] = useState('근비대');
  const [sessions, setSessions] = useState('20');
  const [budget, setBudget] = useState('1200000');
  const [schedule, setSchedule] = useState('평일 저녁');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCurrentArea().then(setArea); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const row = await createPtRequest({
        area_id: area?.id,
        goal, sessions, budget_max: budget, schedule, note,
      });
      nav(`/pt/${row.id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="PT 신청하기" sub="트레이너가 제안서를 보냅니다" back />

      <Card>
        <p className="eyebrow">희망 지역</p>
        <LocationPicker onChange={setArea} />
        <p className="field__hint" style={{ marginTop: 8 }}>
          이 지역 근처 트레이너에게 요청이 노출됩니다.
        </p>
      </Card>

      <form onSubmit={submit}>
        <Card title="어떤 PT가 필요하세요?">
          <div className="row row--wrap" style={{ marginBottom: 14 }}>
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                className={`chip ${goal === g ? 'chip--pick' : ''}`}
                onClick={() => setGoal(g)}
              >
                {g}
              </button>
            ))}
          </div>

          <Field label="희망 횟수">
            <input
              className="input input--num"
              inputMode="numeric"
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
              required
            />
          </Field>

          <Field label="최대 예산" hint={`약 ${won(budget)}`}>
            <input
              className="input input--num"
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              required
            />
          </Field>

          <Field label="가능 시간대">
            <select
              className="input"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            >
              {SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="하고 싶은 말" hint="부상·목표·선호 스타일을 적어 주세요">
            <textarea
              className="input"
              rows={3}
              style={{ minHeight: 88, resize: 'vertical' }}
              placeholder="예: 무릎이 약해서 스쿼트는 부담스러워요"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </Card>

        <Note kind="volt" title="이렇게 진행돼요">
          <p>1. 신청을 올리면 근처 트레이너에게 보여요.</p>
          <p>2. 트레이너가 이력서 + 제안가를 보냅니다.</p>
          <p>3. 원하는 분을 고르면 매칭됩니다.</p>
        </Note>

        <button className="btn btn--block" type="submit" disabled={busy}>
          {busy ? '올리는 중…' : 'PT 신청 올리기'}
        </button>
      </form>
    </>
  );
}
