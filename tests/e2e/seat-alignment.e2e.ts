import { expect, test } from '@playwright/test';
import { enterNickname } from './entry-flow';
import { assertSeatAlignment } from './seat-alignment';

test('seat actions stay aligned with long nicknames, badges and readiness changes', async ({
  page,
}, info) => {
  await page.goto('/');
  await enterNickname(page, 'NomeMuitoLongoDoAnfitriao');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Sala / })).toBeVisible();
  await page.getByRole('radio', { name: '2v2', exact: true }).click();
  await expect(page.getByRole('radio', { name: '2v2', exact: true })).toBeChecked();

  const viewports =
    info.project.name === 'chromium'
      ? [
          { width: 1567, height: 882 },
          { width: 1024, height: 768 },
        ]
      : [
          { width: 390, height: 844 },
          { width: 320, height: 568 },
          { width: 844, height: 390 },
        ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await assertSeatAlignment(page);
    await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cancelar pronto' })).toBeVisible();
    await assertSeatAlignment(page);
    await page.screenshot({
      path: `/tmp/truco-seat-alignment-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Cancelar pronto' }).click();
    await expect(page.getByRole('button', { name: 'Estou pronto', exact: true })).toBeVisible();
  }
});
