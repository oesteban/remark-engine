// Print a remark deck in headless Chrome and check the result. Run through
// tools/check-print.sh.
//
//   node check-print.mjs <node_modules with puppeteer-core> <chrome> <deck url> <out dir>
//
// Each check prints ok or FAIL, and the script exits 1 if any fails:
//   1. Printing leaves the screen alone. remark's inline geometry on every slide
//      and a screenshot, taken before page.pdf() and after it, must match, in the
//      audience view and in presenter mode. Chrome fires the same print listeners
//      as Firefox, so this is where a print that rearranges the screen shows.
//   2. Slides only: one 1210x681 page per slide.
//   3. Handout (presenter mode): every slide prints except the earlier builds of
//      a slide, and no note overlaps its slide.
//   4. The print buttons, on the bar and in the presenter toolbar, call
//      window.print() only once every <object> SVG has loaded.
// Checks 1 to 3 print as Ctrl+P does, straight away (ctrl-p-*.pdf). Check 4
// then prints what the buttons print (slides.pdf, handout-*.pdf), and those PDFs
// are rendered page by page, as PNG, to be read back.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';

const [,, nm, chrome, url, out] = process.argv;
const require = createRequire(nm + '/');
const puppeteer = require('puppeteer-core');

const failures = [];
function check(ok, what) {
  console.log((ok ? 'ok   ' : 'FAIL ') + what);
  if (!ok) { failures.push(what); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function pdfInfo(file) {
  const info = execFileSync('pdfinfo', [file]).toString();
  const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
  return { pages: +info.match(/Pages:\s+(\d+)/)[1], w: +size[1], h: +size[2] };
}

const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

async function open(hash) {
  await page.goto('about:blank');
  await page.goto(url + hash, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(1500);
}

// What a print can disturb: the inline styles remark writes on slides and notes.
const geometry = () => page.evaluate(() =>
  [...document.querySelectorAll('.remark-slides-area .remark-slide-scaler, ' +
                                '.remark-slides-area .remark-slide-notes')]
    .map(e => e.getAttribute('style') || '').join('\n'));

const slideCount = () => page.evaluate(() =>
  document.querySelectorAll('.remark-slides-area .remark-slide-container').length);

// ---- 1 and 2: the audience view prints the slides ---------------------------
await open('#1');
let before = await geometry();
let shot = await page.screenshot({ encoding: 'base64' });
const slides = await slideCount();
await page.pdf({ path: `${out}/ctrl-p-slides.pdf`, preferCSSPageSize: true, printBackground: true });
await sleep(500);
check(await geometry() === before, 'audience view: printing leaves the slide geometry alone');
check(await page.screenshot({ encoding: 'base64' }) === shot, 'audience view: the screen after printing is the screen before');

let info = pdfInfo(`${out}/ctrl-p-slides.pdf`);
check(info.pages === slides, `slides: ${info.pages} pages for ${slides} slides`);
check(Math.abs(info.w - 907.5) < 1 && Math.abs(info.h - 510.75) < 1,
      `slides: page size ${info.w} x ${info.h} pt, 1210 x 681 px expected`);

// The same print forced onto A4 landscape, as a system print dialog does.
await page.pdf({ path: `${out}/ctrl-p-slides-a4.pdf`, format: 'A4', landscape: true,
                 preferCSSPageSize: false, printBackground: true });
info = pdfInfo(`${out}/ctrl-p-slides-a4.pdf`);
check(info.pages === slides, `slides on A4: ${info.pages} pages for ${slides} slides`);

// ---- 1 and 3: presenter mode prints the handout -----------------------------
await open('#p1');
before = await geometry();
shot = await page.screenshot({ encoding: 'base64' });
await page.pdf({ path: `${out}/ctrl-p-handout-portrait.pdf`, format: 'A4', preferCSSPageSize: true,
                 printBackground: true });
await sleep(500);
check(await geometry() === before, 'presenter mode: printing leaves the slide geometry alone');
check(await page.screenshot({ encoding: 'base64' }) === shot, 'presenter mode: the screen after printing is the screen before');
await page.pdf({ path: `${out}/ctrl-p-handout-landscape.pdf`, format: 'A4', landscape: true,
                 preferCSSPageSize: true, printBackground: true });
info = pdfInfo(`${out}/ctrl-p-handout-portrait.pdf`);
check(info.w < info.h, `handout: portrait pages (${info.w} x ${info.h} pt), ${info.pages} of them`);
info = pdfInfo(`${out}/ctrl-p-handout-landscape.pdf`);
check(info.w > info.h, `handout: landscape pages (${info.w} x ${info.h} pt), ${info.pages} of them`);

await page.emulateMediaType('print');
const rows = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.remark-slides-area .remark-slide-container')];
  const shown = all.filter(c => getComputedStyle(c).display !== 'none');
  const overlapping = shown.filter(c => {
    const s = c.querySelector('.remark-slide-scaler').getBoundingClientRect();
    return [...c.querySelectorAll('.remark-slide-notes, .remark-print-carried-notes')].some(n => {
      const r = n.getBoundingClientRect();
      return r.height > 0 && r.left < s.right - 1 && r.top < s.bottom - 1;
    });
  });
  return {
    total: all.length,
    shown: shown.length,
    superseded: all.filter(c => c.classList.contains('remark-print-superseded')).length,
    overlapping: overlapping.length
  };
});
await page.emulateMediaType(null);
check(rows.shown > 0 && rows.shown === rows.total - rows.superseded,
      `handout: ${rows.shown} slides print, ${rows.superseded} earlier builds left out, of ${rows.total}`);
check(rows.overlapping === 0, `handout: ${rows.overlapping} slides with notes over the slide`);

// ---- 4: the print buttons ---------------------------------------------------
// What each button prints, once it has called window.print().
const prints = {
  '#1': [['slides', {}], ['slides-a4', { format: 'A4', landscape: true, preferCSSPageSize: false }]],
  '#p1': [['handout-portrait', { format: 'A4' }], ['handout-landscape', { format: 'A4', landscape: true }]]
};
for (const [label, hash, selector] of [
  ['bar print button', '#1', '.nav-controls-bar .nav-btn-print'],
  ['presenter toolbar print link', '#p1', '.remark-toolbar .remark-toolbar-print']
]) {
  await open(hash);
  if (!await page.$(selector)) {
    check(false, `${label}: ${selector} exists`);
    continue;
  }
  await page.evaluate(() => {
    window.print = function () {
      const objects = [...document.querySelectorAll('.remark-slides-area object[type="image/svg+xml"]')];
      const loaded = o => {
        try { return !!(o.contentDocument && o.contentDocument.documentElement); } catch (e) { return false; }
      };
      window.__printed = {
        total: objects.length,
        loaded: objects.filter(loaded).length,
        pinned: objects.filter(o => o.style.aspectRatio || o.style.height || o.getAttribute('height')).length
      };
    };
  });
  await page.evaluate(s => document.querySelector(s).click(), selector);
  await page.waitForFunction(() => window.__printed, { timeout: 15000 }).catch(() => {});
  const printed = await page.evaluate(() => window.__printed || null);
  check(!!printed, `${label}: calls window.print()`);
  if (printed) {
    check(printed.loaded === printed.total,
          `${label}: ${printed.loaded} of ${printed.total} SVG objects loaded before printing`);
    check(printed.pinned === printed.total,
          `${label}: ${printed.pinned} of ${printed.total} SVG objects keep their proportions in print`);
  }
  for (const [name, options] of prints[hash]) {
    await page.pdf({ path: `${out}/${name}.pdf`, preferCSSPageSize: true, printBackground: true,
                     ...options });
  }
}

await browser.close();

for (const name of ['slides', 'slides-a4', 'handout-portrait', 'handout-landscape']) {
  if (existsSync(`${out}/${name}.pdf`)) {
    execFileSync('pdftoppm', ['-r', '40', '-png', `${out}/${name}.pdf`, `${out}/${name}`]);
  }
}
console.log(`PDFs and pages in ${out}/`);
process.exit(failures.length ? 1 : 0);
