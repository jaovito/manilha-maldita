import {
  accountNicknameSchema,
  playerCatalogSchema,
  playerProgressSchema,
  rankingSchema,
  recoveryResponseSchema,
} from '@truco/game-protocol';
import { t } from '../../../shared/i18n';
import { HttpError, request, requestNoContent } from '../../../shared/transport/client';

export const playerApi = {
  async profile() {
    return playerProgressSchema.parse(await request<unknown>('/accounts/progression'));
  },
  async catalog() {
    return playerCatalogSchema.parse(await request<unknown>('/catalog'));
  },
  async ranking(page: number) {
    return rankingSchema.parse(await request<unknown>(`/ranking?page=${page}`));
  },
  async authenticate(mode: 'login' | 'register', body: unknown) {
    return accountNicknameSchema.parse(await request<unknown>(`/accounts/${mode}`, body));
  },
  async select(body: { avatarId: string; deckThemeId: string; tableThemeId: string }) {
    return playerProgressSchema.parse(await request<unknown>('/accounts/cosmetics', body));
  },
  async rename(nickname: string) {
    return playerProgressSchema.parse(await request<unknown>('/accounts/profile', { nickname }));
  },
  async recovery(mode: 'recover' | 'recovery-code', body: unknown) {
    return recoveryResponseSchema.parse(await request<unknown>(`/accounts/${mode}`, body));
  },
  async maintain(mode: 'password' | 'delete', body: unknown) {
    await request<unknown>(`/accounts/${mode}`, body);
  },
  async logout() {
    await requestNoContent('/accounts/logout', {});
  },
};

export function playerError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.code === 'INVALID_CREDENTIALS') return t('Login ou senha inválidos.');
    if (error.code === 'INVALID_PASSWORD') return t('Escolha uma senha mais segura.');
    if (error.code === 'REGISTRATION_FAILED')
      return t('Não foi possível criar a conta com esses dados.');
    if (error.code === 'AUTH_RATE_LIMITED' || error.status === 429)
      return t('Muitas tentativas. Aguarde alguns minutos.');
    if (error.status === 401) return t('Sua sessão terminou. Entre novamente.');
    if (error.code === 'COSMETIC_LOCKED') return t('Este visual ainda está bloqueado.');
    if (error.status === 400) return t('Confira os dados informados.');
    if (error.status === 503) return t('O servidor está ocupado. Tente novamente em instantes.');
  }

  return t('Não foi possível carregar os dados. Tente novamente.');
}
