import { expect, test, type Page } from '@playwright/test';
import type { EventOutput } from '../src/generated';

const token = 'A'.repeat(43);
const members = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
];

function event(member: string, index: number, minute: number): EventOutput {
  return {
    id: `${member.slice(0, 24)}${String(index + minute).padStart(12, '0')}`,
    member_id: member,
    type: 'location',
    recorded_at: `2026-11-09T12:${String(minute).padStart(2, '0')}:00Z`,
    received_at: '2026-11-09T13:00:00Z',
    data: { latitude: 43.35 + index * 0.01 + minute * 0.001, longitude: 42.44 + index * 0.01 },
  };
}

async function stubTiles(page: Page) {
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xl7sAAAAASUVORK5CYII=', 'base64');
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: pixel }));
}

test('opens three routes and refreshes points', async ({ page }) => {
  let requestCount = 0;
  const points = members.flatMap((member, index) => [event(member, index, 2), event(member, index, 1)]);
  points[0].data = { ...points[0].data, battery_percent: 0, altitude_m: 0 };

  await stubTiles(page);
  await page.route('**/api/v1/events*', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    requestCount += 1;
    const events = requestCount === 1 ? points : [...points, event(members[0], 0, 3)];
    await route.fulfill({ json: { events, next_cursor: null } });
  });

  await page.goto('/');
  await page.getByLabel('Токен группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.getByText('3 участника · 6 точек')).toBeVisible();
  await expect(page.getByText('11111111', { exact: true })).toBeVisible();
  await expect(page.getByText('22222222', { exact: true })).toBeVisible();
  await expect(page.getByText('33333333', { exact: true })).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(9);
  await page.getByRole('button', { name: /Участник 11111111/ }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.leaflet-popup-content')).toContainText(members[0]);
  await expect(page.locator('.leaflet-popup-content')).toContainText('12:01');
  await expect(page.locator('.leaflet-popup-content')).not.toContainText('Высота');
  await page.getByRole('button', { name: /Участник 11111111/ }).nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.leaflet-popup-content').last()).toContainText('Батарея: 0%');
  await expect(page.locator('.leaflet-popup-content').last()).toContainText('Высота: 0 м');

  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.getByText('3 участника · 7 точек')).toBeVisible();
  await page.getByRole('button', { name: 'Другая группа' }).click();
  await expect(page.getByLabel('Токен группы')).toHaveValue('');
});

test('explains an empty group and an invalid token', async ({ page }) => {
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [], next_cursor: null } }));
  await page.goto('/');
  await page.getByLabel('Токен группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.getByText('Пока нет событий')).toBeVisible();

  await page.getByRole('button', { name: 'Другая группа' }).click();
  await page.unrouteAll({ behavior: 'wait' });
  await page.route('**/api/v1/events*', (route) => route.fulfill({ status: 401, json: { error: { code: 'invalid_token', message: 'invalid' } } }));
  await page.getByLabel('Токен группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.getByRole('alert')).toContainText('Проверьте токен');
});

test('fits the token form on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByLabel('Токен группы')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Открыть карту' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('does not draw a line across a long gap', async ({ page }) => {
  const first = event(members[0], 0, 1);
  const last = { ...event(members[0], 0, 2), recorded_at: '2026-11-09T13:00:00Z' };

  await stubTiles(page);
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [last, first], next_cursor: null } }));
  await page.goto('/');
  await page.getByLabel('Токен группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(2);
});
