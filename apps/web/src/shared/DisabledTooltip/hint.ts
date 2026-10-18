/** Keep native disabled behavior and supply the same reason to all presentations. */
export function disabledHint(reason: string | null | undefined) {
  return {
    title: reason || undefined,
    'aria-description': reason || undefined,
    'data-disabled-reason': reason || undefined,
  };
}
