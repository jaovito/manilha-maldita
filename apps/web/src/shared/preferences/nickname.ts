import { nicknameSchema } from '@truco/game-protocol';

export const NICKNAME_KEY = 'truco.nickname';

export function loadNickname(): string {
  try {
    const parsed = nicknameSchema.safeParse(localStorage.getItem(NICKNAME_KEY));
    return parsed.success ? parsed.data : '';
  } catch {
    return '';
  }
}

export function saveNickname(value: string): void {
  try {
    const parsed = nicknameSchema.safeParse(value);
    if (parsed.success) localStorage.setItem(NICKNAME_KEY, parsed.data);
    else localStorage.removeItem(NICKNAME_KEY);
  } catch {
    // Storage can be blocked or full; the nickname still works for this visit.
  }
}
