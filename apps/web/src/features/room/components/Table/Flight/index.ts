import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import type { RoomView } from '@truco/game-protocol';

const duration = 380;

export function useCardFlight(room: RoomView) {
  const tableRef = useRef<HTMLElement>(null);
  const previous = useRef<{ context: string; ids: Set<string>; paused: boolean } | null>(null);
  const origins = useRef(new Map<number, DOMRect>());
  const selected = useRef<DOMRect | null>(null);
  const flights = useRef(new Set<Animation>());
  const context = `${room.matchId}:${room.match?.hand.number}:${room.selfSeat}`;

  const captureCard = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest<HTMLButtonElement>('.hand-cards .card');
    if (card && !card.disabled) selected.current = card.getBoundingClientRect();
  };

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const cards = Array.from(table.querySelectorAll<HTMLElement>('[data-play-id]'));
    const last = previous.current;
    const sameHand = last?.context === context;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!sameHand || room.paused) {
      for (const flight of flights.current) flight.cancel();
      selected.current = null;
    }

    for (const card of cards) {
      const id = card.dataset.playId ?? '';
      const relative = Number(card.dataset.relative);
      const face = card.querySelector<HTMLElement>(':scope > span');
      const origin =
        relative === 0
          ? (selected.current ?? origins.current.get(0))
          : origins.current.get(relative);
      if (
        sameHand &&
        !last.paused &&
        !room.paused &&
        !last.ids.has(id) &&
        !reduced &&
        origin &&
        face?.animate
      ) {
        card.dataset.flying = 'true';
        const destination = face.getBoundingClientRect();
        if (destination.width > 0 && origin.width > 0) {
          const dx = origin.x + origin.width / 2 - destination.x - destination.width / 2;
          const dy = origin.y + origin.height / 2 - destination.y - destination.height / 2;
          // Animate only the authorized face/verso already rendered by the table.
          const flight = face.animate(
            [
              {
                transform: `translate(${dx}px, ${dy}px) scale(${origin.width / destination.width}) rotate(-6deg)`,
              },
              { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
            ],
            { duration, easing: 'cubic-bezier(0.22, 0.7, 0.25, 1)' },
          );
          flights.current.add(flight);
          const clear = () => {
            delete card.dataset.flying;
            flights.current.delete(flight);
          };
          flight.onfinish = clear;
          flight.oncancel = clear;
        }
        if (destination.width <= 0 || origin.width <= 0) delete card.dataset.flying;
        if (relative === 0) selected.current = null;
      }
    }

    previous.current = {
      context,
      ids: new Set(cards.map((card) => card.dataset.playId ?? '')),
      paused: room.paused,
    };
    const captureOrigins = () => {
      origins.current.clear();
      const count = room.match?.playerCount ?? 0;
      for (let relative = 0; relative < count; relative++) {
        const source = table.querySelector<HTMLElement>(
          relative === 0 ? '.hand-cards .card' : `.seat-relative-${relative} .mini-card`,
        );
        if (source) origins.current.set(relative, source.getBoundingClientRect());
      }
    };
    captureOrigins();
    window.addEventListener('resize', captureOrigins);
    return () => window.removeEventListener('resize', captureOrigins);
  }, [room, context]);

  useLayoutEffect(
    () => () => {
      for (const flight of flights.current) flight.cancel();
    },
    [],
  );

  return { tableRef, captureCard };
}
