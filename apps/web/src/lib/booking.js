/* PT 슬롯 생성 — 주간 영업시간 · 고정수업 · 기존 예약 반영 */

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function dateStrLocal(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

export function parseHM(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function formatHM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** JS getDay() Sun=0 → 월=0…일=6 */
export function weekdayMon0(d) {
  return (d.getDay() + 6) % 7;
}

export function toLocalISO(dateStr, hm) {
  return `${dateStr}T${hm}:00`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * 날짜 범위의 후보 슬롯 (가용 여부 포함)
 * @returns {{ starts_at, ends_at, date, time, available, reason? }[]}
 */
export function buildSlots({
  schedule,
  bookings = [],
  fixed = [],
  fromDate,
  toDate,
  now = new Date(),
}) {
  if (!schedule) return [];
  const duration = Number(schedule.durationMin) || 50;
  const step = Number(schedule.slotStepMin) || 60;
  const closed = new Set(schedule.closedDates || []);
  const weekly = schedule.weekly || {};

  const busy = [];
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    busy.push({ start: new Date(b.starts_at).getTime(), end: new Date(b.ends_at).getTime(), id: b.id });
  }

  /* 고정 수업도 해당 요일에 점유 */
  const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
  const to = new Date(toDate); to.setHours(23, 59, 59, 999);

  for (const fx of fixed) {
    if (fx.active === false) continue;
    const cur = new Date(from);
    while (cur <= to) {
      if (weekdayMon0(cur) === fx.weekday) {
        const ds = dateStrLocal(cur);
        const startMs = new Date(toLocalISO(ds, fx.time)).getTime();
        const endMs = startMs + (fx.durationMin || duration) * 60000;
        /* 이미 같은 fixed_id 예약이 있으면 스킵 */
        const hasInst = bookings.some(
          (b) => b.fixed_id === fx.id && b.status !== 'cancelled' && dateStrLocal(new Date(b.starts_at)) === ds,
        );
        if (!hasInst) busy.push({ start: startMs, end: endMs, fixed: fx.id, member_id: fx.member_id });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const out = [];
  const day = new Date(from);
  while (day <= to) {
    const ds = dateStrLocal(day);
    const wd = weekdayMon0(day);
    if (!closed.has(ds)) {
      const ranges = weekly[wd] || [];
      for (const range of ranges) {
        const startM = parseHM(range.start);
        const endM = parseHM(range.end);
        for (let t = startM; t + duration <= endM; t += step) {
          const hm = formatHM(t);
          const starts_at = toLocalISO(ds, hm);
          const ends_at = toLocalISO(ds, formatHM(t + duration));
          const sMs = new Date(starts_at).getTime();
          const eMs = new Date(ends_at).getTime();
          if (sMs < now.getTime() - 60000) {
            out.push({ starts_at, ends_at, date: ds, time: hm, available: false, reason: 'past' });
            continue;
          }
          const hit = busy.find((b) => overlaps(sMs, eMs, b.start, b.end));
          out.push({
            starts_at,
            ends_at,
            date: ds,
            time: hm,
            available: !hit,
            reason: hit ? 'booked' : null,
            occupied_by: hit?.member_id || null,
          });
        }
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return out;
}

/** 고정 수업 → 앞으로 N주 예약 인스턴스 생성용 */
export function expandFixedInstances(fixed, bookings, weeks = 8, durationDefault = 50) {
  const created = [];
  const now = new Date();
  for (const fx of fixed) {
    if (fx.active === false) continue;
    for (let w = 0; w < weeks; w++) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      const diff = (fx.weekday - weekdayMon0(d) + 7) % 7;
      d.setDate(d.getDate() + diff + w * 7);
      if (d < now && w === 0 && diff === 0) {
        /* 오늘이지만 시각이 지났으면 다음 주 */
        const trial = new Date(toLocalISO(dateStrLocal(d), fx.time));
        if (trial < now) d.setDate(d.getDate() + 7);
      }
      const ds = dateStrLocal(d);
      const starts_at = toLocalISO(ds, fx.time);
      if (new Date(starts_at) < now) continue;
      const exists = bookings.some(
        (b) => b.fixed_id === fx.id && b.status !== 'cancelled' && dateStrLocal(new Date(b.starts_at)) === ds,
      );
      if (exists) continue;
      const duration = fx.durationMin || durationDefault;
      const endM = parseHM(fx.time) + duration;
      created.push({
        id: `bk-fx-${fx.id}-${ds}`,
        trainer_id: fx.trainer_id,
        member_id: fx.member_id,
        member_name: fx.member_name,
        starts_at,
        ends_at: toLocalISO(ds, formatHM(endM)),
        status: 'booked',
        kind: 'fixed',
        fixed_id: fx.id,
        note: fx.note || '고정 PT',
      });
    }
  }
  return created;
}

export function syncClientNext(clients, bookings) {
  const now = Date.now();
  for (const c of clients) {
    const next = bookings
      .filter((b) => b.member_id === c.id && b.status === 'booked' && new Date(b.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
    if (next) {
      const d = new Date(next.starts_at);
      c.next = `${dateStrLocal(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
  }
}

export const WEEKDAY_KO = ['월', '화', '수', '목', '금', '토', '일'];
