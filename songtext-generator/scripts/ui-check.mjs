/**
 * End-to-End-Check gegen den laufenden Dev-Server, mit gefälschten Antworten
 * beider Anbieter - prüft Streaming, Varianten-Duell, Kreuz-Kritik, Silbenmaß,
 * Zeilen-Locks und den Export, ohne einen echten API-Key zu brauchen.
 *
 *   npm run dev                       # in einem zweiten Terminal
 *   npx playwright install chromium   # einmalig
 *   npm run ui-check
 */
import { chromium } from 'playwright';

const OUT = process.env.UI_CHECK_OUT ?? '.';
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

const CLAUDE_LINES = ['Der Fahrer zählt mein Kleingeld nach', 'Dein Name steht noch im Display', 'Im Treppenhauslicht zwei nasse Schuhe', 'Die Monatskarte war seit Dienstag durch'];
const GEMINI_LINES = ['Im Nachtbus riecht es nach nassem Mantel', 'Mein Daumen wischt dich aus der Liste', 'Das Treppenhauslicht zählt mir die Sekunden', 'Die abgelaufene Monatskarte liegt noch im Schacht'];

const sse = (events) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n';

// --- Anthropic ---
await page.route('**/api.anthropic.com/**', async (route) => {
  const body = JSON.parse(route.request().postData() ?? '{}');
  const isCritique = body.system?.includes('Songtext-Lektor');
  const text = isCritique
    ? '```json\n[{"line":2,"severity":"hart","strategy":"Image Stacking","problem":"Display ist ein Klischee-Bild.","suggestion":"Dein Name klebt noch im Verlauf"}]\n```'
    : CLAUDE_LINES.join('\n');

  if (body.stream) {
    const events = [{ type: 'message_start' }];
    for (const chunk of text.match(/.{1,18}/gs)) {
      events.push({ type: 'content_block_delta', delta: { type: 'text_delta', text: chunk } });
    }
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(events) });
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text }] })
  });
});

// --- Gemini ---
await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
  const url = route.request().url();
  const text = GEMINI_LINES.join('\n');
  if (url.includes('streamGenerateContent')) {
    const events = text.match(/.{1,18}/gs).map((chunk) => ({ candidates: [{ content: { parts: [{ text: chunk }] } }] }));
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(events) });
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })
  });
});

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

await page.getByRole('button', { name: /Settings/ }).click();
await page.getByPlaceholder('sk-ant-...').fill('sk-ant-test');
await page.getByPlaceholder('AIza...').fill('AIza-test');
await page.getByPlaceholder(/Worum geht es/).fill('Letzter Nachtbus nach dem Streit, 3 Uhr.');
await page.getByPlaceholder(/Nachtbus, abgelaufene/).fill('Nachtbus, Treppenhauslicht, abgelaufene Monatskarte');

const strophe = page.locator('.block').first();
const refrain = page.locator('.block').nth(1);

// 1) Block generieren (gestreamt)
await strophe.getByRole('button', { name: /Block generieren/ }).click();
await page.waitForFunction(() => document.querySelectorAll('.block')[0].querySelectorAll('.line').length >= 4, null, { timeout: 10000 });
const generated = await strophe.locator('.line__input').first().inputValue();
console.log('1 Streaming-Generierung :', generated === CLAUDE_LINES[0] ? 'OK' : `ABW "${generated}"`);
console.log('1 Silbenzahl Zeile 1    :', await strophe.locator('.line__syllables').first().textContent());

// 2) Verlauf
console.log('2 Verlauf               :', await strophe.getByRole('button', { name: /Verlauf/ }).textContent());

// 3) Block locken -> Kontext für Refrain
await strophe.getByText('Lock / Fertig').click();
console.log('3 Kontext im Refrain    :', await refrain.locator('.tag--on').filter({ hasText: 'Kontext' }).textContent());

// 4) Varianten-Duell
await refrain.getByRole('button', { name: /Varianten-Duell/ }).click();
await refrain.locator('.duel__column').first().waitFor({ timeout: 10000 });
const columns = await refrain.locator('.duel__column').count();
const providers = await refrain.locator('.duel__provider').allTextContents();
console.log('4 Duell-Spalten         :', columns, providers.join(' vs '));

// 4b) eine Zeile aus Gemini-Spalte übernehmen
const geminiCol = refrain.locator('.duel__column').filter({ hasText: 'GEMINI' });
await geminiCol.locator('.duel__adopt').nth(1).click();
const adopted = await refrain.locator('.line__input').nth(1).inputValue();
console.log('4b Zeile übernommen     :', adopted === GEMINI_LINES[1] ? 'OK' : `ABW "${adopted}"`);

// 5) Kreuz-Kritik (Refrain nutzt Gemini -> Prüfer ist Claude)
await refrain.getByRole('button', { name: /Kreuz-Kritik/ }).click();
await refrain.locator('.finding').first().waitFor({ timeout: 10000 });
console.log('5 Befund                :', (await refrain.locator('.finding__problem').first().textContent()).slice(0, 40));
console.log('5 Prüfer                :', await refrain.locator('.tag').filter({ hasText: 'Prüfer' }).textContent());
await refrain.locator('.finding').first().getByRole('button', { name: 'Übernehmen' }).click();
console.log('5b Vorschlag drin       :', (await refrain.locator('.line__input').nth(1).inputValue()) === 'Dein Name klebt noch im Verlauf' ? 'OK' : 'ABW');

// 6) Ganze Gemini-Variante übernehmen, dann Zeilen 1+3 locken -> Micro-Edit
await geminiCol.getByRole('button', { name: 'Ganz übernehmen' }).click();
await page.waitForFunction(() => document.querySelectorAll('.block')[1].querySelectorAll('.line').length >= 4, null, { timeout: 10000 });
console.log('6 nach Vollübernahme    :', (await refrain.locator('.line__input').nth(3).inputValue()) === GEMINI_LINES[3] ? 'OK' : 'ABW');
await refrain.locator('.line__lock').nth(0).click();
await refrain.locator('.line__lock').nth(2).click();
console.log('6 Silbenmaß-Tag         :', await refrain.locator('.tag--on').filter({ hasText: 'Maß' }).textContent());
console.log('6 Micro-Edit-Button     :', await refrain.getByRole('button', { name: /Freie Zeilen/ }).textContent());

await page.screenshot({ path: `${OUT}/ui-full.png`, fullPage: true });
await refrain.screenshot({ path: `${OUT}/ui-refrain.png` });

// 7) Export/Import
const download = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: '.json', exact: true }).click()
]).then(([d]) => d);
const exported = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
console.log('7 Export ohne Keys      :', !/sk-ant|AIza/.test(exported) ? 'OK' : 'KEYS IM EXPORT!');
console.log('7 Export-Größe          :', exported.length, 'Bytes');

console.log(errors.length ? `CONSOLE-FEHLER: ${JSON.stringify(errors)}` : 'KEINE CONSOLE-FEHLER');
await browser.close();
