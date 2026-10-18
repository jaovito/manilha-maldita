import { assertPlayingCardRatios } from './card-proportions';
import { devices, expect, test, type Page, type Locator } from '@playwright/test';
import { assertLobbyContrast } from './lobby-contrast';
import { assertPowerTargetGeometry } from './power-targets';
import { assertSeatAlignment } from './seat-alignment';
import {
  assertNoOverflow,
  assertTableGeometry,
  checkSmallPhones,
  captureRoomSurface,
} from './viewport';

for (const count of [2, 4] as const) {
  test(`${count === 2 ? '1v1' : '2v2'} real clients play, reconnect and request a rematch`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90000);
    const contexts = await Promise.all(
      Array.from({ length: count }, () =>
        browser.newContext(
          testInfo.project.name === 'mobile-chromium'
            ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }
            : { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
        ),
      ),
    );
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const host = pages[0];
    if (!host) throw new Error('MISSING_HOST');
    try {
      await host.goto('/');
      await assertNoOverflow(host);
      await captureRoomSurface(host, 'menu', testInfo.project.name);
      await host.getByLabel('Apelido').fill('Ana');
      await host.getByRole('button', { name: 'Criar sala' }).click();
      const heading = host.getByRole('heading', { name: /^Sala / });
      await expect(heading).toBeVisible();
      await assertNoOverflow(host);
      const invitation = await host.getByLabel('Link de convite').inputValue();
      const code = new URL(invitation).searchParams.get('room');
      if (!code) throw new Error('MISSING_INVITATION_CODE');
      if (count === 4) {
        await host.getByRole('radio', { name: '2v2', exact: true }).click();
        await expect(host.getByRole('radio', { name: '2v2', exact: true })).toBeChecked();
        await expect(host.getByRole('button', { name: 'Sentar no assento 4' })).toBeVisible();
        await assertSeatAlignment(host);
      }

      await expect(host.getByRole('button', { name: 'Iniciar partida' })).toBeDisabled();
      await expect(
        host.getByText(
          count === 2
            ? /Falta 1 jogador para completar a sala 1v1/
            : /Faltam 3 jogadores para completar a sala 2v2/,
        ),
      ).toBeVisible();
      await expect(host.getByText(/Você ainda precisa clicar em “Estou pronto”/)).toBeVisible();

      let hostReloads = 0;
      const trackNavigation = () => {
        hostReloads++;
      };
      host.on('load', trackNavigation);

      for (let index = 1; index < count; index++) {
        const page = pages[index];
        if (!page) throw new Error('MISSING_PLAYER');
        await page.goto(index === 1 ? '/' : `/?room=${code}`);
        await page.getByLabel('Apelido').fill(`Amigo ${index}`);
        if (index === 1) {
          await page.getByRole('button', { name: 'Entrar em sala', exact: true }).click();
          await page.getByLabel('Código da sala').fill(code);
        }
        await page.getByRole('button', { name: 'Entrar na sala' }).click();
        await expect(page.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
        if (index === 1) {
          await assertLobbyContrast(page);
          await expect(page.getByRole('radio', { name: '2v2', exact: true })).toBeDisabled();
          await expect(page.getByText('Somente leitura', { exact: true })).toBeVisible();
          await expect(host.getByText('Somente leitura', { exact: true })).toHaveCount(0);
          const hostColor = await host
            .locator('.pixel-options input:checked + span')
            .first()
            .evaluate(
              (element) =>
                element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor,
            );
          if (!hostColor) throw new Error('MISSING_HOST_SELECTION_COLOR');
          await expect(page.locator('.pixel-options input:checked + span').first()).not.toHaveCSS(
            'background-color',
            hostColor,
          );
          await expect(page.getByRole('button', { name: 'Copiar link da sala' })).toBeEnabled();
          await page.screenshot({
            path: `/tmp/truco-guest-settings-${testInfo.project.name}-${count}.png`,
            fullPage: true,
          });
        }
        await expect(
          host.getByText(`Amigo ${index} · conectado · aguardando`, { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Sentar no assento 1', exact: true }),
        ).toHaveCount(0);
      }

      await host.bringToFront();
      if (count === 4) await assertSeatAlignment(host);
      expect(hostReloads).toBe(0);
      host.off('load', trackNavigation);

      for (const page of pages)
        await clickAndSync(pages, page, page.getByRole('button', { name: 'Estou pronto' }));

      await expect(host.getByText('Todos estão conectados e prontos.')).toBeVisible();
      await expect(host.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled();
      await captureRoomSurface(host, 'lobby', testInfo.project.name);
      await host.getByRole('button', { name: 'Iniciar partida' }).click();
      for (const page of pages)
        await expect(page.getByRole('region', { name: 'Mesa da partida' })).toBeVisible();
      await host.screenshot({
        path: `/tmp/truco-m3-preparation-${count}-${testInfo.project.name}.png`,
        fullPage: true,
      });
      await preparePowers(pages);
      await host.screenshot({
        path: `/tmp/truco-viewport-initial-${count}-${testInfo.project.name}.png`,
        fullPage: true,
      });
      await assertTableGeometry(host, count);
      if (count === 4)
        await host.screenshot({
          path: `/tmp/truco-m2-table-${testInfo.project.name === 'mobile-chromium' ? 'mobile' : 'desktop'}.png`,
          fullPage: true,
        });
      if (count === 2)
        await host.screenshot({
          path: `/tmp/truco-visual-1v1-${testInfo.project.name === 'mobile-chromium' ? 'mobile' : 'desktop'}.png`,
          fullPage: true,
        });
      if (testInfo.project.name === 'mobile-chromium')
        await checkSmallPhones(host, count, 'initial');
      for (let card = 0; card < count; card++) {
        const player = await findActivePlayer(pages);
        await playWithPower(pages, player);
      }
      await expect(host.locator('.played-card')).toHaveCount(count);
      await assertTableGeometry(host, count);
      await host.screenshot({
        path: `/tmp/truco-visual-played-${count}-${testInfo.project.name === 'mobile-chromium' ? 'mobile' : 'desktop'}.png`,
        fullPage: true,
      });
      if (testInfo.project.name === 'mobile-chromium') {
        await checkSmallPhones(host, count, 'played');
        await host.setViewportSize({ width: 844, height: 390 });
        await host.screenshot({
          path: `/tmp/truco-viewport-landscape-${count}.png`,
          fullPage: true,
        });
        await assertTableGeometry(host, count);
        await host.setViewportSize({ width: 390, height: 844 });
        await assertTableGeometry(host, count);
      }
      if (testInfo.project.name === 'chromium') {
        for (const viewport of [
          { width: 1920, height: 1080 },
          { width: 1024, height: 768 },
        ]) {
          await host.setViewportSize(viewport);
          await assertTableGeometry(host, count);
          await host.screenshot({
            path: `/tmp/truco-viewport-${viewport.width}-${count}.png`,
            fullPage: true,
          });
        }
        await host.setViewportSize({ width: 1280, height: 720 });
      }
      await host.reload();
      await expect(host.getByRole('region', { name: 'Mesa da partida' })).toBeVisible();
      await finish(pages);
      for (const page of pages) await expect(page.getByText(/Partida encerrada/)).toBeVisible();
      await host.screenshot({
        path: `/tmp/truco-viewport-finished-${count}-${testInfo.project.name}.png`,
        fullPage: true,
      });
      await host.getByRole('button', { name: 'Revanche' }).click();
      for (const page of pages) {
        await expect(page.getByRole('button', { name: 'Estou pronto' })).toBeVisible();
        await clickAndSync(pages, page, page.getByRole('button', { name: 'Estou pronto' }));
      }
      await expect(host.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled();
      await host.getByRole('button', { name: 'Iniciar partida' }).click();
      await expect(host.getByRole('button', { name: 'Desistir da partida' })).toBeVisible();
      await expect(host.getByRole('button', { name: 'Sair da sala' })).toHaveCount(0);
      await host.getByRole('button', { name: 'Desistir da partida' }).click();
      await expect(host.getByText(/Partida encerrada.*desistência/)).toBeVisible();
      await host.getByRole('button', { name: 'Sair da sala' }).click();
      await expect(host.getByLabel('Apelido')).toBeVisible();
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}

async function finish(pages: Page[]) {
  for (let step = 0; step < 100; step++) {
    if (await pages[0]?.getByText(/Partida encerrada/).isVisible()) return;
    await preparePowers(pages);
    let acted = false;
    for (const page of pages) {
      const raise = page.getByRole('button', { name: 'Contra-aumentar' });
      const accept = page.getByRole('button', { name: 'Aceitar', exact: true });
      const request = page.getByRole('button', { name: 'Pedir Truco / aumentar' });
      const eleven = page.getByRole('button', { name: 'Jogar por 3' });
      if ((await raise.isVisible()) && (await raise.isEnabled())) {
        await clickAndSync(pages, page, raise);
        acted = true;
        break;
      }
      if ((await accept.isVisible()) && (await accept.isEnabled())) {
        await clickAndSync(pages, page, accept);
        acted = true;
        break;
      }
      if ((await eleven.isVisible()) && (await eleven.isEnabled())) {
        await clickAndSync(pages, page, eleven);
        acted = true;
        break;
      }
      if ((await request.isVisible()) && (await request.isEnabled())) {
        await clickAndSync(pages, page, request);
        acted = true;
        break;
      }
      const card = page.locator('.card:enabled').first();
      if (await card.isVisible()) {
        await playWithPower(pages, page);
        acted = true;
        break;
      }
    }
    if (!acted)
      await expect
        .poll(async () =>
          Promise.all(pages.map((page) => page.locator('.card:enabled').count())).then((counts) =>
            counts.reduce((sum, count) => sum + count, 0),
          ),
        )
        .toBeGreaterThan(0);
  }
  throw new Error('Partida não encerrou em 100 ações.');
}

async function clickAndSync(pages: Page[], page: Page, target: Locator) {
  const previous = Number(await page.locator('[data-sequence]').getAttribute('data-sequence'));
  await target.click();
  await Promise.all(
    pages.map((client) =>
      expect
        .poll(async () =>
          Number(await client.locator('[data-sequence]').getAttribute('data-sequence')),
        )
        .toBeGreaterThan(previous),
    ),
  );
}

async function findActivePlayer(pages: Page[]): Promise<Page> {
  for (const page of pages) if ((await page.locator('.card:enabled').count()) > 0) return page;
  throw new Error('Nenhum jogador com turno ativo.');
}

async function preparePowers(pages: Page[]) {
  const preparing = await Promise.all(
    pages.map((page) => page.getByRole('button', { name: 'Passar preparação' }).isVisible()),
  );
  if (!preparing.some(Boolean)) return;

  const spies = new Set<Page>();
  const consumed = new Set<Page>();
  for (const page of pages) {
    const pass = page.getByRole('button', { name: 'Passar preparação' });
    if (!(await pass.isVisible())) continue;
    const power = page.locator('.power-card[data-can-activate="true"]');
    if (!(await power.count())) {
      await clickAndSync(pages, page, pass);
      continue;
    }
    consumed.add(page);
    await power.click();
    await expect(page.locator('.power-panel')).toHaveCount(0);
    await assertPowerTargetGeometry(page);
    const spy = page.getByRole('button', { name: /^Espionar carta/ });
    if (await spy.count()) {
      spies.add(page);
      await clickAndSync(pages, page, spy.first());
    } else await clickAndSync(pages, page, page.locator('.hand-cards .card:enabled').first());
  }
  for (const page of pages) {
    await expect(page.locator('.spy-observation')).toHaveCount(spies.has(page) ? 1 : 0);
    await assertPlayingCardRatios(page);
    if (consumed.has(page)) await expect(page.locator('.power-card')).toHaveCount(0);
  }
}

async function playWithPower(pages: Page[], page: Page) {
  const power = page.locator('.power-card[data-can-activate="true"]');
  if (await power.count()) {
    await power.click();
    await expect(power).toHaveAttribute('aria-pressed', 'true');
    await assertPowerTargetGeometry(page);
    // A boost can be unavailable for every remaining card; passing preserves legality.
    if ((await page.locator('.card:enabled').count()) === 0) await power.click();
  }
  const activated = await page.locator('.power-card[aria-pressed="true"]').count();
  await clickAndSync(pages, page, page.locator('.card:enabled').first());
  if (activated) await expect(page.locator('.power-card')).toHaveCount(0);
}
