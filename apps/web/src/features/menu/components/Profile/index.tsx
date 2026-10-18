type Props = {
  nickname: string;
  busy: boolean;
  onNicknameChange: (value: string) => void;
};

export function MenuProfile({ nickname, busy, onNicknameChange }: Props) {
  return (
    <section className="guest-profile" aria-label="Seu perfil">
      <span className="avatar avatar-0" aria-hidden="true" />
      <div className="profile-info">
        <label>
          Apelido
          <input
            autoComplete="nickname"
            placeholder="Seu apelido"
            maxLength={24}
            value={nickname}
            disabled={busy}
            onChange={(event) => onNicknameChange(event.target.value)}
          />
        </label>
        <div className="profile-level">
          <span>Nível —</span>
          <small>Em breve</small>
        </div>
        <div className="profile-progress" aria-hidden="true" />
        <p className="guest-caption">Convidado · Sem cadastro</p>
        <div className="profile-economy">
          <strong>—</strong>
          <small>Em breve</small>
          <button type="button" disabled aria-label="Moedas · Em breve">
            +
          </button>
        </div>
      </div>
    </section>
  );
}
