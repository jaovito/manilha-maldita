import { useLayoutEffect, useState, type RefObject } from 'react';
import type { GuidedLesson } from './lessons';
import { placeCoach, type Box, type Placement } from './placement';

export function anchorSelector(lesson: GuidedLesson, armed: boolean, done: boolean) {
  if (done && lesson.id === 'spy') return '.spy-observation';
  if (done && lesson.id === 'exchange') return '.hand-cards';
  if (done && lesson.id === 'raise') return '.stake-score';
  if (done && (lesson.action === 'card' || lesson.id === 'boost' || lesson.id === 'mask'))
    return '.center-plays';
  if (armed && !done) return lesson.id === 'spy' ? '.seat-cards' : '.hand-cards';
  return {
    hand: '.hand-cards',
    ranks: '.guided-rank-order',
    vira: '.vira-panel',
    suits: '.vira-panel',
    plays: '.center-plays',
    score: '.scoreboard',
    raise: '.action-truco',
    energy: '.power-energy',
    power: done ? '.power-energy' : '.power-card',
  }[lesson.focus];
}

export function useAnchor(
  root: RefObject<HTMLElement | null>,
  coach: RefObject<HTMLElement | null>,
  selector: string,
  context: string,
) {
  const [anchor, setAnchor] = useState<{
    target: Box;
    position: Placement;
    maxHeight: number;
    arrow: { x: number; y: number };
  } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Selection/result changes can move the same target.
  useLayoutEffect(() => {
    const container = root.current;
    const target = container?.querySelector<HTMLElement>(selector);
    const panel = coach.current;
    if (!target || !panel) return;
    const measure = () => {
      const rect = target.getBoundingClientRect();
      const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      const panelBox = panel.getBoundingClientRect();
      const beside =
        box.x >= panelBox.width + 28 ||
        window.innerWidth - box.x - box.width >= panelBox.width + 28;
      const cap = window.innerWidth <= 600 || window.innerHeight <= 500 ? 300 : 440;
      const maxHeight = Math.max(
        160,
        Math.min(
          cap,
          window.innerHeight - 24,
          beside ? cap : Math.max(box.y - 28, window.innerHeight - box.y - box.height - 28),
        ),
      );
      const position = placeCoach(box, panelBox, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      const arrow = {
        x: Math.max(18, Math.min(panelBox.width - 18, box.x + box.width / 2 - position.x)),
        y: Math.max(18, Math.min(panelBox.height - 18, box.y + box.height / 2 - position.y)),
      };
      setAnchor((previous) =>
        JSON.stringify(previous) === JSON.stringify({ target: box, position, maxHeight, arrow })
          ? previous
          : { target: box, position, maxHeight, arrow },
      );
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(target);
    observer?.observe(panel);
    // The desktop power sleeve grows upward on hover without resizing the card itself.
    const dock = target.closest('.power-dock');
    if (dock) observer?.observe(dock);
    container?.addEventListener('transitionend', measure, true);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      container?.removeEventListener('transitionend', measure, true);
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [root, coach, selector, context]);
  return anchor;
}
