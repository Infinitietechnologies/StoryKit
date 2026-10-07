import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

process.env.PAGES_BASE_PATH ||= '/StoryKit/';
const server = await preview({
  root: fileURLToPath(new URL('../', import.meta.url)),
  preview: { host: '127.0.0.1', port: 4189, strictPort: true },
});
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:4189${process.env.PAGES_BASE_PATH}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { name: 'Stories & Status' }).waitFor();
  await page.getByRole('button', { name: /stories viewed from Aria Chen/ }).click();
  await page.getByRole('dialog', { name: "Aria Chen's stories" }).waitFor();
  await page.getByRole('button', { name: 'Share story', exact: true }).click();
  const sharing = page.getByRole('dialog', { name: 'Share story', exact: true });
  await sharing.waitFor();
  const sharedLink = await sharing.getByRole('textbox', { name: 'Story link' }).inputValue();
  assert.equal(new URL(sharedLink).searchParams.get('story'), 's1-1');
  await sharing.getByRole('button', { name: 'Close sharing' }).click();
  await page.getByRole('button', { name: 'Close (Esc)', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const questionLink = new URL(sharedLink);
  questionLink.searchParams.set('story', 's1-3');
  await page.goto(questionLink.href, { waitUntil: 'domcontentloaded' });
  await page.getByRole('dialog', { name: "Aria Chen's stories" }).waitFor();
  await page.getByText('What should I explore next? 🗺️').waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Reply to story' }).count(), 0);
  assert.deepEqual(errors, [], 'The production demo must render without runtime errors');
  console.log('Production demo renders, shares story-specific links, honors story controls, and opens deep links without runtime errors.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
