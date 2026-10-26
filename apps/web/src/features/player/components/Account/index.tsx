import { useState } from 'react';
import type { PlayerController } from '../../hooks/use-player';
import { PlayerSummary } from '../Summary';
import { AuthForm } from './AuthForm';
import { ManageAccount } from './Manage';
import { RecoveryCode } from './RecoveryCode';

export function Account({
  player,
  nickname,
  onGuest,
}: {
  player: PlayerController;
  nickname: string;
  onGuest?: (() => void) | undefined;
}) {
  const [code, setCode] = useState('');
  const [authenticated, setAuthenticated] = useState(Boolean(player.profile));

  // A one-time recovery code must disappear when account ownership changes.
  if (authenticated !== Boolean(player.profile)) {
    setAuthenticated(Boolean(player.profile));
    setCode('');
  }

  return (
    <>
      {player.profile && <PlayerSummary profile={player.profile} />}
      {code && <RecoveryCode code={code} />}
      {player.profile ? (
        <ManageAccount player={player} onCode={setCode} />
      ) : (
        <AuthForm player={player} nickname={nickname} onCode={setCode} onGuest={onGuest} />
      )}
    </>
  );
}
