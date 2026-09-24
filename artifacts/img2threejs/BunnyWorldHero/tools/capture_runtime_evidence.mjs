import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4177/?view=front', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__IMG2THREEJS_READY__ === true);
const evidence = await page.evaluate(() => ({
  parts: window.__BUNNY_PARTS__,
  metrics: window.__BUNNY_METRICS__,
}));
await writeFile(new URL('../evidence/parts.json', import.meta.url), JSON.stringify(evidence.parts, null, 2) + '\n');
await writeFile(new URL('../evidence/runtime-metrics.json', import.meta.url), JSON.stringify(evidence.metrics, null, 2) + '\n');
await browser.close();
