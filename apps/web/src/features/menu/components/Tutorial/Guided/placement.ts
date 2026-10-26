export type Box = { x: number; y: number; width: number; height: number };
export type Placement = { x: number; y: number; side: 'top' | 'bottom' | 'left' | 'right' };

/** Keep the coach beside its target, inside the visible viewport, without covering it. */
export function placeCoach(
  target: Box,
  coach: Box,
  viewport: { width: number; height: number },
): Placement {
  const gap = 16;
  const inset = 12;
  const centerX = target.x + (target.width - coach.width) / 2;
  const centerY = target.y + (target.height - coach.height) / 2;
  const candidates: Placement[] = [
    { x: centerX, y: target.y - coach.height - gap, side: 'top' },
    { x: centerX, y: target.y + target.height + gap, side: 'bottom' },
    { x: target.x - coach.width - gap, y: centerY, side: 'left' },
    { x: target.x + target.width + gap, y: centerY, side: 'right' },
  ];
  const area = (a: Box, b: Box) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const screen = {
    x: inset,
    y: inset,
    width: viewport.width - inset * 2,
    height: viewport.height - inset * 2,
  };
  let best = candidates[0] ?? { x: inset, y: inset, side: 'top' as const };
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const box = {
      ...candidate,
      x: Math.max(inset, Math.min(candidate.x, viewport.width - coach.width - inset)),
      y: Math.max(inset, Math.min(candidate.y, viewport.height - coach.height - inset)),
      width: coach.width,
      height: coach.height,
    };
    const score =
      area(box, screen) -
      area(box, target) * 10 -
      Math.abs(box.x - candidate.x) -
      Math.abs(box.y - candidate.y);
    if (score > bestScore) {
      bestScore = score;
      best = { x: box.x, y: box.y, side: candidate.side };
    }
  }
  return best;
}
