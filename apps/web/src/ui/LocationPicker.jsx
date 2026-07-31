import { useEffect, useState } from 'react';
import { listAreas, getCurrentArea, setCurrentArea } from '../lib/api.js';

/* 카닥식 지역 선택. 지금은 동 단위 목록. 이후 카카오 맵으로 교체. */

export default function LocationPicker({ onChange }) {
  const [area, setArea] = useState(null);
  const [areas, setAreas] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cur, list] = await Promise.all([getCurrentArea(), listAreas()]);
      if (!alive) return;
      setArea(cur);
      setAreas(list);
    })();
    return () => { alive = false; };
  }, []);

  const pick = async (id) => {
    const next = await setCurrentArea(id);
    setArea(next);
    setOpen(false);
    onChange?.(next);
  };

  return (
    <div className="loc">
      <button type="button" className="loc__btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="loc__pin" aria-hidden="true">📍</span>
        <span className="loc__label">{area?.label ?? '지역 선택'}</span>
        <span className="loc__chev" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="loc__menu" role="listbox">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="option"
              className="loc__opt"
              aria-selected={a.id === area?.id}
              onClick={() => pick(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
