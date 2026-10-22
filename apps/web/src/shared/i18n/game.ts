import { guidedEnglish } from './guided';
import { interfaceEnglish } from './interface';
import { tableEnglish } from './table';
import { feedbackEnglish } from './feedback';

/** Portuguese source messages are stable keys; values are interpolated, never translated. */
export const gameEnglish = {
  ...interfaceEnglish,
  ...tableEnglish,
  ...feedbackEnglish,
  ...guidedEnglish,
};
export type MessageKey = keyof typeof gameEnglish;
