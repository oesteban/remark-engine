// Print a remark deck in headless Chrome and check the result. Run through
// tools/check-print.sh.
//
//   node check-print.mjs <node_modules with puppeteer-core> <chrome> <deck url> <out dir> [firefox]
//
// Each check prints ok or FAIL, and the script exits 1 if any fails:
//   1. Printing leaves the screen alone. remark's inline geometry on every slide
//      and a screenshot, taken before page.pdf() and after it, must match, in the
//      audience view and in presenter mode. Chrome fires the same print listeners
//      as Firefox, so this is where a print that rearranges the screen shows.
//   2. Slides only: one 1210x681 page per slide.
//   3. Handout (presenter mode): every slide prints except the earlier builds of
//      a slide, and no note overlaps its slide.
//   2 and 3 also check the width the page is laid out at, from inside the
//      print: Chrome widens the layout when anything is wider than the page,
//      and prints the result shrunk, which no screen-side check can see.
//   4. The print buttons, on the bar and in the presenter toolbar, call
//      window.print() only once every <object> SVG has loaded.
//   5. Firefox, when a path to it is given: the slides and the handout print,
//      and printing leaves presenter mode's geometry alone.
//   6. No page is blank, and every handout page keeps its content inside the
//      margins (needs ImageMagick; skipped without it).
// Checks 1 to 3 print as Ctrl+P does, straight away (ctrl-p-*.pdf). Check 4
// then prints what the buttons print (slides.pdf, handout-*.pdf), check 5 what
// Firefox prints (firefox-*.pdf), and those PDFs are rendered page by page, as
// PNG, to be read back.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';

const [,, nm, chrome, url, out, firefox] = process.argv;
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
const geometry = (tab = page) => tab.evaluate(() =>
  [...document.querySelectorAll('.remark-slides-area .remark-slide-scaler, ' +
                                '.remark-slides-area .remark-slide-notes')]
    .map(e => e.getAttribute('style') || '').join('\n'));

const slideCount = () => page.evaluate(() =>
  document.querySelectorAll('.remark-slides-area .remark-slide-container').length);

// page.pdf(), returning the width the page was laid out at during the print.
async function printAt(options) {
  await page.evaluate(() => {
    window.__printWidth = null;
    if (!window.__printWidthListener) {
      window.__printWidthListener = true;
      matchMedia('print').addEventListener('change', e => {
        if (e.matches) { window.__printWidth = document.documentElement.clientWidth; }
      });
    }
  });
  await page.pdf(options);
  return page.evaluate(() => window.__printWidth);
}
const mm = n => n * 96 / 25.4;
function checkWidth(width, expected, what) {
  check(Math.abs(width - expected) < 2, `${what}: laid out ${width} px wide, ${Math.round(expected)} expected`);
}

// ---- 1 and 2: the audience view prints the slides ---------------------------
await open('#1');
let before = await geometry();
let shot = await page.screenshot({ encoding: 'base64' });
const slides = await slideCount();
let width = await printAt({ path: `${out}/ctrl-p-slides.pdf`, preferCSSPageSize: true,
                             printBackground: true });
await sleep(500);
check(await geometry() === before, 'audience view: printing leaves the slide geometry alone');
check(await page.screenshot({ encoding: 'base64' }) === shot, 'audience view: the screen after printing is the screen before');

let info = pdfInfo(`${out}/ctrl-p-slides.pdf`);
check(info.pages === slides, `slides: ${info.pages} pages for ${slides} slides`);
check(Math.abs(info.w - 907.5) < 1 && Math.abs(info.h - 510.75) < 1,
      `slides: page size ${info.w} x ${info.h} pt, 1210 x 681 px expected`);
checkWidth(width, 1210, 'slides');

// The same print forced onto A4 landscape, as a system print dialog does.
await page.pdf({ path: `${out}/ctrl-p-slides-a4.pdf`, format: 'A4', landscape: true,
                 preferCSSPageSize: false, printBackground: true });
info = pdfInfo(`${out}/ctrl-p-slides-a4.pdf`);
check(info.pages === slides, `slides on A4: ${info.pages} pages for ${slides} slides`);

// ---- 1 and 3: presenter mode prints the handout -----------------------------
await open('#p1');
before = await geometry();
shot = await page.screenshot({ encoding: 'base64' });
width = await printAt({ path: `${out}/ctrl-p-handout-portrait.pdf`, format: 'A4',
                        preferCSSPageSize: true, printBackground: true });
await sleep(500);
check(await geometry() === before, 'presenter mode: printing leaves the slide geometry alone');
check(await page.screenshot({ encoding: 'base64' }) === shot, 'presenter mode: the screen after printing is the screen before');
checkWidth(width, mm(210 - 24), 'handout on A4 portrait, 12 mm margins');
width = await printAt({ path: `${out}/ctrl-p-handout-landscape.pdf`, format: 'A4', landscape: true,
                        preferCSSPageSize: true, printBackground: true });
checkWidth(width, mm(297 - 24), 'handout on A4 landscape, 12 mm margins');
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

// ---- 5: Firefox -------------------------------------------------------------
if (firefox) {
  const fx = await puppeteer.launch({ browser: 'firefox', executablePath: firefox, headless: true });
  const tab = await fx.newPage();
  await tab.setViewport({ width: 1280, height: 800 });
  for (const [hash, prints] of [
    ['#1', [['firefox-slides', { width: '1210px', height: '681px' }]]],
    ['#p1', [['firefox-handout-portrait', { format: 'A4' }],
             ['firefox-handout-landscape', { format: 'A4', landscape: true }]]]
  ]) {
    await tab.goto('about:blank');
    // Firefox never goes network-idle on these decks: wait for load, then settle.
    await tab.goto(url + hash, { waitUntil: 'load', timeout: 60000 });
    await sleep(4000);
    const geometryBefore = await geometry(tab);
    for (const [name, options] of prints) {
      await tab.pdf({ path: `${out}/${name}.pdf`, printBackground: true, ...options });
    }
    await sleep(500);
    check(await geometry(tab) === geometryBefore,
          `Firefox, ${hash === '#1' ? 'audience view' : 'presenter mode'}: printing leaves the slide geometry alone`);
  }
  await fx.close();
  info = pdfInfo(`${out}/firefox-slides.pdf`);
  check(info.pages === slides, `Firefox slides: ${info.pages} pages for ${slides} slides`);
} else {
  console.log('skip Firefox: no path given');
}

const pdfs = ['slides', 'slides-a4', 'handout-portrait', 'handout-landscape',
                 'firefox-slides', 'firefox-handout-portrait', 'firefox-handout-landscape']
  .filter(name => existsSync(`${out}/${name}.pdf`));
for (const name of pdfs) {
  execFileSync('pdftoppm', ['-r', '40', '-png', `${out}/${name}.pdf`, `${out}/${name}`]);
}

// ---- 6: every page has content, the handout's inside its margins ------------
let magick = true;
try { execFileSync('magick', ['-version']); } catch (e) { magick = false; }
if (magick) {
  const margin = 10 * 40 / 25.4;   // 10 mm at 40 dpi; the handout's margins are 12 mm
  for (const name of pdfs) {
    const pages = readdirSync(out).filter(f => new RegExp(`^${name}-\\d+\\.png$`).test(f)).sort();
    const blank = [];
    const outside = [];
    pages.forEach((file, i) => {
      const [w, h, sd, box] = execFileSync('magick', [`${out}/${file}`, '-format',
        '%w %h %[fx:standard_deviation] %@', 'info:']).toString().trim().split(' ');
      if (+sd === 0) { blank.push(i + 1); return; }
      const [, bw, bh, bx, by] = box.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/).map(Number);
      if (bx < margin || by < margin || bx + bw > w - margin || by + bh > h - margin) {
        outside.push(i + 1);
      }
    });
    check(blank.length === 0, `${name}: ${blank.length ? 'blank pages ' + blank.join(', ') : 'no blank page'}`);
    if (name.includes('handout')) {
      check(outside.length === 0,
            `${name}: ${outside.length ? 'content in the margin on pages ' + outside.join(', ') : 'every page inside its margins'}`);
    }
  }
} else {
  console.log('skip page checks: ImageMagick (magick) not found');
}
console.log(`PDFs and pages in ${out}/`);
process.exit(failures.length ? 1 : 0);
