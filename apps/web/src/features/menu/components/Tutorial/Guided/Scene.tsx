import type { Action } from '@truco/game-protocol';
import type { MouseEvent } from 'react';
import { Table } from '../../../../room';
import { t } from '../../../../../shared/i18n';
import type { GuidedLesson } from './lessons';
import { tutorialScenario } from './scenario';
import { RankCards } from './RankCards';

export function GuidedScene({
  lesson,
  armed,
  done,
  onPower,
  onCard,
  onSpy,
  onRaise,
}: {
  lesson: GuidedLesson;
  armed: boolean;
  done: boolean;
  onPower: () => void;
  onCard: () => void;
  onSpy: () => void;
  onRaise: () => void;
}) {
  const room = tutorialScenario(lesson, done);
  const send = (action: Action) => {
    if (done) return;
    if (action.type === 'REQUEST_RAISE' && lesson.action === 'raise') onRaise();
    else if (action.type === 'PREPARE' && action.intent.type === 'spy' && armed) onSpy();
    else if (
      action.type === 'PLAY_CARD' ||
      (action.type === 'PREPARE' && action.intent.type === 'exchange')
    )
      onCard();
  };

  const filterClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button) return;
    const validCard =
      lesson.card !== undefined &&
      button === event.currentTarget.querySelectorAll('.hand-cards .card')[lesson.card] &&
      (lesson.action === 'card' || (lesson.action === 'power-card' && armed));
    const power = Boolean(lesson.power) && button.matches('.power-card');
    const spy = lesson.action === 'spy' && armed && button.matches('.spy-target-card');
    const raise = lesson.action === 'raise' && button.matches('.action-truco');
    if (done || !(validCard || power || spy || raise)) {
      event.preventDefault();
      event.stopPropagation();
    } else if (power) onPower();
  };

  return (
    <div className="app-shell game-shell guided-scene" data-step={lesson.id}>
      <header className="app-header">
        <div className="brand">
          <h1 aria-label="Manilha Maldita">
            <img className="brand-logo" src="/art/layers/logo.png" alt="Manilha Maldita" />
          </h1>
        </div>
        <div className="header-meta">
          <p className="connection-chip is-connected">
            <span className="connection-dot" />
            {t('Tutorial guiado')}
          </p>
        </div>
      </header>
      <div className="room-stage" onClickCapture={filterClick}>
        <div className="table-surface">
          <Table key={lesson.id} room={room} send={send} />
        </div>
      </div>
      {lesson.id === 'ranks' && <RankCards />}
    </div>
  );
}
