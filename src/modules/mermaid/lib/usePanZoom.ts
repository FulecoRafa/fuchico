import { useCallback, useEffect, useRef } from "react";

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

type State = { x: number; y: number; scale: number };
type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
};

/**
 * Direct DOM transform pan/zoom (no React state) so drag/wheel stay smooth
 * under tablet-pen input rates. `reset()` re-centers at scale 1; callers
 * decide when that's appropriate (e.g. only on a diagram's first render,
 * not on every live-edit update, so the view doesn't jump while editing).
 */
export function usePanZoom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<State>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<Drag | null>(null);

  const applyTransform = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const { x, y, scale } = stateRef.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  const reset = useCallback(() => {
    stateRef.current = { x: 0, y: 0, scale: 1 };
    applyTransform();
  }, [applyTransform]);

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const { x, y, scale } = stateRef.current;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
      const ratio = nextScale / scale;
      stateRef.current = {
        scale: nextScale,
        x: cx - (cx - x) * ratio,
        y: cy - (cy - y) * ratio,
      };
      applyTransform();
    },
    [applyTransform],
  );

  // React attaches onWheel as a passive listener, so preventDefault() inside
  // a synthetic handler is silently ignored -- the browser still performs
  // its native rubber-band scroll/bounce underneath our zoom. A native
  // listener registered with { passive: false } is the only way to
  // actually suppress it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(
        e.clientX - rect.left,
        e.clientY - rect.top,
        Math.exp(-e.deltaY * 0.001),
      );
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [zoomAt]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: stateRef.current.x,
      origY: stateRef.current.y,
    };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      stateRef.current = {
        ...stateRef.current,
        x: drag.origX + (e.clientX - drag.startX),
        y: drag.origY + (e.clientY - drag.startY),
      };
      applyTransform();
    },
    [applyTransform],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }, []);

  const zoomIn = useCallback(() => {
    const el = containerRef.current;
    zoomAt((el?.clientWidth ?? 0) / 2, (el?.clientHeight ?? 0) / 2, 1.25);
  }, [zoomAt]);

  const zoomOut = useCallback(() => {
    const el = containerRef.current;
    zoomAt((el?.clientWidth ?? 0) / 2, (el?.clientHeight ?? 0) / 2, 0.8);
  }, [zoomAt]);

  return {
    containerRef,
    contentRef,
    reset,
    applyTransform,
    zoomIn,
    zoomOut,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  };
}
