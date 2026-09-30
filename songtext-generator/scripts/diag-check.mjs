/**
 * Diagnose-Check: fälscht die typischen Fehlerantworten beider Anbieter und
 * prüft, dass der Verbindungstest und die Fehlerleiste am Block daraus
 * Klartext machen. Braucht einen laufenden Dev-Server.
 *
 *   npm run dev                       # zweites Terminal
 *   npx playwright install chromium   # einmalig
 *   npm run diag-check
 */
import { chromium } from 'playwright';
const OUT = process.env.UI_CHECK_OUT ?? '.';
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Anthropic: gültiger Key -> 200, alles andere -> 401 wie im Original
await page.route('**/api.anthropic.com/**', (route) => {
  const key = route.request().headers()['x-api-key'];
  if (key === 'sk-ant-gut') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }) });
  }
  return route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })
  });
});
// Gemini: Modell unbekannt
await page.route('**/generativelanguage.googleapis.com/**', (route) =>
  route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', message: 'models/gemini-2.5-pro is not found' } })
  })
);

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Settings/ }).click();

const rows = page.locator('.provider-row');

// 1) Falscher Anthropic-Key
await page.getByPlaceholder('sk-ant-...').fill('sk-ant-falsch');
await rows.nth(0).getByRole('button', { name: 'Verbindung testen' }).click();
await rows.nth(0).locator('.diagnosis').waitFor({ timeout: 10000 });
console.log('1 Falscher Key  :', await rows.nth(0).locator('.diagnosis__headline').textContent());
console.log('1 Rat           :', (await rows.nth(0).locator('.diagnosis__remedy').textContent()).slice(0, 70), '…');

// 2) Richtiger Anthropic-Key
await page.getByPlaceholder('sk-ant-...').fill('sk-ant-gut');
await rows.nth(0).getByRole('button', { name: 'Verbindung testen' }).click();
await rows.nth(0).locator('.tag--on').waitFor({ timeout: 10000 });
console.log('2 Erfolg        :', await rows.nth(0).locator('.tag--on').textContent());
console.log('2 Diagnose weg  :', (await rows.nth(0).locator('.diagnosis').count()) === 0 ? 'OK' : 'noch da');

// 3) Gemini: unbekanntes Modell
await page.getByPlaceholder('AIza...').fill('AIza-test');
await rows.nth(1).getByRole('button', { name: 'Verbindung testen' }).click();
await rows.nth(1).locator('.diagnosis').waitFor({ timeout: 10000 });
console.log('3 Modell        :', await rows.nth(1).locator('.diagnosis__headline').textContent());

// 4) Fehlerleiste am Block nutzt dieselbe Übersetzung
await page.getByPlaceholder(/Worum geht es/).fill('Test');
const strophe = page.locator('.block').first();
await strophe.locator('select').nth(1).selectOption('gemini');
await strophe.getByRole('button', { name: /Block generieren/ }).click();
await strophe.locator('.error-bar').waitFor({ timeout: 15000 });
console.log('4 Block-Fehler  :', (await strophe.locator('.error-bar').textContent()).split('→')[0].trim());

await page.locator('.panel--settings').screenshot({ path: `${OUT}/diagnose.png` });
console.log(errors.length ? `PAGEERRORS: ${errors}` : 'KEINE PAGEERRORS');
await browser.close();
