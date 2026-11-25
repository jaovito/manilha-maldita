type Box = { left: number; top: number; bottom: number; width: number };

export function tooltipPosition(
  anchor: Box,
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const gap = 10;
  const margin = 8;
  const maxLeft = Math.max(margin, viewport.width - tooltip.width - margin);
  const maxTop = Math.max(margin, viewport.height - tooltip.height - margin);
  const above = anchor.top - tooltip.height - gap;

  return {
    left: Math.min(maxLeft, Math.max(margin, anchor.left + (anchor.width - tooltip.width) / 2)),
    top: Math.min(maxTop, Math.max(margin, above >= margin ? above : anchor.bottom + gap)),
  };
}
