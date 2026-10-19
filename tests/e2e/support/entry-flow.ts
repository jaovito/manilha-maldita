import { expect, type Page } from '@playwright/test';

/** Confirm a first-visit nickname through the UI; subsequent edits stay in the profile. */
export async function enterNickname(page: Page, nickname: string) {
  await page.getByLabel('Apelido').fill(nickname);
  const continueButton = page.getByRole('button', { name: 'Continuar', exact: true });
  if (await continueButton.isVisible()) {
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(continueButton).toHaveCount(0);
  }
}
