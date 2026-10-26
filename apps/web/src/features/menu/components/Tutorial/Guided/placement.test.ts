import { expect, test } from 'bun:test';
import { placeCoach } from './placement';

test('coach chooses room beside the target without covering it or leaving the viewport', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 667 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    const coach = { x: 0, y: 0, width: Math.min(310, viewport.width - 24), height: 280 };
    const targets = [
      { x: viewport.width / 2 - 90, y: viewport.height - 150, width: 180, height: 100 },
      { x: viewport.width - 70, y: 30, width: 50, height: 120 },
      { x: 20, y: viewport.height - 120, width: 60, height: 80 },
      { x: viewport.width / 2 - 100, y: 10, width: 200, height: 60 },
    ];
    for (const target of targets) {
      const position = placeCoach(target, coach, viewport);
      expect(position.x).toBeGreaterThanOrEqual(12);
      expect(position.y).toBeGreaterThanOrEqual(12);
      expect(position.x + coach.width).toBeLessThanOrEqual(viewport.width - 12);
      expect(position.y + coach.height).toBeLessThanOrEqual(viewport.height - 12);
      const overlap =
        Math.max(
          0,
          Math.min(target.x + target.width, position.x + coach.width) -
            Math.max(target.x, position.x),
        ) *
        Math.max(
          0,
          Math.min(target.y + target.height, position.y + coach.height) -
            Math.max(target.y, position.y),
        );
      expect(overlap).toBe(0);
    }
  }
});
