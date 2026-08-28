import { test, expect, type Page } from '@playwright/test';
import { CASES, casePath } from '../cases.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A snapshot of everything that can visibly change inside `sel`: the animated
 * ATTRIBUTES (the frame loop writes those) and the COMPUTED styles (WAAPI and
 * CSS @keyframes drive those without touching attributes). Comparing two
 * snapshots a few hundred ms apart tells us whether anything is moving.
 */
const SNAPSHOT = (sel: string): string =>
  Array.from(document.querySelectorAll(sel + ' *')).map(el => {
    const cs = getComputedStyle(el);
    return [
      el.getAttribute('transform'), el.getAttribute('opacity'), el.getAttribute('fill'),
      el.getAttribute('stroke-dashoffset'), el.getAttribute('cx'), el.getAttribute('cy'),
      cs.transform, cs.opacity, cs.fill, cs.strokeDashoffset,
    ].join('|');
  }).join('\n');

async function snapshot(page: Page, sel: string): Promise<string> {
  return page.evaluate(SNAPSHOT, sel);
}

async function expectAnimating(page: Page, sel = 'svg', ms = 350): Promise<void> {
  const a = await snapshot(page, sel);
  await page.waitForTimeout(ms);
  const b = await snapshot(page, sel);
  expect(b, `expected ${sel} to be animating`).not.toBe(a);
}

async function expectFrozen(page: Page, sel = 'svg', ms = 350): Promise<void> {
  // A pause() issued a moment ago commits on the browser's next animation frame
  // (WAAPI's "pending pause"), and under a parallel test run that frame can be
  // late. So the first interval is a settling period; only the second is asserted.
  await page.waitForTimeout(ms);
  const a = await snapshot(page, sel);
  await page.waitForTimeout(ms);
  const b = await snapshot(page, sel);
  expect(b, `expected ${sel} to be frozen`).toBe(a);
}

/** Sets a range input the way a user would, so React/Vue change handlers fire. */
async function slide(page: Page, sel: string, value: number): Promise<void> {
  await page.evaluate(([s, v]) => {
    const input = document.querySelector(s) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [sel, value] as const);
}

/** Collects console errors and page errors from the moment of navigation. */
function watchErrors(page: Page): Array<string> {
  const errors: Array<string> = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  return errors;
}

// ---------------------------------------------------------------------------
// What each case must demonstrate, beyond loading cleanly.
// A case without an entry here just has to show something animating.
// ---------------------------------------------------------------------------

const CHECKS: Record<string, (page: Page) => Promise<void>> = {
  'web/programmatic': async page => {
    await expectAnimating(page);
    await page.click('#pause');
    await expectFrozen(page);
    await slide(page, '#seek', 700);
    const t = await page.evaluate(() => (window as any).animator.getCurrentTime());
    expect(t).toBeCloseTo(700, -1);
    await page.click('#play');
    await expectAnimating(page);
  },

  'web/callbacks': async page => {
    const log = page.locator('#log');
    await page.click('#play');
    await expect(log).toContainText('onPlay');
    await page.click('#pause');
    await expect(log).toContainText('onPause');
    await page.click('#finish');
    await expect(log).toContainText('onFinish');
    await page.click('#destroy');
    await expect(log).toContainText('onRemove');
    await expect(page.locator('#box svg')).toHaveCount(0);
  },

  'web/triggers': async page => {
    await expectFrozen(page);                       // startOn: 'click' — nothing until clicked
    await page.click('#box svg');
    await expectAnimating(page);
    await page.click('#box svg');                   // outAction: 'pause'
    await expectFrozen(page);
  },

  'web/engine-modes': async page => {
    await expectAnimating(page, '#waapi svg');
    await expectAnimating(page, '#frames svg');
  },

  'web/several': async page => {
    await expect(page.locator('svg')).toHaveCount(3);
    await expectAnimating(page, 'body');
  },

  'web/cleanup': async page => {
    await expect(page.locator('#box svg')).toHaveCount(1);
    await page.click('#destroy');
    await expect(page.locator('#box svg')).toHaveCount(0);
  },

  'react/imperative': async page => {
    await expectFrozen(page);                       // apiRef alone = programmatic
    await page.click('text=play()');
    await expectAnimating(page);
    await page.click('text=pause()');
    await expectFrozen(page);
  },
  'vue/imperative': async page => CHECKS['react/imperative'](page),

  'react/controlled-time': async page => {
    await expectFrozen(page);
    const at0 = await snapshot(page, 'svg');
    await slide(page, '#seek', 800);
    await expect(page.locator('#ms')).toHaveText('800');
    await expectFrozen(page);                       // controlled: still nothing plays
    expect(await snapshot(page, 'svg')).not.toBe(at0);
  },
  'vue/controlled-time': async page => CHECKS['react/controlled-time'](page),

  'react/declarative': async page => {
    await expectFrozen(page);
    await page.click('#play');
    await expectAnimating(page);
    await page.click('#pause');
    await expectFrozen(page);
  },
  'vue/declarative': async page => CHECKS['react/declarative'](page),

  'react/css-svgr': async page => {
    await expectFrozen(page);                       // startOn: 'click'
    await page.click('svg');
    await expectAnimating(page);
  },
  'vue/css-loader': async page => CHECKS['react/css-svgr'](page),

  'playback/override-web': async page => {
    await expectFrozen(page);                       // trigger overridden to programmatic
    await page.click('#play');
    await expectAnimating(page);
  },

  'prerendered/img-css': async page => {
    // Nothing inside an <img> is reachable from the DOM, so the only honest check
    // is pixels: screenshot the image twice and confirm nothing moved.
    const img = page.locator('#raw');
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    const a = await img.screenshot();
    await page.waitForTimeout(400);
    expect(a.equals(await img.screenshot()), 'as an <img> the file is a still frame').toBe(true);
  },
};

// ---------------------------------------------------------------------------
// One test per case, straight from the manifest.
// ---------------------------------------------------------------------------

for (const c of CASES) {
  const key = `${c.group}/${c.id}`;
  test(key, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/' + casePath(c));

    if (c.id !== 'img-css') {
      await expect(page.locator('svg').first()).toBeVisible();
    }
    await (CHECKS[key] ?? (p => expectAnimating(p)))(page);

    expect(errors, 'no console or page errors').toEqual([]);
  });
}

// ---------------------------------------------------------------------------
// The case browser itself.
// ---------------------------------------------------------------------------

test('browser: lists every case and routes by hash', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('#nav a')).toHaveCount(CASES.length);

  const last = CASES[CASES.length - 1];
  await page.goto(`/#${last.group}/${last.id}`);
  await expect(page.locator('#frame')).toHaveAttribute('src', new RegExp(casePath(last).replace(/\//g, '\\/')));
  await expect(page.locator('#nav a.active')).toHaveText(new RegExp(last.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  expect(errors).toEqual([]);
});
