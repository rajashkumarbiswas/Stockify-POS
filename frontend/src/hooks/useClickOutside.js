import { useEffect } from 'react';

/** Calls handler when the user clicks outside `ref` or presses Escape (only while `active`). */
export default function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;

    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handler();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handler();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, handler, active]);
}