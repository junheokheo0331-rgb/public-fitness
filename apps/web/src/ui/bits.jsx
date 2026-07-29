/* 공용 조각들. 화면마다 다시 만들지 않는다. */

import { useNavigate } from 'react-router-dom';

export function TopBar({ title, sub, back, right }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button className="topbar__back" onClick={() => nav(-1)} aria-label="뒤로">←</button>
      )}
      <div className="grow">
        <h1 className="topbar__title">{title}</h1>
        {sub && <p className="topbar__sub">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Card({ title, note, right, children, flush, className = '' }) {
  return (
    <section className={`card ${flush ? 'card--flush' : ''} ${className}`}>
      {(title || right) && (
        <div className="card__head" style={flush ? { padding: '16px 16px 0' } : undefined}>
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {note && <p className="card__note">{note}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/* ── 시그니처: 원판 스택 수치 ──
   중량·금액·개수를 봉에 끼운 원판처럼 보여준다.
   이 앱의 내용물은 숫자라는 걸 화면이 스스로 말하게 하는 장치다. */
export function Plate({ value, unit, ghost, sub }) {
  return (
    <div>
      <span className={`plate ${ghost ? 'plate--ghost' : ''}`}>
        <span className="plate__num">{value}</span>
        {unit && <span className="plate__unit">{unit}</span>}
      </span>
      {sub && <div className="tiny muted" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/** 세트 진행 눈금. 완료한 세트는 노랑, 지금 할 세트는 검정. */
export function Stack({ total, done = 0, current = -1 }) {
  return (
    <div className="stack" aria-label={`${total}세트 중 ${done}세트 완료`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`stack__bar ${i < done ? 'stack__bar--on' : ''} ${i === current ? 'stack__bar--now' : ''}`}
          style={{ height: `${12 + (i % 3) * 5}px` }}
        />
      ))}
    </div>
  );
}

export function Chip({ children, kind }) {
  return <span className={`chip ${kind ? `chip--${kind}` : ''}`}>{children}</span>;
}

export function Note({ kind, title, children }) {
  return (
    <div className={`note ${kind ? `note--${kind}` : ''}`}>
      {title && <p className="note__title">{title}</p>}
      {children}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Gauge({ value, max = 100, good }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="gauge">
      <div className={`gauge__fill ${good ? 'gauge__fill--go' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`;
export const km = (m) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);
