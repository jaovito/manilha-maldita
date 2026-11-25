import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tooltipPosition } from './position';

export { disabledHint } from './hint';

type Hint = { target: HTMLElement; reason: string };

function hintedControl(target: EventTarget | null): Hint | null {
  if (!(target instanceof Element)) return null;

  const control =
    target.closest<HTMLElement>('[aria-disabled="true"][data-disabled-reason]') ??
    target.closest<HTMLElement>('[data-disabled-reason]');
  const reason = control?.dataset.disabledReason;
  return control && reason ? { target: control, reason } : null;
}

/** One portal avoids clipped tooltips and introduces no wrappers into the game layout. */
export function DisabledTooltip() {
  const [hint, setHint] = useState<Hint | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const active = useRef<Hint | null>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    let dismissal: number | undefined;
    const cancelDismissal = () => {
      window.clearTimeout(dismissal);
      dismissal = undefined;
    };
    const display = (next: Hint | null) => {
      cancelDismissal();
      const current = active.current;
      if (next?.target === current?.target && next?.reason === current?.reason) return;

      active.current = next;
      setHint(next);
    };
    const insideTooltip = (target: EventTarget | null) =>
      target instanceof Node && Boolean(tooltip.current?.contains(target));
    const close = () => display(null);
    const closeAfterCrossing = () => {
      if (!active.current) return;

      cancelDismissal();
      dismissal = window.setTimeout(close, 120);
    };
    const point = (event: PointerEvent) => {
      if (insideTooltip(event.target)) {
        cancelDismissal();
        return;
      }

      const next = hintedControl(event.target);
      if (next) display(next);
      else if (event.type === 'pointerdown') close();
      else closeAfterCrossing();
    };
    const focus = (event: FocusEvent) => {
      if (!insideTooltip(event.target)) display(hintedControl(event.target));
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (!event.relatedTarget) {
        close();
        return;
      }
      if (
        insideTooltip(event.relatedTarget) ||
        (event.relatedTarget instanceof Node &&
          active.current?.target.contains(event.relatedTarget))
      ) {
        cancelDismissal();
        return;
      }

      closeAfterCrossing();
    };
    const scroll = (event: Event) => {
      if (!insideTooltip(event.target)) close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const observer = new MutationObserver(() => {
      const current = active.current;
      if (
        current &&
        (!current.target.isConnected || hintedControl(current.target)?.reason !== current.reason)
      )
        close();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-disabled-reason', 'disabled', 'aria-disabled'],
    });
    document.addEventListener('pointerover', point, true);
    document.addEventListener('pointerdown', point, true);
    document.addEventListener('pointerout', leave, true);
    document.addEventListener('focusin', focus);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);

    return () => {
      cancelDismissal();
      observer.disconnect();
      document.removeEventListener('pointerover', point, true);
      document.removeEventListener('pointerdown', point, true);
      document.removeEventListener('pointerout', leave, true);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', close);
    };
  }, []);

  useLayoutEffect(() => {
    if (!hint || !tooltip.current) return;

    const previous = hint.target.getAttribute('aria-describedby');
    const previousTitle = hint.target.getAttribute('title');
    hint.target.removeAttribute('title');
    hint.target.setAttribute('aria-describedby', [previous, id].filter(Boolean).join(' '));
    setPosition(
      tooltipPosition(
        hint.target.getBoundingClientRect(),
        tooltip.current.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );

    return () => {
      const descriptions = hint.target
        .getAttribute('aria-describedby')
        ?.split(/\s+/)
        .filter((token) => token && token !== id)
        .join(' ');
      if (descriptions) hint.target.setAttribute('aria-describedby', descriptions);
      else hint.target.removeAttribute('aria-describedby');

      // React may already have changed or removed the reason while this tooltip closes.
      if (
        previousTitle !== null &&
        hint.target.getAttribute('title') === null &&
        hint.target.dataset.disabledReason === hint.reason
      )
        hint.target.setAttribute('title', previousTitle);
    };
  }, [hint, id]);

  return hint
    ? createPortal(
        <div className="disabled-tooltip" id={id} role="tooltip" ref={tooltip} style={position}>
          {hint.reason}
        </div>,
        document.body,
      )
    : null;
}
