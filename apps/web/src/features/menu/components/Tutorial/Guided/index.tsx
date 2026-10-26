import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { LanguageSelect } from '../../../../../shared/Settings';
import { t, useLocale } from '../../../../../shared/i18n';
import { firstLesson, guidedLessons } from './lessons';
import { GuidedScene } from './Scene';
import { anchorSelector, useAnchor } from './useAnchor';

export function GuidedTutorial({ onBack, onExit }: { onBack: () => void; onExit: () => void }) {
  const { locale } = useLocale();
  const [step, setStep] = useState(0);
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(false);
  const root = useRef<HTMLElement>(null);
  const coach = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const lesson = guidedLessons[step] ?? firstLesson;
  const waiting = Boolean(lesson.action) && !done;
  const selector = anchorSelector(lesson, armed, done);
  const anchor = useAnchor(root, coach, selector, `${step}:${armed}:${done}:${locale}`);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Read the new lesson after navigation or translation.
  useEffect(() => {
    heading.current?.focus();
  }, [step, locale]);

  const navigate = (next: number) => {
    setStep(next);
    setArmed(false);
    setDone(false);
  };

  return createPortal(
    <section
      ref={root}
      className="guided-tutorial"
      role="dialog"
      aria-modal="true"
      aria-label={t('Tutorial guiado')}
      lang={locale}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onBack();
        if (event.key !== 'Tab') return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), select, summary',
          ),
        ].filter(
          (control) => control.tagName === 'SUMMARY' || !control.closest('details:not([open])'),
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === heading.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <GuidedScene
        lesson={lesson}
        armed={armed}
        done={done}
        onPower={() => setArmed((value) => !value)}
        onCard={() => setDone(true)}
        onSpy={() => setDone(true)}
        onRaise={() => setDone(true)}
      />
      {anchor && (
        <div
          className="guided-spotlight"
          aria-hidden="true"
          style={{
            left: anchor.target.x - 6,
            top: anchor.target.y - 6,
            width: anchor.target.width + 12,
            height: anchor.target.height + 12,
          }}
        />
      )}
      <aside
        ref={coach}
        className="guided-coach"
        aria-labelledby="guided-lesson-title"
        data-anchor={selector}
        data-placement={anchor?.position.side}
        style={
          anchor
            ? ({
                left: anchor.position.x,
                top: anchor.position.y,
                maxHeight: anchor.maxHeight,
                '--guided-arrow-x': `${anchor.arrow.x}px`,
                '--guided-arrow-y': `${anchor.arrow.y}px`,
              } as CSSProperties)
            : { left: 12, top: 100 }
        }
      >
        <div className="guided-toolbar">
          <button type="button" onClick={onBack}>
            {t('Voltar ao guia')}
          </button>
          <details
            onChangeCapture={(event) => {
              event.currentTarget.open = false;
            }}
          >
            <summary>{t('Idioma do jogo')}</summary>
            <LanguageSelect />
          </details>
        </div>
        <div className="guided-coach-reading" key={`${step}:${locale}`}>
          <span className="guided-kicker">{t('Aprenda jogando')}</span>
          <p className="guided-progress">
            {t('Etapa {0} de {1}', [step + 1, guidedLessons.length])}
          </p>
          <progress value={step + 1} max={guidedLessons.length} aria-label={t('Tutorial guiado')} />
          <h2 ref={heading} tabIndex={-1} id="guided-lesson-title">
            {t(lesson.title)}
          </h2>
          <p className="guided-explanation" aria-live="polite" role="status" data-complete={done}>
            {t(done && lesson.result ? lesson.result : lesson.body)}
          </p>
          {lesson.id === 'suits' && (
            <section className="guided-suit-order" aria-label={t('Manilhas desta mão')}>
              <span>2 ♦</span> &lt; <span>2 ♠</span> &lt; <span>2 ♥</span> &lt; <span>2 ♣</span>
            </section>
          )}
          {waiting && (
            <p className="guided-instruction">{t('Faça a ação destacada para continuar.')}</p>
          )}
        </div>
        <nav className="guided-navigation" aria-label={t('Tutorial guiado')}>
          <button type="button" onClick={() => navigate(step - 1)} disabled={step === 0}>
            {t('Anterior')}
          </button>
          {step === guidedLessons.length - 1 ? (
            <button type="button" className="button-primary" onClick={onExit}>
              {t('Concluir e voltar ao menu')}
            </button>
          ) : (
            <button
              type="button"
              className="button-primary"
              disabled={waiting}
              onClick={() => navigate(step + 1)}
            >
              {t('Continuar tutorial')}
            </button>
          )}
          <button type="button" className="guided-restart" onClick={() => navigate(0)}>
            {t('Recomeçar tutorial')}
          </button>
        </nav>
      </aside>
    </section>,
    document.body,
  );
}
