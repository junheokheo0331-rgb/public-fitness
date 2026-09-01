import { blankSets, setTargets } from '@gymlink/core/progress';
import { getMainLiftE1RM } from '@gymlink/core/analytics';
import { getTodayStr } from '@gymlink/core/time';
import { itemToEditable } from '@gymlink/core/catalog';
import { defaultState, exerciseToItem } from './defaults.js';

const KEY_PREFIX = 'gymlink.workout.v8';

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
    return [{ w: '', reps: '', done: false, target_text: `유산소 ${ex.targetMin || settings?.cardioMin || 30}분` }];
  }
  const targets = setTargets(
    {
      type: 'weight',
      sets: ex.sets,
      repLo: ex.repLo,
      repHi: ex.repHi,
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
  return blankSets(Math.max(1, Number(ex.sets) || 3), targets).map((set, i) => {
    const { rir: _removed, ...withoutRir } = set;
    return { ...withoutRir, target_text: targets[i]?.text || '' };
  });
}

class WorkoutStoreClass {
  constructor() {
    this._accountId = null;
    this._key = `${KEY_PREFIX}.signed-out`;
    this._state = defaultState();
    this._listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(this._key);
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
      localStorage.setItem(this._key, JSON.stringify(this._state));
    } catch { /* quota */ }
  }

  _emit() {
    this._listeners.forEach((fn) => {
      try { fn(this._state); } catch { /* ignore */ }
    });
  }

  _mutate(fn) {
    fn();
    this._state = { ...this._state };
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

  /** 브라우저에 저장하는 진행 중 운동도 계정별로 완전히 분리한다. */
  setAccount(accountId) {
    const nextId = accountId || null;
    if (this._accountId === nextId) return;
    this._accountId = nextId;
    this._key = `${KEY_PREFIX}.${nextId || 'signed-out'}`;
    this._state = defaultState();
    this.load();
    this._emit();
  }

  /** Supabase 운동 기록을 로컬 분석·달력 형식으로 병합한다. */
  mergeRemoteSessions(rows = []) {
    this._mutate(() => {
      for (const remote of rows) {
        if (!remote?.id || !remote?.date) continue;
        const exercises = (remote.exercises || []).map((exercise) => ({
          ...exercise,
          id: exercise.code || exercise.id || exercise.name,
          exercise_code: exercise.code || exercise.exercise_code || exercise.id,
          sets: Array.isArray(exercise.sets) ? exercise.sets.length : Number(exercise.sets) || 0,
        }));
        const order = exercises.map((exercise) => exercise.id);
        const saved = {
          id: remote.id,
          programId: remote.routineId || null,
          startedAt: remote.startedAt,
          endedAt: remote.endedAt,
          sets: Object.fromEntries(exercises.map((exercise, index) => [order[index], remote.exercises[index]?.sets || []])),
          free: !remote.routineId,
          title: remote.title || '운동 기록',
          order,
          exercises,
        };
        const day = this._state.logs[remote.date] || { sessions: [] };
        const index = day.sessions.findIndex((session) => session.id === remote.id);
        if (index >= 0) day.sessions[index] = saved;
        else day.sessions.push(saved);
        this._state.logs[remote.date] = day;
      }
    });
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
    const extra = (this._state.session?.extraItems || []).find((e) => e.id === id);
    if (extra) return extra;
    for (const p of this._state.programs) {
      const hit = (p.items || []).find((e) => e.id === id);
      if (hit) return hit;
    }
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

  /** 라이브 운동 편집 — 당일 세션을 루틴처럼 자유롭게 바꾼다. */
  removeFromSession(exId) {
    const sess = this._state.session;
    if (!sess || !exId) return;
    this._mutate(() => {
      sess.order = (sess.order || []).filter((id) => id !== exId);
      sess.extraItems = (sess.extraItems || []).filter((item) => item.id !== exId);
      const next = { ...sess.setsMap };
      delete next[exId];
      sess.setsMap = next;
    });
  }

  replaceInSession(oldExId, ex) {
    const sess = this._state.session;
    if (!sess || !oldExId || !ex) return null;
    const stats = this.getExerciseStats();
    const sets = initSetsForExercise(ex, this.prevSetsFor(ex.id), stats, this._state.settings);
    this._mutate(() => {
      sess.order = (sess.order || []).map((id) => id === oldExId ? ex.id : id);
      sess.extraItems = [...(sess.extraItems || []).filter((item) => item.id !== oldExId), ex];
      const next = { ...sess.setsMap };
      delete next[oldExId];
      next[ex.id] = sets;
      sess.setsMap = next;
    });
    return ex;
  }

  patchSessionExercise(exId, patch) {
    const sess = this._state.session;
    if (!sess || !exId) return;
    const current = this.findExById(exId);
    this._mutate(() => {
      sess.extraItems = [
        ...(sess.extraItems || []).filter((item) => item.id !== exId),
        { ...current, ...patch, id: exId },
      ];
    });
  }

  reorderSession(from, to) {
    const sess = this._state.session;
    if (!sess) return;
    this._mutate(() => {
      const order = [...(sess.order || [])];
      const [picked] = order.splice(from, 1);
      order.splice(to, 0, picked);
      sess.order = order;
    });
  }

  addSessionSet(exId) {
    const sess = this._state.session;
    if (!sess?.setsMap?.[exId]) return;
    this._mutate(() => {
      const sets = [...sess.setsMap[exId]];
      const previous = sets.at(-1) || { w: '', reps: '', done: false };
      sets.push({ ...previous, done: false, target_text: previous.target_text || '' });
      sess.setsMap = { ...sess.setsMap, [exId]: sets };
    });
  }

  removeSessionSet(exId) {
    const sess = this._state.session;
    if (!sess?.setsMap?.[exId] || sess.setsMap[exId].length <= 1) return;
    this._mutate(() => {
      sess.setsMap = { ...sess.setsMap, [exId]: sess.setsMap[exId].slice(0, -1) };
    });
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
  startFromGymDay({ title, day, sourceRoutineId, sourceDayIndex = 0, dateStr } = {}) {
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
      sourceDayIndex,
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
        order: [...(sess.order || [])],
        exercises: (sess.order || []).map((id) => clone(this.findExById(id))),
      };
      day.sessions = [...(day.sessions || []), saved];
      this._state.logs[sess.dateStr] = day;
      this._state.session = null;
    });
    return saved;
  }

  /** 기록을 남기지 않고 진행 중인 운동과 휴식 타이머를 종료한다. */
  discardSession() {
    if (!this._state.session) return;
    this._mutate(() => {
      this._state.session = null;
      this._state.timer = null;
    });
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
      const b = this._state.settings.baseline[lift] || { w: 0, reps: 1 };
      b[field] = value;
      this._state.settings.baseline[lift] = b;
    });
  }

  exportJSON() {
    return clone(this._state);
  }

  importJSON(obj) {
    if (![6, 7, 8].includes(obj.version)) throw new Error('지원하지 않는 백업 형식입니다.');
    this._mutate(() => {
      const base = defaultState();
      this._state = {
        ...base,
        ...obj,
        version: 8,
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
