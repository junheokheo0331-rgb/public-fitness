import { blankSets, setTargets } from '@gymlink/core/progress';
import { getMainLiftE1RM } from '@gymlink/core/analytics';
import { getTodayStr } from '@gymlink/core/time';
import { itemToEditable } from '@gymlink/core/catalog';
import { defaultState, exerciseToItem } from './defaults.js';

const KEY = 'gymlink.workout.v7';

function uid(prefix = 'p') {
  return prefix + Math.random().toString(36).slice(2, 9);
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function stepFor(ex, settings) {
  if (ex.min_step_kg) return ex.min_step_kg;
  if (ex.equip === '바벨') return Number(settings?.unitBar) || 2.5;
  if (ex.equip === '덤벨') return Number(settings?.unitDumbbell) || 2;
  return Number(settings?.unitMachine) || 5;
}

function initSetsForExercise(ex, prevSets, stats, settings) {
  const item = exerciseToItem(ex);
  const unitLabel = settings?.unit || 'kg';
  if (ex.type === 'cardio') {
    return [{ w: '', reps: '', rir: null, done: false, target_text: `유산소 ${ex.targetMin || settings?.cardioMin || 30}분` }];
  }
  const targets = setTargets(
    {
      type: 'weight',
      sets: ex.sets,
      repLo: ex.repLo,
      repHi: ex.repHi,
      rir: ex.rir,
      step: stepFor(ex, settings),
      mode: ex.mode,
      lift: ex.lift,
      round: ex.round,
    },
    {
      e1rm: ex.lift ? stats[ex.lift]?.e1rm : undefined,
      prevSets,
      unitLabel,
    },
  );
  return blankSets(Math.max(1, Number(ex.sets) || 3), targets).map((s, i) => ({
    ...s,
    rir: s.rir ?? ex.rir ?? 1,
    target_text: targets[i]?.text || '',
  }));
}

class WorkoutStoreClass {
  constructor() {
    this._state = defaultState();
    this._listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY)
        || localStorage.getItem('gymlink.workout.v6');
      if (!raw) return this._state;
      const parsed = JSON.parse(raw);
      const base = defaultState();
      /* v7: 이식용 6분할·Zone2 프로그램은 버리고 GymLink용으로 교체 */
      if (!parsed?.version || parsed.version < 7) {
        this._state = {
          ...base,
          settings: { ...base.settings, ...(parsed.settings || {}) },
          logs: parsed.logs || {},
          timer: parsed.timer || null,
          session: parsed.session || null,
        };
        this.save();
        return this._state;
      }
      this._state = {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...parsed.settings },
      };
    } catch { /* ignore corrupt data */ }
    return this._state;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this._state));
    } catch { /* quota */ }
  }

  _emit() {
    this._listeners.forEach((fn) => {
      try { fn(this._state); } catch { /* ignore */ }
    });
  }

  _mutate(fn) {
    fn();
    this.save();
    this._emit();
  }

  getState() {
    return this._state;
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  getProgram(id) {
    return this._state.programs.find((p) => p.id === id) || null;
  }

  saveProgram(p) {
    this._mutate(() => {
      const i = this._state.programs.findIndex((x) => x.id === p.id);
      if (i >= 0) this._state.programs[i] = p;
      else this._state.programs.push(p);
    });
  }

  deleteProgram(id) {
    this._mutate(() => {
      this._state.programs = this._state.programs.filter((p) => p.id !== id);
    });
  }

  createProgram({ title, desc, dayHint }) {
    const p = {
      id: uid('prog_'),
      title: title || '새 프로그램',
      desc: desc || '',
      dayHint: dayHint ?? null,
      items: [],
    };
    this._mutate(() => { this._state.programs.push(p); });
    return p;
  }

  reorderProgramItems(pid, from, to) {
    const prog = this.getProgram(pid);
    if (!prog) return;
    this._mutate(() => {
      const items = prog.items.slice();
      const [item] = items.splice(from, 1);
      items.splice(to, 0, item);
      prog.items = items;
    });
  }

  patchExercise(pid, index, patch) {
    const prog = this.getProgram(pid);
    if (!prog?.items[index]) return;
    this._mutate(() => {
      prog.items[index] = { ...prog.items[index], ...patch };
    });
  }

  addExercise(pid, ex) {
    const prog = this.getProgram(pid);
    if (!prog) return;
    this._mutate(() => { prog.items.push(ex); });
  }

  removeExercise(pid, index) {
    const prog = this.getProgram(pid);
    if (!prog) return;
    this._mutate(() => { prog.items.splice(index, 1); });
  }

  getExerciseStats() {
    const e1 = getMainLiftE1RM(this._state.logs, this._state.settings, this._state.programs);
    const stats = {};
    for (const lift of ['스쿼트', '벤치프레스', '데드리프트']) {
      if (e1[lift]?.currentE1) stats[lift] = { e1rm: e1[lift].currentE1 };
    }
    return stats;
  }

  prevSetsFor(exId) {
    const dates = Object.keys(this._state.logs).sort().reverse();
    for (const d of dates) {
      for (const sess of this.getSessions(d).slice().reverse()) {
        const arr = sess.sets?.[exId];
        if (!arr?.length) continue;
        const done = arr.filter((s) => s.done && (+s.reps > 0 || s.reps === 0));
        if (done.length) return arr.map((s) => ({ ...s }));
      }
    }
    return [];
  }

  allExercises() {
    const map = new Map();
    for (const p of this._state.programs) {
      for (const ex of p.items || []) map.set(ex.id, ex);
    }
    for (const ex of this._state.session?.extraItems || []) map.set(ex.id, ex);
    if (this._state.session?.setsMap) {
      for (const id of Object.keys(this._state.session.setsMap)) {
        if (!map.has(id)) map.set(id, { id, name: id });
      }
    }
    return [...map.values()];
  }

  findExById(id) {
    for (const p of this._state.programs) {
      const hit = (p.items || []).find((e) => e.id === id);
      if (hit) return hit;
    }
    const extra = (this._state.session?.extraItems || []).find((e) => e.id === id);
    if (extra) return extra;
    return { id, name: id };
  }

  /** 세션 중 종목 추가 (자유 운동 · 당일 추가) */
  addToSession(ex) {
    const sess = this._state.session;
    if (!sess || !ex) return null;
    const stats = this.getExerciseStats();
    const sets = initSetsForExercise(ex, this.prevSetsFor(ex.id), stats, this._state.settings);
    this._mutate(() => {
      if (!sess.extraItems) sess.extraItems = [];
      sess.extraItems.push(ex);
      sess.order = [...(sess.order || []), ex.id];
      sess.setsMap = { ...sess.setsMap, [ex.id]: sets };
    });
    return ex;
  }

  startSession({ programId, dateStr, free } = {}) {
    const ds = dateStr || getTodayStr();
    const stats = this.getExerciseStats();
    const program = programId ? this.getProgram(programId) : null;
    const setsMap = {};
    const order = [];

    if (program) {
      for (const ex of program.items) {
        order.push(ex.id);
        setsMap[ex.id] = initSetsForExercise(ex, this.prevSetsFor(ex.id), stats, this._state.settings);
      }
    }

    const session = {
      id: uid('s_'),
      programId: programId || null,
      dateStr: ds,
      free: !!free,
      title: free ? '자유 운동' : (program?.title || '운동'),
      startedAt: new Date().toISOString(),
      setsMap,
      order,
    };

    this._mutate(() => { this._state.session = session; });
    return session;
  }

  /** 헬스장 루틴(body.days[n].items) → 라이브 세션 */
  startFromGymDay({ title, day, sourceRoutineId, dateStr } = {}) {
    const ds = dateStr || getTodayStr();
    const stats = this.getExerciseStats();
    const items = (day?.items || []).map((it) => itemToEditable(it));
    const setsMap = {};
    const order = [];
    for (const ex of items) {
      order.push(ex.id);
      setsMap[ex.id] = initSetsForExercise(ex, this.prevSetsFor(ex.id), stats, this._state.settings);
    }
    const session = {
      id: uid('s_'),
      programId: null,
      sourceRoutineId: sourceRoutineId || null,
      dateStr: ds,
      free: false,
      title: title || day?.name || '헬스장 루틴',
      startedAt: new Date().toISOString(),
      setsMap,
      order,
      extraItems: items,
    };
    this._mutate(() => { this._state.session = session; });
    return session;
  }

  finishSession() {
    const sess = this._state.session;
    if (!sess) return null;
    let saved = null;
    this._mutate(() => {
      const day = this._state.logs[sess.dateStr] || { sessions: [] };
      saved = {
        id: sess.id,
        programId: sess.programId,
        startedAt: sess.startedAt,
        endedAt: new Date().toISOString(),
        sets: clone(sess.setsMap),
        free: sess.free,
        title: sess.title,
      };
      day.sessions = [...(day.sessions || []), saved];
      this._state.logs[sess.dateStr] = day;
      this._state.session = null;
    });
    return saved;
  }

  getActiveSession() {
    return this._state.session;
  }

  updateSessionSets(dateStr, sessionId, setsMap) {
    const sess = this._state.session;
    if (!sess || sess.id !== sessionId || sess.dateStr !== dateStr) return;
    this._mutate(() => {
      sess.setsMap = setsMap;
    });
  }

  patchSessionSets(patchFn) {
    const sess = this._state.session;
    if (!sess) return;
    this._mutate(() => {
      sess.setsMap = patchFn(clone(sess.setsMap));
    });
  }

  getSessions(dateStr) {
    return this._state.logs[dateStr]?.sessions || [];
  }

  deleteSession(dateStr, sessionId) {
    this._mutate(() => {
      const day = this._state.logs[dateStr];
      if (!day?.sessions) return;
      day.sessions = day.sessions.filter((s) => s.id !== sessionId);
      if (!day.sessions.length) delete this._state.logs[dateStr];
    });
  }

  startRest(sec, label = '휴식') {
    const duration = Math.max(0, Number(sec) || 0);
    const now = Date.now();
    this._mutate(() => {
      this._state.timer = {
        label,
        startedAt: now,
        endAt: now + duration * 1000,
        baseSec: duration,
        alarmed: false,
      };
    });
  }

  restAdd(n) {
    const t = this._state.timer;
    if (!t) return;
    this._mutate(() => {
      t.endAt += (Number(n) || 0) * 1000;
      t.baseSec = Math.max(0, Math.round((t.endAt - t.startedAt) / 1000));
    });
  }

  clearRest() {
    this._mutate(() => { this._state.timer = null; });
  }

  getTimer() {
    const t = this._state.timer;
    if (!t) return null;
    const now = Date.now();
    const remainMs = t.endAt - now;
    const elapsedMs = now - t.startedAt;
    const totalMs = Math.max(1, t.endAt - t.startedAt);
    return {
      ...t,
      remainSec: Math.ceil(remainMs / 1000),
      overtime: remainMs < 0,
      progress: Math.min(1, Math.max(0, elapsedMs / totalMs)),
    };
  }

  markTimerAlarmed() {
    if (this._state.timer) this._state.timer.alarmed = true;
    this.save();
  }

  updateSettings(patch) {
    this._mutate(() => {
      this._state.settings = { ...this._state.settings, ...patch };
    });
  }

  setBaseline(lift, field, value) {
    this._mutate(() => {
      const b = this._state.settings.baseline[lift] || { w: 0, reps: 1, rir: 0 };
      b[field] = value;
      this._state.settings.baseline[lift] = b;
    });
  }

  exportJSON() {
    return clone(this._state);
  }

  importJSON(obj) {
    if (obj.version !== 6 && obj.version !== 7) throw new Error('지원하지 않는 백업 형식입니다.');
    this._mutate(() => {
      const base = defaultState();
      this._state = {
        ...base,
        ...obj,
        version: 7,
        settings: { ...base.settings, ...obj.settings },
        programs: (obj.version < 7 || !obj.programs?.length) ? base.programs : obj.programs,
      };
    });
  }

  wipe() {
    this._mutate(() => { this._state = defaultState(); });
  }
}

export const WorkoutStore = new WorkoutStoreClass();
