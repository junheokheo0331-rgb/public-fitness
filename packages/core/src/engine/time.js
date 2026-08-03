/* workoutapp engine 시간·심박 유틸 이식 */
export function dateStrOf(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getTodayStr() {
  return dateStrOf(new Date());
}

export function mmss(sec) {
  const s = Math.max(0, Math.floor(Math.abs(sec)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function hhmmss(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function calculateHeartZones(age, rhr = 70) {
  if (!age) return null;
  const maxHR = 220 - age;
  const hrr = maxHR - rhr;
  const z = (lo, hi) => [Math.round(hrr * lo + rhr), Math.round(hrr * hi + rhr)];
  return { maxHR, rhr, zone2: z(0.60, 0.70), zone3: z(0.70, 0.80), zone4: z(0.80, 0.90) };
}

export function weekStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const off = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - off);
  return x;
}
