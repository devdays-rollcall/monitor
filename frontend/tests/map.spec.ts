import { expect, test, type Page } from '@playwright/test';
import type { EventOutput } from '../src/generated';
import { routeData } from '../src/routeData';

const token = 'A'.repeat(43);
const members = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
];

test.beforeEach(async ({ context }) => {
  await context.route('https://mc.yandex.ru/**', (route) => route.abort());
  await context.route('**/api/v1/alert', (route) => route.fulfill({ json: { active: false, alert_id: null, subscription_url: 'https://notify.example/topic', observers: 0, approvals: 0, required_approvals: 2, registered: false, approved: false } }));
});

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
  await page.route('https://styles.maptoolkit.org/hiking.json', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e6ece7' } }] } }));
}

test('opens three routes and refreshes points', async ({ page }) => {
  let requestCount = 0;
  const points = members.flatMap((member, index) => [event(member, index, 2), event(member, index, 1)]);
  points[0].data = { ...points[0].data, latitude: 43.352123456, battery_percent: 0, altitude_m: 0, accuracy_m: 4, speed_mps: 1, bearing_deg: 90, custom: { source: 'gps' } };
  points[1].data = { ...points[1].data, bearing_deg: 0, battery_percent: 100 };

  await stubTiles(page);
  await page.route('**/api/v1/events*', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    requestCount += 1;
    const events = requestCount === 1 ? points : [...points, event(members[0], 0, 3)];
    await route.fulfill({ json: { events, next_cursor: null } });
  });

  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.getByText('3 участника · 6 точек')).toBeVisible();
  await expect(page.getByText('11111111', { exact: true })).toBeVisible();
  await expect(page.getByText('22222222', { exact: true })).toBeVisible();
  await expect(page.getByText('33333333', { exact: true })).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeAttached();
  const marker = page.getByRole('button', { name: /Участник 11111111.*открыть точку/ });
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.maplibregl-popup-content')).toContainText(members[0]);
  await expect(page.locator('.maplibregl-popup-content')).toContainText('12:02:00Z');
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText('Батарея0%');
  const emptyBatteryColor = await page.locator('.point-battery').evaluate((element) => getComputedStyle(element).color);
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText('Высота0 м');
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText('Точность4 м');
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText('Скорость1 м/с');
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText('Направление90°');
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText('Получено2026-11-09T13:00:00Z');
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText(points[0].id);
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText('ТипКоординаты');
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText('Широта43.352123456');
  await expect(page.locator('.maplibregl-popup-content').last()).toContainText('"source":"gps"');
  const memberId = page.locator('.point-detail-long dd[aria-label="Участник"]');
  expect(await memberId.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await memberId.focus();
  const mapUrl = page.url();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => memberId.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(page.url()).toBe(mapUrl);
  await marker.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.maplibregl-popup-content')).toContainText('Направление0°');
  await expect(page.locator('.point-battery')).toHaveText('100%');
  expect(await page.locator('.point-battery').evaluate((element) => getComputedStyle(element).color)).not.toBe(emptyBatteryColor);

  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.getByText('3 участника · 7 точек')).toBeVisible();
  await page.getByRole('button', { name: 'На страницу ввода ключа' }).click();
  await expect(page.getByLabel('Ключ группы')).toHaveValue('');
});

test('explains an empty group and an invalid token', async ({ page }) => {
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [], next_cursor: null } }));
  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.getByText('Пока нет событий')).toBeVisible();

  await page.getByRole('button', { name: 'На страницу ввода ключа' }).click();
  await page.unrouteAll({ behavior: 'wait' });
  await page.route('**/api/v1/events*', (route) => route.fulfill({ status: 401, json: { error: { code: 'invalid_token', message: 'invalid' } } }));
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.getByRole('alert')).toContainText('Проверьте ключ');
});

test('fits the token form on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByLabel('Ключ группы')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Открыть карту' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('returns to key entry from the header', async ({ page }) => {
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [], next_cursor: null } }));
  await page.goto(`/?view=view_${'B'.repeat(43)}`);
  await expect(page.getByText('Пока нет событий')).toBeVisible();
  await page.getByRole('button', { name: 'На страницу ввода ключа' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Ключ группы')).toHaveValue('');
  expect(new URL(page.url()).hash).toBe('');
  expect(new URL(page.url()).searchParams.has('view')).toBe(false);
});

test('opens an existing link with a fragment and moves its key to query', async ({ page }) => {
  const readOnly = `view_${'B'.repeat(43)}`;
  await page.route('**/api/v1/events*', (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${readOnly}`);
    return route.fulfill({ json: { events: [], next_cursor: null } });
  });
  await page.goto(`/?source=test#view=${readOnly}`);
  await expect(page.getByText('Пока нет событий')).toBeVisible();
  const url = new URL(page.url());
  expect(url.searchParams.get('view')).toBe(readOnly);
  expect(url.searchParams.get('source')).toBe('test');
  expect(url.hash).toBe('');
});

test('does not accept a group key in the view parameter', async ({ page }) => {
  await page.goto(`/?view=${token}`);
  await expect(page.getByRole('alert')).toContainText('Проверьте ссылку для просмотра');
  await expect(page.getByLabel('Ключ группы')).toBeVisible();
});

test('does not draw a line across a long gap', () => {
  const first = event(members[0], 0, 1);
  const last = { ...event(members[0], 0, 2), recorded_at: '2026-11-09T13:00:00Z' };
  const features = routeData([{ id: members[0], color: '#123456', events: [first, last] }], null).features;
  expect(features.filter((feature) => feature.geometry.type === 'LineString')).toHaveLength(0);
});

test('keeps the direction for map markers, including zero degrees', () => {
  const north = event(members[0], 0, 1);
  const east = event(members[0], 0, 2);
  const unknown = event(members[0], 0, 3);
  north.data.bearing_deg = 0;
  east.data.bearing_deg = 90;
  const points = routeData([{ id: members[0], color: '#123456', events: [north, east, unknown] }], null).features.filter((feature) => feature.geometry.type === 'Point');
  expect(points.map((point) => [point.properties?.hasBearing, point.properties?.bearing])).toEqual([[true, 0], [true, 90], [false, 0]]);
});

test('opens a point by clicking the map', async ({ page }) => {
  const point = event(members[0], 0, 1);
  await stubTiles(page);
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [point], next_cursor: null } }));
  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate((element) => element.getAttribute('aria-label'))).toBeTruthy();
  await page.waitForTimeout(1000);
  await canvas.click();
  await expect(page.locator('.maplibregl-popup-content')).toContainText(point.id);
  await expect(page.locator('.point-battery')).toHaveCount(0);
});

test('keeps point details within the map on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await stubTiles(page);
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [event(members[0], 0, 1)], next_cursor: null } }));
  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await page.getByRole('button', { name: /Участник 11111111.*открыть точку/ }).focus();
  await page.keyboard.press('Enter');
  const popup = page.locator('.maplibregl-popup');
  await expect(popup).toBeVisible();
  const box = await popup.boundingBox();
  const map = await page.locator('.route-map').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(box!.y + box!.height).toBeLessThanOrEqual(map!.height);
  const close = await popup.locator('.maplibregl-popup-close-button').boundingBox();
  const scroll = await popup.locator('.point-scroll').boundingBox();
  expect(scroll!.y).toBeGreaterThanOrEqual(close!.y + close!.height);
  expect(await popup.locator('.point-scroll').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('selects a participant and preserves the map view on refresh', async ({ page }) => {
  await stubTiles(page);
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: members.flatMap((member, index) => [event(member, index, 1), event(member, index, 2)]), next_cursor: null } }));
  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();

  const member = page.getByRole('button', { name: /11111111/ }).last();
  await member.click();
  await expect(member).toHaveAttribute('aria-pressed', 'true');
  await member.click();
  await expect(member).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(400);
  const position = page.url();
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page).toHaveURL(position);

  const marker = page.getByRole('button', { name: /Участник 11111111.*открыть точку/ });
  await marker.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.maplibregl-popup-content')).toContainText('12:01');
});

test('restores the shared map state after the token is entered again', async ({ page }) => {
  await stubTiles(page);
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: members.flatMap((member, index) => [event(member, index, 1), event(member, index, 2)]), next_cursor: null } }));
  await page.goto('/?source=test');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await page.locator('button[aria-pressed]').first().click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('member')).toBe(members[0]);
  await expect.poll(() => new URL(page.url()).searchParams.has('zoom')).toBe(true);
  await page.waitForTimeout(400);
  const sharedUrl = page.url();
  expect(sharedUrl).not.toContain(token);
  const before = new URL(sharedUrl).searchParams;

  await page.reload();
  await expect(page.getByLabel('Ключ группы')).toHaveValue('');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.locator('button[aria-pressed]').first()).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('zoom')).toBe(before.get('zoom'));
  expect(new URL(page.url()).searchParams.get('lat')).toBe(before.get('lat'));
  expect(new URL(page.url()).searchParams.get('lon')).toBe(before.get('lon'));

  await page.getByRole('button', { name: 'На страницу ввода ключа' }).click();
  const cleared = new URL(page.url()).searchParams;
  expect(cleared.get('source')).toBe('test');
  expect(cleared.has('member') || cleared.has('lat') || cleared.has('lon') || cleared.has('zoom')).toBe(false);
});

test('copies a read-only link that opens the selected route', async ({ page, context }) => {
  const readOnly = `view_${'B'.repeat(43)}`;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await stubTiles(page);
  await page.route('**/api/v1/share-links', (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    return route.fulfill({ status: 201, json: { token: readOnly } });
  });
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: members.flatMap((member, index) => [event(member, index, 1), event(member, index, 2)]), next_cursor: null } }));
  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await page.locator('button[aria-pressed]').first().click();
  await page.getByRole('button', { name: 'Поделиться' }).click();
  await expect(page.getByRole('status')).toContainText('Ссылка скопирована');
  await expect(page.getByRole('status')).toContainText('для просмотра маршрута');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(link).searchParams.get('view')).toBe(readOnly);
  expect(new URL(link).hash).toBe('');
  expect(link).not.toContain(token);

  const recipient = await context.newPage();
  await stubTiles(recipient);
  await recipient.route('**/api/v1/events*', (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${readOnly}`);
    return route.fulfill({ json: { events: members.flatMap((member, index) => [event(member, index, 1), event(member, index, 2)]), next_cursor: null } });
  });
  await recipient.goto(link);
  await expect(recipient.locator('button[aria-pressed]').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(recipient.getByText('3 участника · 6 точек')).toBeVisible();
  await recipient.reload();
  await expect(recipient.getByText('3 участника · 6 точек')).toBeVisible();
});

test('shows progress and errors when sharing, and allows retrying', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [], next_cursor: null } }));

  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let attempts = 0;
  await page.route('**/api/v1/share-links', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await pending;
      await route.fulfill({ status: 503 });
    } else {
      await route.fulfill({ status: 201, json: { token: `view_${'B'.repeat(43)}` } });
    }
  });

  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  const share = page.getByRole('button', { name: 'Поделиться' });
  await share.click();
  await expect(share).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('Создаём ссылку');
  release();
  await expect(page.getByRole('alert')).toContainText('Не удалось скопировать ссылку');
  await expect(share).toBeEnabled();

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
  await share.click();
  await expect(page.getByRole('alert')).toContainText('Попробуйте ещё раз');
  await page.evaluate(() => { delete (navigator as Navigator & { clipboard?: Clipboard }).clipboard; });
  await share.click();
  await expect(page.getByRole('status')).toContainText('Ссылка скопирована');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('any viewer can clear a warning and copy the ntfy address', async ({ page, context }) => {
  let active = false;
  const state = () => ({ active, source: active ? 'observer' : null, alert_id: active ? '0b08ff93-5e04-4e55-8cac-769f84050a20' : null, subscription_url: 'https://notify.example/rollcall-random', observers: 0, approvals: 0, required_approvals: 1, registered: false, approved: false });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [], next_cursor: null } }));
  await page.route('**/api/v1/alert', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    if (route.request().method() === 'POST') {
      active = true;
      await route.fulfill({ json: { notified: true } });
    } else if (route.request().method() === 'DELETE') {
      expect(route.request().headers()['x-observer-key']).toBeUndefined();
      expect(route.request().headers()['x-alert-id']).toBe('0b08ff93-5e04-4e55-8cac-769f84050a20');
      active = false;
      await route.fulfill({ json: state() });
    } else {
      await route.fulfill({ json: state() });
    }
  });

  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.getByRole('link', { name: 'Открыть подписку в ntfy' })).toHaveAttribute('href', 'https://notify.example/rollcall-random');
  await page.getByRole('button', { name: 'Скопировать адрес подписки ntfy' }).click();
  await expect(page.getByText('Адрес подписки ntfy скопирован.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://notify.example/rollcall-random');
  await page.getByRole('button', { name: 'Оповестить наблюдателей' }).click();
  await expect(page.getByText('Предупреждение наблюдателя')).toBeVisible();
  await page.getByRole('button', { name: 'Снять' }).click();
  await expect(page.getByText('Предупреждение наблюдателя')).toBeHidden();
});

test('shows when ntfy did not accept a warning', async ({ page }) => {
  let active = false;
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [], next_cursor: null } }));
  await page.route('**/api/v1/alert', (route) => {
    if (route.request().method() === 'POST') {
      active = true;
      return route.fulfill({ json: { notified: false } });
    }
    return route.fulfill({ json: { active, alert_id: active ? '0b08ff93-5e04-4e55-8cac-769f84050a20' : null, subscription_url: 'https://notify.example/topic', observers: 0, approvals: 0, required_approvals: 2, registered: false, approved: false } });
  });
  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await page.getByRole('button', { name: 'Оповестить наблюдателей' }).click();
  await expect(page.getByText(/Предупреждение активно/)).toBeVisible();
  await expect(page.getByText(/ntfy не принял уведомление/)).toBeVisible();
});

test('shows when the warning is an SOS', async ({ page }) => {
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: { events: [], next_cursor: null } }));
  await page.route('**/api/v1/alert', (route) => route.fulfill({ json: { active: true, source: 'sos', member_id: '8c1e5b0a-3f2d-4c6e-9a7b-1d2e3f4a5b6c', alert_id: '0b08ff93-5e04-4e55-8cac-769f84050a20', subscription_url: 'https://notify.example/topic', observers: 0, approvals: 0, required_approvals: 1, registered: false, approved: false } }));
  await page.goto('/');
  await page.getByLabel('Ключ группы').fill(token);
  await page.getByRole('button', { name: 'Открыть карту' }).click();
  await expect(page.getByText('SOS от участника 8c1e5b0a')).toBeVisible();
});
