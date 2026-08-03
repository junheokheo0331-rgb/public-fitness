import { useRef, useState } from 'react';

/** workoutapp bindExerciseListDnD 이식 — HTML5 드래그로 순서 변경 */
export default function SortableList({ items, onReorder, keyOf, children }) {
  const [from, setFrom] = useState(null);
  const [over, setOver] = useState(null);
  const lastY = useRef(0);
  const scrolling = useRef(false);
  const raf = useRef(null);

  const stopScroll = () => {
    scrolling.current = false;
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  };

  const tickScroll = () => {
    if (!scrolling.current) return;
    const edge = 88;
    const h = window.innerHeight || 600;
    let dy = 0;
    if (lastY.current < edge) dy = -Math.ceil((edge - lastY.current) / 6 + 6);
    else if (lastY.current > h - edge) dy = Math.ceil((lastY.current - (h - edge)) / 6 + 6);
    if (dy) window.scrollBy(0, Math.max(-32, Math.min(32, dy)));
    raf.current = requestAnimationFrame(tickScroll);
  };

  const onDocDragOver = (e) => {
    lastY.current = e.clientY;
    if (!scrolling.current) {
      scrolling.current = true;
      tickScroll();
    }
  };

  return (
    <div className="sortable">
      {items.map((item, index) => (
        <div
          key={keyOf ? keyOf(item, index) : item.id || index}
          className={`sortable__item ${from === index ? 'is-dragging' : ''} ${over === index && from !== index ? 'is-over' : ''}`}
          draggable
          data-drag-idx={index}
          onDragStart={(e) => {
            setFrom(index);
            try {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(index));
            } catch { /* ignore */ }
            document.addEventListener('dragover', onDocDragOver);
          }}
          onDragEnd={() => {
            setFrom(null);
            setOver(null);
            document.removeEventListener('dragover', onDocDragOver);
            stopScroll();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(index);
            try { e.dataTransfer.dropEffect = 'move'; } catch { /* ignore */ }
          }}
          onDragLeave={() => setOver((o) => (o === index ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            setOver(null);
            const src = from != null ? from : parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (!Number.isNaN(src) && src !== index) onReorder(src, index);
            setFrom(null);
          }}
        >
          <div className="sortable__handle" title="끌어서 순서 변경" aria-hidden="true">⋮⋮</div>
          <div className="sortable__body">{children(item, index)}</div>
        </div>
      ))}
    </div>
  );
}

export function reorder(list, from, to) {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
