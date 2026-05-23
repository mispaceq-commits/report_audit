#!/usr/bin/env node
/**
 * Export each HTML page in src/pages/ to PDF and high-DPI PNG.
 * Output goes to dist/. PDFs open natively in Illustrator (each page as a layer),
 * PNGs are 3x DPI (288) for image fallback.
 *
 * Uses the system Chromium that's already on the Devin VM to avoid downloading a
 * second copy. Override CHROME_PATH to point at any local Chrome/Chromium binary.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'src', 'pages');
const DIST_DIR = path.join(ROOT, 'dist');

const CANDIDATE_CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/opt/.devin/playwright_browsers/chromium-1097/chrome-linux/chrome',
  '/opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome',
  '/opt/.devin/chrome/chrome/linux-133.0.6943.126/chrome-linux64/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function resolveChrome() {
  for (const p of CANDIDATE_CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'Could not find a Chromium/Chrome binary. Set CHROME_PATH env var to override.'
  );
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

  const pages = fs
    .readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.html'))
    .sort();

  if (pages.length === 0) {
    console.error('No HTML pages found in', PAGES_DIR);
    process.exit(1);
  }

  const executablePath = resolveChrome();
  console.log('Using Chrome at:', executablePath);

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  try {
    for (const file of pages) {
      const name = path.basename(file, '.html');
      const url = 'file://' + path.join(PAGES_DIR, file);
      console.log(`\n→ ${file}`);

      const page = await browser.newPage();
      // Match A4 viewport at 96 DPI: 794 x 1123 px. Use device scale 3 for crisp PNG.
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });

      // Wait for web fonts to settle.
      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });

      const pdfOut = path.join(DIST_DIR, `${name}.pdf`);
      await page.pdf({
        path: pdfOut,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      console.log('  PDF:', path.relative(ROOT, pdfOut));

      const pngOut = path.join(DIST_DIR, `${name}.png`);
      // Take a clip exactly the size of the .page-a4 element.
      const clip = await page.evaluate(() => {
        const el = document.querySelector('.page-a4');
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      await page.screenshot({
        path: pngOut,
        type: 'png',
        clip,
        omitBackground: false,
      });
      console.log('  PNG:', path.relative(ROOT, pngOut));

      await page.close();
    }
  } finally {
    await browser.close();
  }

  // Merge all per-page PDFs into a single combined PDF.
  const pdfFiles = pages
    .map((f) => path.join(DIST_DIR, path.basename(f, '.html') + '.pdf'))
    .filter((p) => fs.existsSync(p));

  if (pdfFiles.length > 1) {
    const combinedOut = path.join(DIST_DIR, 'apex-legal-website-audit.pdf');
    try {
      execFileSync('pdfunite', [...pdfFiles, combinedOut], { stdio: 'inherit' });
      console.log('\nCombined PDF:', path.relative(ROOT, combinedOut));
    } catch (e) {
      console.warn('\npdfunite failed (install poppler-utils for combined PDF):', e.message);
    }
  }

  console.log('\nDone. Files in', path.relative(ROOT, DIST_DIR));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
