import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TopBar, Card, Chip, Note, Empty, Field } from '../../ui/bits.jsx';
import {
  myBookableTrainers, listAvailableSlots, createBooking, listMyBookings, cancelBooking, myPt,
} from '../../lib/api.js';
import { dateStrLocal, WEEKDAY_KO, weekdayMon0 } from '../../lib/booking.js';

/* 네이버 미용실식 — 달력 → 시간 슬롯 → 확정 */

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startPad = weekdayMon0(first);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function fmtWhen(iso) {
  const d = new Date(iso);
  const wd = WEEKDAY_KO[weekdayMon0(d)];
  return `${d.getMonth() + 1}.${d.getDate()} (${wd}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function PtBook() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const presetTrainer = params.get('trainer');

  const [trainers, setTrainers] = useState([]);
  const [trainerId, setTrainerId] = useState(presetTrainer || '');
  const [pt, setPt] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [pick, setPick] = useState(null);
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const reloadMine = () => listMyBookings().then(setMine);

  useEffect(() => {
    myBookableTrainers().then((list) => {
      setTrainers(list);
      setTrainerId((cur) => cur || presetTrainer || list[0]?.id || '');
    });
    myPt().then(setPt);
    reloadMine();
  }, [presetTrainer]);

  useEffect(() => {
    if (!trainerId) return;
    const from = dateStrLocal(new Date(cursor.y, cursor.m, 1));
    const to = dateStrLocal(new Date(cursor.y, cursor.m + 1, 0));
    listAvailableSlots(trainerId, from, to).then(setSlots);
    setPick(null);
  }, [trainerId, cursor.y, cursor.m]);

  const availByDate = useMemo(() => {
    const map = {};
    for (const s of slots) {
      if (!s.available) continue;
      map[s.date] = (map[s.date] || 0) + 1;
    }
    return map;
  }, [slots]);

  const daySlots = useMemo(() => {
    if (!selectedDate) return [];
    return slots.filter((s) => s.date === selectedDate);
  }, [slots, selectedDate]);

  const cells = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);
  const today = dateStrLocal(new Date());
  const trainer = trainers.find((t) => t.id === trainerId);
  const upcoming = mine.filter((b) => ['booked', 'requested', 'confirmed'].includes(b.status) && new Date(b.starts_at) >= new Date());
  const left = pt ? pt.total_sessions - pt.used_sessions : null;

  const confirm = async () => {
    if (!pick) return;
    setBusy(true);
    setErr(null);
    try {
      await createBooking({ trainerId, startsAt: pick.starts_at });
      setMsg('예약을 요청했습니다. 트레이너가 확정하면 알려드릴게요.');
      setPick(null);
      await reloadMine();
      const from = dateStrLocal(new Date(cursor.y, cursor.m, 1));
      const to = dateStrLocal(new Date(cursor.y, cursor.m + 1, 0));
      setSlots(await listAvailableSlots(trainerId, from, to));
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setErr(e.message || '예약 실패');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    if (!confirm('이 예약을 취소할까요?')) return;
    await cancelBooking(id);
    reloadMine();
    if (trainerId) {
      const from = dateStrLocal(new Date(cursor.y, cursor.m, 1));
      const to = dateStrLocal(new Date(cursor.y, cursor.m + 1, 0));
      setSlots(await listAvailableSlots(trainerId, from, to));
    }
  };

  return (
    <>
      <TopBar title="PT 예약" sub="날짜 · 시간 선택" back />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}
      {err && <Note kind="stop"><p className="small">{err}</p></Note>}

      {pt && (
        <Card>
          <div className="row row--between">
            <div>
              <p className="eyebrow">잔여 횟수</p>
              <p className="card__title" style={{ fontSize: 16 }}>{pt.trainer_name}</p>
              <p className="card__note">{left}회 남음 · {pt.used_sessions}/{pt.total_sessions} 사용</p>
            </div>
            <Link className="btn btn--sm btn--ghost" to="/my">내 헬스장</Link>
          </div>
        </Card>
      )}

      <Card title="트레이너">
        <Field label="예약할 트레이너">
          <select className="input" value={trainerId} onChange={(e) => { setTrainerId(e.target.value); setSelectedDate(null); }}>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} · {t.gym_name}</option>
            ))}
          </select>
        </Field>
        {trainer && (
          <p className="tiny muted" style={{ margin: 0 }}>
            회당 약 {(trainer.price_per_session || 0).toLocaleString()}원 · 캘린더에서 빈 시간을 고르세요
          </p>
        )}
      </Card>

      <Card title="날짜 선택" note={`${cursor.y}.${cursor.m + 1}`}>
        <div className="row row--between" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setCursor((c) => {
              const d = new Date(c.y, c.m - 1, 1);
              return { y: d.getFullYear(), m: d.getMonth() };
            })}
          >
            ‹
          </button>
          <strong>{cursor.y}년 {cursor.m + 1}월</strong>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setCursor((c) => {
              const d = new Date(c.y, c.m + 1, 1);
              return { y: d.getFullYear(), m: d.getMonth() };
            })}
          >
            ›
          </button>
        </div>

        <div className="cal">
          {WEEKDAY_KO.map((w) => <div key={w} className="cal__dow">{w}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="cal__cell is-empty" />;
            const ds = dateStrLocal(d);
            const n = availByDate[ds] || 0;
            const past = ds < today;
            const on = selectedDate === ds;
            return (
              <button
                key={ds}
                type="button"
                className={`cal__cell ${on ? 'is-on' : ''} ${n ? 'has-slot' : ''} ${past ? 'is-past' : ''} ${ds === today ? 'is-today' : ''}`}
                disabled={past || !n}
                onClick={() => { setSelectedDate(ds); setPick(null); }}
              >
                <span className="cal__day">{d.getDate()}</span>
                {n > 0 && <span className="cal__dot" />}
              </button>
            );
          })}
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>파란 점이 있는 날만 예약 가능합니다</p>
      </Card>

      {selectedDate && (
        <Card title={`${selectedDate.replace(/-/g, '.')} 시간`} note="네이버 예약처럼 빈 칸만 선택">
          {!daySlots.length && <Empty title="이 날 가능한 시간이 없습니다" />}
          <div className="slots">
            {daySlots.map((s) => (
              <button
                key={s.starts_at}
                type="button"
                className={`slots__btn ${!s.available ? 'is-off' : ''} ${pick?.starts_at === s.starts_at ? 'is-on' : ''}`}
                disabled={!s.available}
                onClick={() => setPick(s)}
              >
                {s.time}
              </button>
            ))}
          </div>
          {pick && (
            <div style={{ marginTop: 14 }}>
              <Note kind="volt">
                <p className="small" style={{ margin: 0 }}>
                  <strong>{fmtWhen(pick.starts_at)}</strong>
                  {trainer ? ` · ${trainer.name}` : ''}
                </p>
              </Note>
              <button type="button" className="btn btn--block" style={{ marginTop: 10 }} disabled={busy} onClick={confirm}>
                {busy ? '예약 중…' : '이 시간으로 예약'}
              </button>
            </div>
          )}
        </Card>
      )}

      <Card title="내 다가오는 예약" flush>
        {upcoming.length === 0 && (
          <div style={{ padding: 16 }}><Empty title="예정된 예약이 없습니다" /></div>
        )}
        <ul className="list">
          {upcoming.map((b) => (
            <li key={b.id}>
              <div className="list__item" style={{ cursor: 'default' }}>
                <div className="list__body">
                  <div className="list__title">{fmtWhen(b.starts_at)}</div>
                  <div className="list__meta">
                    {b.kind === 'fixed' ? '고정 일정' : '예약'}
                    {b.note ? ` · ${b.note}` : ''}
                  </div>
                </div>
                <Chip kind={b.status === 'confirmed' || b.status === 'booked' ? 'go' : 'sub'}>
                  {b.status === 'requested' ? '확인 대기' : '확정'}
                </Chip>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => cancel(b.id)}>취소</button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
