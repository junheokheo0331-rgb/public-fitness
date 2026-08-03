import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, Card, Chip, Note, Empty, Field } from '../../ui/bits.jsx';
import {
  getTrainerSchedule, saveTrainerSchedule, listFixedSessions, createFixedSession,
  deleteFixedSession, listTrainerBookings, cancelBooking, myClients,
} from '../../lib/api.js';
import { WEEKDAY_KO, dateStrLocal, weekdayMon0 } from '../../lib/booking.js';

const EMPTY_WEEK = () => ({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });

function fmtWhen(iso) {
  const d = new Date(iso);
  const wd = WEEKDAY_KO[weekdayMon0(d)];
  return `${d.getMonth() + 1}.${d.getDate()} (${wd}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TrainerSchedule() {
  const [weekly, setWeekly] = useState(EMPTY_WEEK());
  const [durationMin, setDurationMin] = useState(50);
  const [slotStepMin, setSlotStepMin] = useState(60);
  const [fixed, setFixed] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const [fxMember, setFxMember] = useState('');
  const [fxWeekday, setFxWeekday] = useState(0);
  const [fxTime, setFxTime] = useState('19:00');
  const [fxNote, setFxNote] = useState('');

  const [viewDate, setViewDate] = useState(() => dateStrLocal(new Date()));

  const load = async () => {
    const [sch, fx, bk, cs] = await Promise.all([
      getTrainerSchedule('u-trainer'),
      listFixedSessions('u-trainer'),
      listTrainerBookings({
        from: dateStrLocal(new Date()),
        to: dateStrLocal(new Date(Date.now() + 28 * 86400000)),
      }),
      myClients(),
    ]);
    setWeekly(sch.weekly || EMPTY_WEEK());
    setDurationMin(sch.durationMin || 50);
    setSlotStepMin(sch.slotStepMin || 60);
    setFixed(fx.filter((f) => f.active !== false));
    setBookings(bk.filter((b) => b.status === 'booked'));
    setClients(cs);
    if (!fxMember && cs[0]) setFxMember(cs[0].id);
  };

  useEffect(() => { load(); }, []);

  const flash = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(null), 2000);
  };

  const toggleDay = (wd) => {
    setWeekly((w) => {
      const cur = w[wd] || [];
      if (cur.length) return { ...w, [wd]: [] };
      return { ...w, [wd]: [{ start: '10:00', end: '21:00' }] };
    });
  };

  const setRange = (wd, idx, field, value) => {
    setWeekly((w) => {
      const ranges = [...(w[wd] || [])];
      ranges[idx] = { ...ranges[idx], [field]: value };
      return { ...w, [wd]: ranges };
    });
  };

  const addRange = (wd) => {
    setWeekly((w) => ({
      ...w,
      [wd]: [...(w[wd] || []), { start: '18:00', end: '21:00' }],
    }));
  };

  const saveHours = async () => {
    setBusy(true);
    try {
      await saveTrainerSchedule('u-trainer', { weekly, durationMin, slotStepMin });
      flash('영업 시간을 저장했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const addFixed = async () => {
    if (!fxMember || !fxTime) return;
    setBusy(true);
    try {
      await createFixedSession({
        memberId: fxMember,
        weekday: fxWeekday,
        time: fxTime,
        durationMin,
        note: fxNote || undefined,
      });
      flash('고정 일정을 등록했습니다.');
      setFxNote('');
      await load();
    } catch (e) {
      flash(e.message || '등록 실패');
    } finally {
      setBusy(false);
    }
  };

  const removeFixed = async (id) => {
    if (!confirm('고정 일정을 해제할까요? 앞으로의 자동 예약도 취소됩니다.')) return;
    await deleteFixedSession(id);
    await load();
  };

  const dayBookings = useMemo(
    () => bookings.filter((b) => dateStrLocal(new Date(b.starts_at)) === viewDate),
    [bookings, viewDate],
  );

  return (
    <>
      <TopBar
        title="PT 일정"
        sub="영업시간 · 고정 수업 · 예약"
        back
        right={<Link className="btn btn--sm btn--ghost" to="/t">오늘</Link>}
      />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Note kind="volt" title="고정 일정">
        <p className="small" style={{ margin: 0 }}>
          회원과 매주 같은 요일·시간을 정해 두면 자동으로 슬롯이 막히고, 회원 캘린더에도 반영됩니다.
        </p>
      </Note>

      <Card title="수업 길이">
        <div className="rowfields">
          <Field label="1회 분(분)">
            <input className="input input--num" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 50)} />
          </Field>
          <Field label="슬롯 간격(분)">
            <input className="input input--num" value={slotStepMin} onChange={(e) => setSlotStepMin(Number(e.target.value) || 60)} />
          </Field>
        </div>
        <p className="tiny muted">예: 50분 수업 · 60분 간격 → 10:00, 11:00 …</p>
      </Card>

      <Card title="주간 영업 시간" note="회원 예약 캘린더에 노출">
        {WEEKDAY_KO.map((label, wd) => {
          const ranges = weekly[wd] || [];
          const on = ranges.length > 0;
          return (
            <div key={wd} className="sched-day">
              <div className="row row--between">
                <button
                  type="button"
                  className={`chip ${on ? 'chip--pick' : ''}`}
                  onClick={() => toggleDay(wd)}
                >
                  {label}
                </button>
                {on && (
                  <button type="button" className="tiny" style={{ border: 0, background: 'none', color: 'var(--volt)', fontWeight: 700, cursor: 'pointer' }} onClick={() => addRange(wd)}>
                    + 구간
                  </button>
                )}
              </div>
              {on && ranges.map((r, i) => (
                <div key={i} className="row" style={{ gap: 8, marginTop: 8 }}>
                  <input className="input" type="time" value={r.start} onChange={(e) => setRange(wd, i, 'start', e.target.value)} />
                  <span className="tiny muted">~</span>
                  <input className="input" type="time" value={r.end} onChange={(e) => setRange(wd, i, 'end', e.target.value)} />
                </div>
              ))}
              {!on && <p className="tiny muted" style={{ margin: '6px 0 0' }}>휴무</p>}
            </div>
          );
        })}
        <button type="button" className="btn btn--block" style={{ marginTop: 12 }} disabled={busy} onClick={saveHours}>
          {busy ? '저장 중…' : '영업 시간 저장'}
        </button>
      </Card>

      <Card title="고정 일정 등록">
        <Field label="회원">
          <select className="input" value={fxMember} onChange={(e) => setFxMember(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name} · 잔여 {c.sessions_left}회</option>)}
          </select>
        </Field>
        <div className="rowfields">
          <Field label="요일">
            <select className="input" value={fxWeekday} onChange={(e) => setFxWeekday(Number(e.target.value))}>
              {WEEKDAY_KO.map((l, i) => <option key={l} value={i}>{l}</option>)}
            </select>
          </Field>
          <Field label="시작">
            <input className="input" type="time" value={fxTime} onChange={(e) => setFxTime(e.target.value)} />
          </Field>
        </div>
        <Field label="메모">
          <input className="input" placeholder="예: 고정 PT · 화 저녁" value={fxNote} onChange={(e) => setFxNote(e.target.value)} />
        </Field>
        <button type="button" className="btn btn--volt btn--block" disabled={busy || !fxMember} onClick={addFixed}>
          고정 일정 추가
        </button>
      </Card>

      <Card title="등록된 고정 일정" flush>
        {fixed.length === 0 && <div style={{ padding: 16 }}><Empty title="고정 일정이 없습니다" /></div>}
        <ul className="list">
          {fixed.map((f) => (
            <li key={f.id}>
              <div className="list__item" style={{ cursor: 'default' }}>
                <div className="list__body">
                  <div className="list__title">{f.member_name}</div>
                  <div className="list__meta">
                    매주 {WEEKDAY_KO[f.weekday]} {f.time}
                    {f.note ? ` · ${f.note}` : ''}
                  </div>
                </div>
                <button type="button" className="btn btn--sm btn--stop" onClick={() => removeFixed(f.id)}>해제</button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="예약 현황" note="날짜별">
        <Field label="날짜">
          <input className="input" type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} />
        </Field>
        {dayBookings.length === 0 && <Empty title="이 날 예약이 없습니다" />}
        <ul className="list">
          {dayBookings.map((b) => (
            <li key={b.id}>
              <div className="list__item" style={{ cursor: 'default' }}>
                <div className="list__body">
                  <div className="list__title">{b.member_name}</div>
                  <div className="list__meta">
                    {fmtWhen(b.starts_at)}
                    {b.kind === 'fixed' ? ' · 고정' : ' · 예약'}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Chip kind="sub">{b.status}</Chip>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={async () => { await cancelBooking(b.id); load(); }}>
                    취소
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="다가오는 예약" flush>
        <ul className="list">
          {bookings.slice(0, 12).map((b) => (
            <li key={b.id}>
              <Link className="list__item" to={`/t/clients/${b.member_id}`}>
                <div className="list__body">
                  <div className="list__title">{b.member_name}</div>
                  <div className="list__meta mono">{fmtWhen(b.starts_at)}</div>
                </div>
                <div className="list__right">{b.kind === 'fixed' ? '고정' : '›'}</div>
              </Link>
            </li>
          ))}
          {bookings.length === 0 && <div style={{ padding: 16 }}><Empty title="예약 없음" /></div>}
        </ul>
      </Card>
    </>
  );
}
