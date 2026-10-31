import { expect, test } from '@playwright/test';

test('frontend documents send framing headers on root and navigation paths', async ({
  request,
}) => {
  for (const path of ['/', '/index.html', '/?room=ABC123', '/login']) {
    const response = await request.get(path);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(response.headers()['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(response.headers()['x-frame-options']).toBe('DENY');
  }
});

for (const parent of ['same-origin', 'cross-origin'] as const) {
  test(`browser blocks a ${parent} iframe while top-level access works`, async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('MISSING_BASE_URL');

    const address = new URL(baseURL);
    if (parent === 'cross-origin') address.hostname = 'localhost';

    await page.goto(address.href);
    await expect(page).toHaveTitle('Manilha Maldita');
    await expect(page.locator('#root')).not.toBeEmpty();

    const target = new URL('/?frame-protection-test', baseURL).href;
    const blocked = page.waitForEvent('console', {
      predicate: (message) =>
        message.type() === 'error' && /frame-ancestors|X-Frame-Options/i.test(message.text()),
    });

    await page.evaluate(`(() => {
      const frame = document.createElement('iframe');
      frame.title = 'Framing regression';
      frame.src = ${JSON.stringify(target)};
      document.body.append(frame);
    })()`);

    expect((await blocked).text()).toMatch(/frame-ancestors|X-Frame-Options/i);
    await expect(page.frameLocator('iframe').locator('#root')).toHaveCount(0);
    await expect(page.locator('#root')).not.toBeEmpty();
  });
}
