'use client';

import { useRef } from 'react';
export function SheetHandle({
  expanded,
  onChange
}: {
  expanded: boolean;
  onChange: (expanded: boolean) => void;
}) {
  const start = useRef<number | null>(null);
  const dragged = useRef(false);
  return <button className="sheet-handle" aria-label={expanded ? 'Mostrar mapa' : 'Ocultar mapa'} aria-expanded={expanded} onPointerDown={event => {
    start.current = event.clientY;
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerUp={event => {
    if (start.current !== null && Math.abs(event.clientY - start.current) > 24) {
      dragged.current = true;
      onChange(event.clientY < start.current);
    }
    start.current = null;
  }} onPointerCancel={() => {
    start.current = null;
  }} onClick={() => {
    if (!dragged.current) onChange(!expanded);
    dragged.current = false;
  }}>{expanded ? 'Mostrar mapa' : 'Ocultar mapa'}</button>;
}
