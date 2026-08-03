import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { WorkoutStore } from './store.js';
import { alarm, requestWakeLock, releaseWakeLock } from './timerExtras.js';

const WorkoutContext = createContext(null);

export function WorkoutProvider({ children }) {
  const [state, setState] = useState(() => WorkoutStore.getState());
  const [tick, setTick] = useState(0);
  const alarmedRef = useRef(new Set());

  useEffect(() => WorkoutStore.subscribe(setState), []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const timer = useMemo(() => WorkoutStore.getTimer(), [state.timer, tick]);

  useEffect(() => {
    if (state.settings?.wakelock && state.session) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => { releaseWakeLock(); };
  }, [state.session, state.settings?.wakelock]);

  useEffect(() => {
    if (!timer) {
      alarmedRef.current.clear();
      return;
    }
    if (timer.remainSec <= 0 && !timer.alarmed && !alarmedRef.current.has(timer.startedAt)) {
      alarmedRef.current.add(timer.startedAt);
      WorkoutStore.markTimerAlarmed();
      alarm(timer.label || '휴식 종료', state.settings);
    }
  }, [timer, state.settings]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const t = WorkoutStore.getTimer();
      if (t && t.remainSec <= 0 && !t.alarmed) {
        WorkoutStore.markTimerAlarmed();
        alarm(t.label || '휴식 종료', state.settings);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [state.settings]);

  const value = useMemo(() => ({
    state,
    timer,
    store: WorkoutStore,
  }), [state, timer]);

  return (
    <WorkoutContext.Provider value={value}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
  return ctx;
}
