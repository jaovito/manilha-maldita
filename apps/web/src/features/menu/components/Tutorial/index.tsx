import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EnergyIcon } from '../../../../shared/EnergyIcon';
import { useLocale } from '../../../../shared/i18n';
import type { Locale } from '../../../../shared/i18n/types';

const ranks = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const suits = ['♦', '♠', '♥', '♣'];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const { locale, changeLocale, messages } = useLocale();
  const text = messages.tutorial;
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [vira, setVira] = useState(4);
  const heading = useRef<HTMLHeadingElement>(null);
  const article = useRef<HTMLElement>(null);
  const lesson = text.lessons[step]!;

  useEffect(() => {
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;

    return () => {
      if (root) root.inert = wasInert;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Refocus the new lesson after navigation or translation.
  useEffect(() => {
    heading.current?.focus();
    if (article.current) article.current.scrollTop = 0;
  }, [step, locale]);

  const navigate = (next: number) => {
    setStep(next);
    setAnswer(null);
  };

  return createPortal(
    <section
      className="tutorial-shell"
      role="dialog"
      aria-modal="true"
      aria-label={text.title}
      lang={locale}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        if (event.key !== 'Tab') return;

        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select'),
        ];
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
      <header className="tutorial-header">
        <div>
          <span className="tutorial-brand">MANILHA MALDITA</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
        <div className="tutorial-tools">
          <label>
            {text.language}
            <select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}>
              <option value="pt-BR">Português</option>
              <option value="en">English</option>
            </select>
          </label>
          <button type="button" onClick={onClose}>
            ← {text.back}
          </button>
        </div>
      </header>
      <div className="tutorial-layout">
        <nav className="tutorial-contents" aria-label={text.contents}>
          {text.lessons.map((item, index) => (
            <button
              type="button"
              key={item.id}
              aria-current={index === step ? 'step' : undefined}
              onClick={() => navigate(index)}
            >
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              {item.title}
            </button>
          ))}
        </nav>
        <article ref={article} className="tutorial-page" aria-labelledby="tutorial-lesson">
          <p className="tutorial-counter">
            {step + 1} / {text.lessons.length}
          </p>
          <h2 id="tutorial-lesson" ref={heading} tabIndex={-1}>
            {lesson.title}
          </h2>
          <p className="tutorial-lead">{lesson.lead}</p>
          {lesson.id === 'start' && (
            <div className="tutorial-score" aria-hidden="true">
              3 <span>♠ ♥ ♣ ♦</span> 12
            </div>
          )}
          {(lesson.id === 'ranks' || lesson.id === 'manilhas') && (
            <div className="tutorial-demo">
              <div className="tutorial-scale">
                <span>{text.weakest}</span>
                <span>{text.strongest} →</span>
              </div>
              <ol className="tutorial-ranks">
                {ranks.map((rank) => (
                  <li key={rank}>
                    <span className="lesson-card" role="img" aria-label={rank}>
                      <b>{rank}</b>
                      <span aria-hidden="true">♠</span>
                    </span>
                  </li>
                ))}
              </ol>
              {lesson.id === 'manilhas' && (
                <>
                  <label className="tutorial-vira">
                    {text.vira}
                    <select value={vira} onChange={(event) => setVira(Number(event.target.value))}>
                      {ranks.map((rank, index) => (
                        <option key={rank} value={index}>
                          {rank}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="tutorial-trumps" aria-live="polite">
                    <h3>
                      {text.manilhas}: {ranks[(vira + 1) % ranks.length]}
                    </h3>
                    <p>{text.suitOrder}</p>
                    <div className="tutorial-suits">
                      {suits.map((suit, index) => (
                        <div key={suit}>
                          <span
                            className={`lesson-card ${index % 2 === 0 ? 'lesson-red' : ''}`}
                            role="img"
                            aria-label={`${ranks[(vira + 1) % ranks.length]} ${text.suits[index]}`}
                          >
                            <b>{ranks[(vira + 1) % ranks.length]}</b>
                            <span aria-hidden="true">{suit}</span>
                          </span>
                          <span>{text.suits[index]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="tutorial-blocks">
            {lesson.blocks.map((block) => (
              <section key={block.title}>
                <h3>{block.title}</h3>
                <p>{block.body}</p>
              </section>
            ))}
          </div>
          {lesson.id === 'powers' && (
            <div className="tutorial-powers">
              {text.powers.map((power) => (
                <section key={power.id}>
                  <div
                    className={`tutorial-power-art power-card power-${power.id}`}
                    aria-hidden="true"
                  >
                    <span className="power-card-title">{power.name}</span>
                    <span className="power-card-illustration">
                      <span className="power-card-cost">
                        <EnergyIcon /> {power.cost}
                      </span>
                    </span>
                    <span className="power-card-hint">{power.description}</span>
                  </div>
                  <div>
                    <h3>{power.name}</h3>
                    <p className="tutorial-power-cost">
                      <EnergyIcon /> {power.cost} {text.energy} · {power.timing}
                    </p>
                    <p>{power.description}</p>
                    <p className="tutorial-power-tip">{power.tip}</p>
                  </div>
                </section>
              ))}
            </div>
          )}
          <section className="tutorial-practice" aria-label={text.practice}>
            <p className="tutorial-kicker">{text.practice}</p>
            <h3>{lesson.question}</h3>
            <div className="tutorial-choices">
              {lesson.choices.map((choice, index) => (
                <button
                  type="button"
                  key={choice}
                  aria-pressed={answer === index}
                  onClick={() => setAnswer(index)}
                >
                  {choice}
                </button>
              ))}
            </div>
            {answer !== null && (
              <p
                className="tutorial-explanation"
                role="status"
                data-correct={answer === lesson.answer}
              >
                <strong>{answer === lesson.answer ? text.correct : text.retry}</strong>{' '}
                {lesson.explanation}
              </p>
            )}
          </section>
        </article>
      </div>
      <footer className="tutorial-footer">
        <button type="button" disabled={step === 0} onClick={() => navigate(step - 1)}>
          ← {text.previous}
        </button>
        <span>
          {step + 1} / {text.lessons.length}
        </span>
        {step < text.lessons.length - 1 ? (
          <button type="button" onClick={() => navigate(step + 1)}>
            {text.next} →
          </button>
        ) : (
          <button type="button" onClick={onClose}>
            {text.finish} ✓
          </button>
        )}
      </footer>
    </section>,
    document.body,
  );
}
