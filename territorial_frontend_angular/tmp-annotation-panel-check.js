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

  await page.click('button:has-text("Anotaciones")');
  await page.waitForTimeout(1000);

  const markers = page.locator('.map-annotation-marker');
  const count = await markers.count();
  if (count > 0) {
    await markers.first().click();
    await page.waitForTimeout(1200);
  }

  const result = await page.evaluate(() => {
    const cmp = window.ng?.getComponent(document.querySelector('app-map'));
    return {
      annotationMarkers: document.querySelectorAll('.map-annotation-marker').length,
      selectedAnnotationDetailId: cmp?.selectedAnnotationDetail?.idAnnotation ?? null,
      detailPanelVisible: !!document.querySelector('app-annotation-detail-panel .annotation-detail')
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
