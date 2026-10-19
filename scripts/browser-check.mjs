import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Optional browser test tooling is development-only. The static site makes no remote requests.
const { chromium, webkit } = await import(process.env.IMD_PLAYWRIGHT ? pathToFileURL(process.env.IMD_PLAYWRIGHT).href : 'playwright');
const root = resolve('dist');
const output = resolve('test/scratch/browser');
await mkdir(output, { recursive: true });
const checks = [], errors = [], external = [], missing = [];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (!pathname.startsWith('/preview/')) throw Error('Outside preview');
    const file = resolve(root, pathname.slice('/preview/'.length) || 'index.html');
    if (!file.startsWith(root + sep)) throw Error('Outside export');
    const bytes = await readFile(file);
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(bytes);
  } catch { res.statusCode = 404; res.end('Missing local file'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/preview/`;
let browser;
const check = (name, detail) => { checks.push({ name, passed: true, detail }); console.log(`PASS ${name}: ${detail}`); };
async function route(page, hash, heading) {
  await page.goto(base + '#/' + hash);
  await page.getByRole('heading', { name: heading, exact: false }).first().waitFor();
  await page.evaluate(() => { document.documentElement.scrollTop = 0; });
}
async function pause(page, tick) {
  await page.waitForFunction(() => Number(document.querySelector('input[aria-label="Timeline scrubber"]')?.max) > 1);
  const button = page.getByRole('button', { name: 'Pause', exact: true });
  if (await button.isVisible()) await button.click();
  if (tick !== undefined) await page.getByRole('slider', { name: 'Timeline scrubber' }).fill(String(tick));
}
async function lampStyles(page) {
  return page.getByRole('status', { name: /Scoring box:/ }).evaluate(el => [...el.children].map(c => ({ text: c.textContent, color: getComputedStyle(c).color, bg: getComputedStyle(c).backgroundColor, size: getComputedStyle(c).fontSize })));
}
function contrast(a, b) {
  const lum = v => { const c = v.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
  const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    if (!route.request().url().startsWith(base)) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) missing.push(r.url()); });

  const layouts = [];
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 700 : width === 390 ? 844 : 900 });
    for (const [hash, heading] of [['', 'Train foil fencing in 3D'], ['learn/FW04', 'Lunge'], ['learn/AT03', 'Disengage']]) {
      await route(page, hash, heading);
      if (hash) await pause(page, 48);
      const measure = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(measure.scroll <= width, `${hash || 'home'} ${width}: ${measure.scroll}px`);
      if (hash) {
        const boxes = await page.getByRole('group', { name: 'Playback speed', exact: true }).getByRole('button').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
        assert.equal(boxes.length, 4);
        assert.ok(boxes.every(b => b.left >= 0 && b.right <= width));
      } else if (width === 390) {
        const rect = await page.getByRole('link', { name: 'Start learning', exact: true }).boundingBox();
        assert.ok(rect.y >= 0 && rect.y + rect.height < 844);
        await page.screenshot({ path: resolve(output, 'home-390.png') });
      }
      layouts.push(`${hash || 'home'} ${width}:${measure.scroll}`);
      if (width === 390 && hash === 'learn/FW04') await page.screenshot({ path: resolve(output, 'lunge-390.png'), fullPage: true });
    }
  }
  check('responsive playback and first screen', layouts.join(', '));
  await page.setViewportSize({ width: 1440, height: 900 });

  await route(page, 'learn/PA02', 'Sixte parry');
  await pause(page, 36);
  assert.doesNotMatch(await page.locator('[aria-current="step"]').innerText(), /Riposte/);
  await page.getByRole('slider', { name: 'Timeline scrubber' }).fill('51');
  assert.match(await page.locator('[aria-current="step"]').innerText(), /Riposte/);
  await page.getByRole('slider', { name: 'Timeline scrubber' }).fill('45');
  await page.screenshot({ path: resolve(output, 'sixte-contact-1440.png'), fullPage: true });
  check('coaching synchronization', 'Sixte incoming/parry step at tick 36; riposte step at actual tick 51.');

  await route(page, 'learn/BL14', 'Dérobement');
  assert.equal(await page.getByText(/Keep the arm straight and evade the attempted blade contact/).count(), 1);
  await page.getByRole('button', { name: 'Mark as learned', exact: true }).click();
  await page.getByRole('group', { name: 'Self-rating' }).getByRole('button', { name: '4', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Learned', exact: true }).waitFor();
  assert.equal(await page.getByRole('group', { name: 'Self-rating' }).getByRole('button', { name: '4', exact: true }).getAttribute('aria-pressed'), 'true');
  check('learned progress and derobement notes', 'Correct evasion coaching; rating 4 persists after reload.');

  await route(page, 'learn', 'Technique library');
  const search = page.getByRole('searchbox');
  await search.fill('fente');
  assert.ok(await page.getByRole('button', { name: /Lunge/ }).count() >= 1);
  await search.fill('zzzz-nothing-matches');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  assert.equal(await page.getByText('100 of 100 techniques', { exact: true }).count(), 1);
  check('library search and empty state', 'French-name search resolves Lunge; Clear filters restores all 100.');

  await route(page, 'drills', 'Drills');
  await page.getByRole('button', { name: 'Build It', exact: true }).click();
  await page.getByRole('button', { name: 'Start Build It', exact: true }).click();
  const prompt = await page.getByRole('heading', { level: 2 }).innerText();
  const circular = /Counter-sixte|Counter-quarte/.test(prompt);
  const cards = await page.locator('[data-action-id]').evaluateAll(nodes => nodes.map(n => n.dataset.actionId));
  const finisher = cards.find(id => (circular ? ['AT05', 'AT12'] : ['AT03', 'AT10']).includes(id));
  assert.ok(finisher, 'a deceptive finish is available for the stated parry');
  await page.locator(`[data-action-id="${finisher}"]`).click();
  assert.equal(await page.getByRole('button', { name: 'Next round', exact: true }).count(), 0);
  await page.locator('[data-action-id="FW02"]').click();
  await page.getByRole('button', { name: 'Move Advance earlier', exact: true }).click();
  assert.match(await page.getByRole('list', { name: 'Your action sequence' }).getByRole('listitem').first().innerText(), /1. Advance/);
  await page.getByRole('button', { name: 'Submit sequence', exact: true }).click();
  await page.getByText('Correct.', { exact: true }).waitFor();
  await pause(page);
  const buildScrub = page.getByRole('slider', { name: 'Timeline scrubber' });
  await buildScrub.fill(await buildScrub.getAttribute('max'));
  assert.match(await page.getByRole('status', { name: /Scoring box:/ }).getAttribute('aria-label'), /red on/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.evaluate(() => { document.documentElement.scrollTop = 0; });
  await page.screenshot({ path: resolve(output, 'build-it-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  check('Build It assembly and playback', `${finisher} selected before Advance, reordered, then graded only on Submit; chosen sequence lights red and fits 390px.`);

  let green;
  for (const hash of ['counters/FW04/PA01', 'counters/AT06/PA03']) {
    await route(page, hash, 'Counter Explorer');
    await pause(page);
    const scrub = page.getByRole('slider', { name: 'Timeline scrubber' });
    await scrub.fill(await scrub.getAttribute('max'));
    assert.match(await page.getByRole('status', { name: /Scoring box:/ }).getAttribute('aria-label'), /green on/);
    await page.getByText('Why?', { exact: true }).click();
    assert.equal(await page.getByText(/closed the wrong line/).count(), 0);
    green = (await lampStyles(page)).find(l => l.text === 'Right');
  }
  await route(page, 'learn/FW04', 'Lunge');
  await pause(page, 60);
  const red = (await lampStyles(page)).find(l => l.text === 'Left');
  const redRatio = contrast(red.color, red.bg), greenRatio = contrast(green.color, green.bg);
  assert.ok(redRatio >= 4.5 && greenRatio >= 4.5);
  check('reliable counters and lamp contrast', `Both reported counters light green; 13px lamp contrast red ${redRatio.toFixed(3)}:1, green ${greenRatio.toFixed(3)}:1.`);

  await route(page, 'fence', 'Fencing Mode');
  await page.getByRole('button', { name: 'Tempo Mode', exact: true }).click();
  await page.getByRole('button', { name: 'NPC Club', exact: true }).click();
  await page.getByRole('button', { name: 'En garde', exact: true }).click();
  await page.keyboard.press('d');
  await page.keyboard.press('q');
  await page.keyboard.press('a');
  assert.equal(await page.getByRole('region', { name: 'left fencer Tempo pad' }).count(), 1);
  await page.getByRole('button', { name: 'Halt phrase', exact: true }).click();
  await page.getByRole('button', { name: 'Save phrase', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('piste.progress')).state.phrases[0]);
  const actions = saved.tempoActions.filter(a => a.side === 'left');
  assert.deepEqual(actions.map(a => a.choice.foot ?? a.choice.blade), ['FW02', 'PA01', 'FW03']);
  assert.ok(actions[2].tick - actions[0].tick < 36, 'three inputs were accepted during the advance');
  assert.ok(saved.endTick >= actions.at(-1).tick);
  await page.getByRole('button', { name: 'Replay', exact: true }).first().click();
  await page.getByRole('slider', { name: 'Timeline scrubber' }).waitFor();
  check('Tempo overlapping input and saved replay', JSON.stringify(actions.map(a => ({ tick: a.tick, action: a.choice.foot ?? a.choice.blade }))));

  await page.getByRole('button', { name: 'End bout', exact: true }).click();
  await page.getByRole('button', { name: 'Human (hot-seat)', exact: true }).click();
  await page.getByRole('button', { name: 'En garde', exact: true }).click();
  const leftPad = page.getByRole('region', { name: 'left fencer Tempo pad' });
  const rightPad = page.getByRole('region', { name: 'right fencer Tempo pad' });
  await leftPad.getByRole('button', { name: 'Advance D', exact: true }).click();
  await rightPad.getByRole('button', { name: 'Sixte E', exact: true }).click();
  await page.getByRole('group', { name: 'Keyboard fencer' }).getByRole('button', { name: 'Right · green', exact: true }).click();
  await page.keyboard.press('a');
  await page.setViewportSize({ width: 390, height: 844 });
  await leftPad.getByText('All legal actions', { exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  const selects = await leftPad.getByRole('combobox').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
  assert.ok(selects.every(r => r.left >= 0 && r.right <= 390));
  await page.evaluate(() => { document.documentElement.scrollTop = 0; });
  await page.screenshot({ path: resolve(output, 'human-tempo-390.png'), fullPage: true });
  await page.getByRole('button', { name: 'Halt phrase', exact: true }).click();
  await page.getByRole('button', { name: 'Save phrase', exact: true }).click();
  const human = await page.evaluate(() => JSON.parse(localStorage.getItem('piste.progress')).state.phrases[0].tempoActions);
  assert.deepEqual(human.map(a => [a.side, a.choice.foot ?? a.choice.blade]), [['left', 'FW02'], ['right', 'PA02'], ['right', 'FW03']]);
  check('Tempo Human opponent', 'Both live pads and keyboard-side selection accepted exactly the three human actions; no NPC actions.');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '#/');
  await page.getByRole('link', { name: 'Start learning', exact: true }).waitFor();
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { text: e.textContent, outline: s.outlineStyle, width: s.outlineWidth }; });
  assert.equal(focus.outline, 'solid');
  assert.equal(focus.width, '2px');
  await page.screenshot({ path: resolve(output, 'keyboard-focus-1440.png') });
  check('keyboard focus', JSON.stringify(focus));
  await context.close();
  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const rp = await reduced.newPage();
  await route(rp, '', 'Train foil fencing in 3D');
  assert.equal(await rp.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  await rp.screenshot({ path: resolve(output, 'reduced-motion-390.png') });
  await reduced.close();
  check('reduced-motion render', 'First screen renders with the preference enabled.');
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  assert.deepEqual(external, []);
  check('production resources and offline runtime', 'No console/page errors, missing resources or remote requests under /preview/.');
} catch (e) {
  checks.push({ name: 'browser interaction validation', passed: false, detail: e.stack });
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  let wk;
  try { wk = await webkit.launch({ headless: true }); checks.push({ name: 'WebKit availability', passed: true }); }
  catch (e) { checks.push({ name: 'WebKit availability', passed: null, detail: e.message }); console.log('LIMITATION WebKit could not launch; see results.json for missing host libraries.'); }
  finally { await wk?.close(); }
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ checks, errors, external, missing }, null, 2));
  await new Promise(r => server.close(r));
}
