import { expect, test, type Page } from '@playwright/test';

let pageErrors: string[];
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
});
test.afterEach(() => { expect(pageErrors).toEqual([]); });

async function openScenario(page: Page, scenario = 'images', controlledClock = false) {
  await page.goto('/qa.html?scenario=' + scenario);
  // Exercise keyboard opening and restoration consistently. WebKit pointer
  // clicks can blur native buttons even when they were explicitly focused.
  const trigger = page.getByRole('button', { name: 'Open stories' });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  if (controlledClock) await page.clock.runFor(100);
  const dialog = page.getByRole('dialog', { name: 'QA stories' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(':scope > div > div')).toHaveCSS('opacity', '1');
  return dialog;
}

test('local images render with bounded layout and usable controls', async ({ page }, testInfo) => {
  const dialog = await openScenario(page);
  const image = dialog.getByAltText('Aurora story');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(720);
  await expect(page.getByTestId('event-log')).toContainText('viewed:first');
  await expect(dialog.getByRole('button', { name: 'Pause story' })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(dialog.getByRole('button', { name: 'Previous story' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Next story' })).toHaveCount(0);
  const viewport = page.viewportSize()!;
  const layout = await dialog.evaluate((element) => {
    const bounds = element.firstElementChild!.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
  expect(layout.x).toBeGreaterThanOrEqual(0);
  expect(layout.y).toBeGreaterThanOrEqual(0);
  expect(layout.x + layout.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(layout.y + layout.height).toBeLessThanOrEqual(viewport.height + 1);
  const buttons = await dialog.getByRole('button').all();
  for (const button of buttons) {
    if (!(await button.isVisible())) continue;
    const bounds = (await button.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: 'test-results/qa-' + testInfo.project.name + '.png', animations: 'disabled' });
});

test('keyboard focus stays in the modal and close restores its trigger', async ({ page }) => {
  const dialog = await openScenario(page);
  await dialog.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Like story' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Pause story' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Like story' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open stories' })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('a failed first image stays actionable and retries at the same index', async ({ page }, testInfo) => {
  await page.clock.install();
  let requests = 0;
  await page.route('**/qa-first.svg?failure=1', (route) => {
    requests += 1;
    return requests === 1 ? route.abort('failed') : route.continue();
  });
  const dialog = await openScenario(page, 'failure', true);
  await expect(dialog.getByRole('alert')).toHaveText(/Story unavailable/);
  await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible();
  const dialogFont = await dialog.evaluate((element) => getComputedStyle(element).fontFamily);
  await expect(dialog.getByRole('button', { name: 'Try again' })).toHaveCSS('font-family', dialogFont);
  await page.screenshot({ path: 'test-results/qa-error-' + testInfo.project.name + '.png', animations: 'disabled' });
  await page.clock.runFor(4000);
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('event-log')).not.toContainText('ended:first');
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await expect(dialog.getByAltText('Aurora story')).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('event-log')).toContainText('viewed:first');
  expect(requests).toBeGreaterThanOrEqual(2);
});

test('failed stories skip only when the viewer selects skip', async ({ page, isMobile }) => {
  await page.route('**/qa-first.svg?failure=1', (route) => route.abort('failed'));
  const dialog = await openScenario(page, 'failure');
  await expect(dialog.getByRole('alert')).toBeVisible();
  const skip = dialog.getByRole('button', { name: 'Skip story' });
  if (isMobile) await skip.tap();
  else await skip.click();
  await expect(dialog.getByAltText('Ocean story')).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('event-log')).toContainText('ended:first');
});

test('slow media exposes recovery without hiding the modal controls', async ({ page }) => {
  await page.clock.install();
  await page.route('**/qa-first.svg', () => {});
  const dialog = await openScenario(page, 'images', true);
  await expect(dialog.getByText('Loading story…')).toBeVisible();
  await page.clock.runFor(8100);
  await expect(dialog.getByText('Taking longer than usual…')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Skip story' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close (Esc)' })).toBeVisible();
});

test('holding and releasing media preserves a manual pause', async ({ page }) => {
  const dialog = await openScenario(page);
  await expect(dialog.getByAltText('Aurora story')).toBeVisible();
  await dialog.getByRole('button', { name: 'Pause story' }).click();
  const bounds = (await dialog.getByAltText('Aurora story').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.25);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await page.mouse.up();
  await expect(dialog.getByRole('button', { name: 'Resume story' })).toBeVisible();
  await expect(page.getByTestId('event-log')).not.toContainText('story:second');
  await dialog.getByRole('button', { name: 'Resume story' }).click();
  await expect(dialog.getByRole('button', { name: 'Pause story' })).toBeVisible();
});

test('poll voting persists and a restored selection neither pauses nor navigates', async ({ page, isMobile }, testInfo) => {
  let dialog = await openScenario(page, 'poll');
  const vote = dialog.getByRole('button', { name: 'Vote for: Mountains' });
  if (isMobile) await vote.tap();
  else await vote.click();
  await expect(vote).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByText('You chose: Mountains')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Pause story' })).toBeVisible();
  await expect(page.getByTestId('event-log')).not.toContainText('story:second');
  await page.screenshot({ path: 'test-results/qa-poll-' + testInfo.project.name + '.png', animations: 'disabled' });
  await page.reload();
  await page.getByRole('button', { name: 'Open stories' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Vote for: Mountains' })).toHaveAttribute('aria-pressed', 'true');
  const group = dialog.getByRole('group', { name: 'Which view should we explore?' });
  if (isMobile) await group.tap({ position: { x: 20, y: 15 } });
  else await group.click({ position: { x: 20, y: 15 } });
  await expect(dialog.getByRole('button', { name: 'Pause story' })).toBeVisible();
  await expect(page.getByTestId('event-log')).not.toContainText('story:second');
});

test('question and reply focus pause playback and provide honest submission feedback', async ({ page }, testInfo) => {
  const dialog = await openScenario(page, 'question');
  const answer = dialog.getByRole('textbox', { name: 'Your answer' });
  await answer.fill('fail');
  await expect(dialog.getByRole('button', { name: 'Resume story' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('event-log')).not.toContainText('story:second');
  await dialog.getByRole('button', { name: 'Send answer' }).click();
  await expect(dialog.getByText('Response could not be submitted. Try again.')).toBeVisible();
  await expect(answer).toHaveValue('fail');
  await page.screenshot({ path: 'test-results/qa-question-' + testInfo.project.name + '.png', animations: 'disabled' });
  await answer.fill('Iceland');
  await dialog.getByRole('button', { name: 'Send answer' }).click();
  await expect(dialog.getByText('Response submitted!')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Pause story' })).toBeVisible();
  const reply = dialog.getByRole('textbox', { name: 'Reply to story' });
  await reply.fill('fail');
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Reply could not be submitted. Try again.')).toBeVisible();
  await expect(reply).toHaveValue('fail');
  await reply.fill('Beautiful view');
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Reply submitted')).toBeVisible();
  await expect(reply).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Pause story' })).toBeVisible();
  await expect(page.getByTestId('event-log')).toContainText('answer:Iceland');
  await expect(page.getByTestId('event-log')).toContainText('reply:first:Beautiful view');
});

test('real local video plays, pauses, resumes, and switches mute state', async ({ page }) => {
  const supported = await page.evaluate(() => document.createElement('video').canPlayType('video/webm; codecs="vp8"'));
  test.skip(!supported, 'This browser build does not support the local VP8 video fixture.');
  const dialog = await openScenario(page, 'video');
  const video = dialog.locator('video');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.1);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  await dialog.getByRole('button', { name: 'Pause story' }).click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  const pausedAt = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await page.waitForTimeout(200);
  expect(await video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeCloseTo(pausedAt, 1);
  await dialog.getByRole('button', { name: 'Unmute (M)' }).click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(false);
  await dialog.getByRole('button', { name: 'Resume story' }).click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(pausedAt);
});

test('reduced motion removes viewer and media animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const dialog = await openScenario(page);
  await expect.poll(() => dialog.evaluate((element) =>
    parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
  await expect.poll(() => dialog.locator(':scope > div > div').evaluate((element) =>
    parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
  await dialog.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByAltText('Ocean story')).toBeVisible();
  const animations = await dialog.locator('[data-storykit-animated]').evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).animationName));
  expect(animations.every((name) => name === 'none')).toBe(true);
});

for (const direction of ['ltr', 'rtl'] as const) {
  test(direction + ' side taps navigate in both directions without arrow controls', async ({ page, isMobile }) => {
    const dialog = await openScenario(page, 'images&dir=' + direction);
    await expect(dialog.getByRole('button', { name: 'Previous story' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Next story' })).toHaveCount(0);
    const tapMedia = async (alt: string, fraction: number) => {
      const media = dialog.getByAltText(alt);
      await expect(media).toBeVisible();
      const bounds = (await media.boundingBox())!;
      const x = bounds.x + bounds.width * fraction;
      const y = bounds.y + bounds.height * 0.55;
      if (isMobile) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    };
    await tapMedia('Aurora story', direction === 'ltr' ? 0.85 : 0.15);
    await expect(dialog.getByAltText('Ocean story')).toBeVisible();
    await expect(page.getByTestId('event-log')).toContainText('story:second');
    await tapMedia('Ocean story', direction === 'ltr' ? 0.15 : 0.85);
    await expect(dialog.getByAltText('Aurora story')).toBeVisible();
    await expect(page.getByTestId('event-log')).toHaveText(/story:first[\s\S]*story:second[\s\S]*story:first/);
  });
}
