import { expect, type Page } from '@playwright/test';

/** Readable text keeps 4.5:1; deliberately dimmed actions require their explanatory hint. */
export async function assertLobbyContrast(page: Page) {
  const selectors = [
    '.lobby-heading h2',
    '.lobby-heading .eyebrow',
    '.lobby-config-column > h3',
    '.room-lobby label',
    ".room-lobby input:not([type='radio']):not([type='checkbox'])",
    '.option-caption > strong',
    '.option-caption small',
    '.pixel-options span',
    '.pixel-switch small',
    '.room-lobby select',
    '.lobby-settings legend',
    '.settings-locked-note',
    '.settings-readonly dt',
    '.settings-readonly dd',
    '.room-privacy span',
    '.room-privacy strong',
    '.lobby-players-column > h3',
    '.team-heading h4',
    '.team-heading > span',
    '.seat-info > strong',
    '.seat-status',
    '.seat-badge',
    '.lobby-requirements p',
    '.room-lobby button',
    '.invite-help summary',
  ];
  const targets = page.locator(selectors.map((selector) => `.lobby-shell ${selector}`).join(', '));
  expect(await targets.count()).toBeGreaterThan(20);

  for (const target of await targets.all()) {
    if (!(await target.isVisible())) continue;
    const sample = await target.evaluate((element) => {
      const view = element.ownerDocument.defaultView;
      if (!view) throw new Error('MISSING_WINDOW');
      const style = view.getComputedStyle(element);
      const backgrounds: string[] = [];
      let node = element;

      while (node) {
        const layer = view.getComputedStyle(node);
        const stops: string[] = layer.backgroundImage.match(/rgba?\([^)]+\)/g) ?? [];
        backgrounds.push(...stops);
        if (
          layer.backgroundImage.startsWith('linear-gradient(') &&
          stops.length >= 2 &&
          stops.every((color) => color.startsWith('rgb('))
        )
          break;
        const channels = layer.backgroundColor.match(/[\d.]+/g)?.map(Number);
        if (channels?.length === 3 || channels?.[3] === 1) {
          backgrounds.push(layer.backgroundColor);
          break;
        }
        if (channels?.[3] !== 0) throw new Error('TRANSLUCENT_TEXT_SURFACE');
        if (!node.parentElement) throw new Error('MISSING_OPAQUE_SURFACE');
        node = node.parentElement;
      }

      return {
        color: style.color,
        backgrounds,
        size: Number.parseFloat(style.fontSize),
        opacity: style.opacity,
        disabled: element.matches('button:disabled'),
        reason: element.getAttribute('data-disabled-reason'),
        label: element.textContent?.trim() || element.getAttribute('aria-label') || element.tagName,
      };
    });

    expect(sample.backgrounds.length, sample.label).toBeGreaterThan(0);
    expect(sample.size, sample.label).toBeGreaterThanOrEqual(14);
    if (sample.disabled) {
      expect(sample.opacity, sample.label).toBe('0.25');
      expect(sample.reason, sample.label).toBeTruthy();
      continue;
    }
    expect(sample.opacity, sample.label).toBe('1');
    for (const background of sample.backgrounds) {
      const foregroundLuminance = luminance(sample.color);
      const backgroundLuminance = luminance(background);
      const ratio =
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
      expect(ratio, `${sample.label}: ${sample.color} / ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  }
}

export async function assertTooltipContrast(page: Page) {
  const sample = await page.getByRole('tooltip').evaluate((element) => {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (!style) throw new Error('Tooltip sem estilo computado.');

    return { color: style.color, background: style.backgroundColor, opacity: style.opacity };
  });
  const foreground = luminance(sample.color);
  const background = luminance(sample.background);
  expect(
    (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
  ).toBeGreaterThanOrEqual(4.5);
  expect(sample.opacity).toBe('1');
}

function luminance(color: string) {
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (channels?.length !== 3) throw new Error(`Unsupported color: ${color}`);
  const linear = channels.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}
