import { expect, test } from '@playwright/test';

const ROUTES = [
  '/',
  '/welcome',
  '/sign-in',
  '/sign-up',
  '/reset-password',
  '/cold-start',
  '/genres',
  '/notifications',
  '/region',
  '/services',
  '/deck',
  '/watchlist',
  '/search',
  '/profile',
  '/settings',
  '/settings-account',
  '/settings-services',
  '/settings-genres',
  '/settings-region',
  '/settings-language',
  '/settings-notifications',
  '/settings-privacy',
  '/settings-help',
  '/settings-promo',
  '/change-password',
  '/edit-profile',
  '/paywall',
  '/trailers',
  '/watchlist-triage',
  '/privacy',
  '/terms',
  '/title/1',
  '/no-such-route',
] as const;

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

type ScreenMetrics = {
  bodyText: string;
  hasSurface: boolean;
  horizontalOverflow: boolean;
  controls: number;
  smallCriticalTargets: string[];
};

function routeSlug(route: string) {
  return route === '/' ? 'root' : route.replaceAll('/', '_').replace(/^_/, '') || 'root';
}

async function settle(page: import('@playwright/test').Page, route: string) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(route === '/' ? 3_000 : 1_000);
}

async function readMetrics(page: import('@playwright/test').Page): Promise<ScreenMetrics> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const controls = [
      ...document.querySelectorAll('button, input, [role="button"], [role="switch"]'),
    ]
      .filter(visible)
      .filter((element) => !(element.tagName === 'INPUT' && element.closest('[role="switch"]')));
    const smallCriticalTargets = controls
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map((element) => {
        const label =
          element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName;
        const rect = element.getBoundingClientRect();
        return `${label.slice(0, 60)} (${Math.round(rect.width)}x${Math.round(rect.height)})`;
      });
    const bodyText = document.body.innerText.trim();

    return {
      bodyText: bodyText.slice(0, 500),
      hasSurface: bodyText.length > 1 || controls.length > 0,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      controls: controls.length,
      smallCriticalTargets,
    };
  });
}

test.describe('Flixy visual and UX audit', () => {
  test.describe.configure({ mode: 'serial' });

  for (const viewport of VIEWPORTS) {
    test(`renders every ${viewport.name} screen without layout regressions`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({ viewport });
      await context.route('**/api.themoviedb.org/**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        }),
      );
      const page = await context.newPage();
      const unexpectedPageErrors: string[] = [];
      const consoleErrors: string[] = [];

      page.on('pageerror', (error) => unexpectedPageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      for (const route of ROUTES) {
        unexpectedPageErrors.length = 0;
        consoleErrors.length = 0;
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await settle(page, route);

        const metrics = await readMetrics(page);
        await page.screenshot({
          path: testInfo.outputPath(`screens/${viewport.name}/${routeSlug(route)}.png`),
          fullPage: true,
        });

        expect(metrics.hasSurface, `${route} rendered a blank screen`).toBeTruthy();
        expect(
          metrics.horizontalOverflow,
          `${route} overflows ${viewport.width}px viewport`,
        ).toBeFalsy();
        expect(
          metrics.smallCriticalTargets,
          `${route} has controls below the 44px touch target: ${metrics.smallCriticalTargets.join(', ')}`,
        ).toEqual([]);

        if (route !== '/title/1' && route !== '/no-such-route') {
          expect(unexpectedPageErrors, `${route} threw a runtime page error`).toEqual([]);
          expect(consoleErrors, `${route} logged a browser error`).toEqual([]);
        }
      }

      await context.close();
    });
  }

  test('survives invalid submissions, repeated actions, and recovery routes', async ({ page }) => {
    await page.route('**/api.themoviedb.org/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      }),
    );
    await page.goto('/welcome');
    await settle(page, '/welcome');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
    await signIn.dblclick();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Please enter your password.')).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.locator('[aria-label^="Show"]').last().click();
    await expect(page.locator('[aria-label^="Hide"]').last()).toBeVisible();
    await page.locator('[aria-label^="Hide"]').last().click();
    await expect(page.locator('[aria-label^="Show"]').last()).toBeVisible();

    await page.getByRole('button', { name: /Sign up free/ }).click();
    await expect(page).toHaveURL(/\/sign-up$/);

    await page.goto('/watchlist');
    await settle(page, '/watchlist');
    const discover = page.getByRole('button', { name: /Go to Discover|Discover/ }).first();
    if (await discover.isVisible()) {
      await discover.click();
      await expect(page).toHaveURL(/\/deck$/);
    }

    await page.goto('/search');
    await settle(page, '/search');
    await page.getByRole('textbox', { name: /Search titles/ }).fill('zzzzzzzzzz-no-film');
    await expect(page.getByText(/No results for/)).toBeVisible({ timeout: 15_000 });

    await page.goto('/no-such-route');
    await settle(page, '/no-such-route');
    await expect(page.getByText('Unmatched Route')).toBeVisible();

    await page.goto('/title/1');
    await settle(page, '/title/1');
    await expect(page.getByText('Something went wrong')).toBeVisible();
  });
});
