import { useState } from 'react';
import { calculateHeartZones } from '@gymlink/core/time';
import { useWorkout } from '../../lib/workout/WorkoutContext.jsx';
import { TopBar, Card, Field, Note } from '../../ui/bits.jsx';

const LIFTS = ['스쿼트', '벤치프레스', '데드리프트'];

export default function WorkoutSettings() {
  const { state, store } = useWorkout();
  const s = state.settings;
  const [msg, setMsg] = useState(null);

  const zones = calculateHeartZones(Number(s.age) || null, Number(s.rhr) || 70);

  const flash = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2000);
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(store.exportJSON(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gymlink-workout-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('백업 파일을 내려받았습니다.');
  };

  const importBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const obj = JSON.parse(await file.text());
        store.importJSON(obj);
        flash('복원했습니다.');
      } catch (e) {
        flash(e.message || '복원 실패');
      }
    };
    input.click();
  };

  const wipe = () => {
    if (!confirm('모든 운동 데이터를 삭제할까요? 되돌릴 수 없습니다.')) return;
    store.wipe();
    flash('초기화했습니다.');
  };

  const askNotify = async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      store.updateSettings({ notify: true });
      return;
    }
    const p = await Notification.requestPermission();
    store.updateSettings({ notify: p === 'granted' });
  };

  return (
    <>
      <TopBar title="운동 설정" back />

      {msg && <Note kind="go"><p className="small">{msg}</p></Note>}

      <Card title="단위 · 증량">
        <Field label="중량 단위">
          <select className="input" value={s.unit} onChange={(e) => store.updateSettings({ unit: e.target.value })}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </Field>
        <div className="rowfields">
          <Field label="바벨 단위">
            <input className="input input--num" value={s.unitBar} onChange={(e) => store.updateSettings({ unitBar: Number(e.target.value) })} />
          </Field>
          <Field label="머신 단위">
            <input className="input input--num" value={s.unitMachine} onChange={(e) => store.updateSettings({ unitMachine: Number(e.target.value) })} />
          </Field>
          <Field label="덤벨 단위">
            <input className="input input--num" value={s.unitDumbbell} onChange={(e) => store.updateSettings({ unitDumbbell: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="rowfields">
          <Field label="상승 상한 (비율)">
            <input className="input input--num" value={s.capUp} onChange={(e) => store.updateSettings({ capUp: Number(e.target.value) })} />
          </Field>
          <Field label="하락 상한 (비율)">
            <input className="input input--num" value={s.capDown} onChange={(e) => store.updateSettings({ capDown: Number(e.target.value) })} />
          </Field>
        </div>
      </Card>

      <Card title="기준 리프트 (시작 무게)">
        {LIFTS.map((lift) => (
          <div key={lift} className="rowfields" style={{ marginBottom: 8 }}>
            <Field label={lift}>
              <input
                className="input input--num"
                placeholder="kg"
                value={s.baseline[lift]?.w ?? 0}
                onChange={(e) => store.setBaseline(lift, 'w', Number(e.target.value))}
              />
            </Field>
            <Field label="반복">
              <input
                className="input input--num"
                value={s.baseline[lift]?.reps ?? 1}
                onChange={(e) => store.setBaseline(lift, 'reps', Number(e.target.value))}
              />
            </Field>
            <Field label="RIR">
              <input
                className="input input--num"
                value={s.baseline[lift]?.rir ?? 0}
                onChange={(e) => store.setBaseline(lift, 'rir', Number(e.target.value))}
              />
            </Field>
          </div>
        ))}
      </Card>

      <Card title="유산소 · 심박">
        <div className="rowfields">
          <Field label="나이">
            <input className="input input--num" value={s.age ?? ''} onChange={(e) => store.updateSettings({ age: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="안정 심박">
            <input className="input input--num" value={s.rhr} onChange={(e) => store.updateSettings({ rhr: Number(e.target.value) })} />
          </Field>
          <Field label="성별">
            <select className="input" value={s.gender} onChange={(e) => store.updateSettings({ gender: e.target.value })}>
              <option value="male">남</option>
              <option value="female">여</option>
            </select>
          </Field>
          <Field label="유산소 목표(분)">
            <input className="input input--num" value={s.cardioMin} onChange={(e) => store.updateSettings({ cardioMin: Number(e.target.value) })} />
          </Field>
        </div>
        {zones && (
          <Note kind="volt" title="참고 심박 구간">
            <p className="small">
              가볍게 {zones.zone2[0]}–{zones.zone2[1]} · 중간 {zones.zone3[0]}–{zones.zone3[1]} · 고강도 {zones.zone4[0]}–{zones.zone4[1]} bpm
            </p>
          </Note>
        )}
      </Card>

      <Card title="타이머 · 알림">
        {[
          ['autoRest', '세트 완료 시 자동 휴식'],
          ['sound', '휴식 종료 소리'],
          ['vibrate', '진동'],
          ['notify', '브라우저 알림'],
          ['wakelock', '화면 켜짐 유지'],
        ].map(([key, label]) => (
          <label key={key} className="row row--between" style={{ marginBottom: 10, cursor: 'pointer' }}>
            <span className="small">{label}</span>
            <input
              type="checkbox"
              checked={!!s[key]}
              onChange={(e) => {
                if (key === 'notify' && e.target.checked) askNotify();
                else store.updateSettings({ [key]: e.target.checked });
              }}
            />
          </label>
        ))}
      </Card>

      <Card title="백업">
        <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={exportBackup}>
          JSON 내보내기
        </button>
        <button type="button" className="btn btn--ghost btn--block btn--sm" style={{ marginTop: 8 }} onClick={importBackup}>
          JSON 가져오기
        </button>
        <button type="button" className="btn btn--stop btn--block btn--sm" style={{ marginTop: 8 }} onClick={wipe}>
          전체 초기화
        </button>
      </Card>

      <Note title="자동조절">
        <p className="small">
          메인 리프트는 지난 수행·RIR로 다음 무게를 잡고, 보조는 반복을 올린 뒤 무게를 올립니다.
        </p>
      </Note>
    </>
  );
}
