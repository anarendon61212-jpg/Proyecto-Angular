const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4200/auth/login', { waitUntil: 'networkidle' });
  await page.fill('#admin-email', 'admin@manizales.gov.co');
  await page.fill('#admin-password', 'admin');
  await Promise.all([
    page.waitForURL('**/dashboard'),
    page.click('button:has-text("Iniciar sesión")')
  ]);
  await page.goto('http://localhost:4200/mapa', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);

  const result = await page.evaluate(() => {
    const cmp = window.ng?.getComponent(document.querySelector('app-map'));
    const markerIcons = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
    const officialLike = markerIcons.filter((el) => (el.textContent || '').includes('👤')).length;
    return {
      totalDomMarkerIcons: markerIcons.length,
      domMarkersWithPersonIcon: officialLike,
      officialMarkersMapSize: cmp?.officialMarkers?.size ?? null
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
