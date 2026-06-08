const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:4200/auth/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@manizales.gov.co');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.goto('http://127.0.0.1:4200/mapa', { waitUntil: 'networkidle' });

  await page.waitForTimeout(3000);

  const phaseData = await page.evaluate(() => {
    const markerPane = document.querySelector('.leaflet-marker-pane');
    const markerPaneChildren = markerPane ? markerPane.children.length : 0;

    const officialNodes = Array.from(document.querySelectorAll('.map-official-marker, .map-official-marker--offline'));
    const officialClassCounts = {
      map_official_marker: document.querySelectorAll('.map-official-marker').length,
      map_official_marker_offline: document.querySelectorAll('.map-official-marker--offline').length
    };

    const firstOfficial = document.querySelector('.map-official-marker, .map-official-marker--offline');
    const firstOfficialOuterHTML = firstOfficial ? firstOfficial.outerHTML : null;
    const firstOfficialComputed = firstOfficial ? (() => {
      const cs = window.getComputedStyle(firstOfficial);
      return {
        width: cs.width,
        height: cs.height,
        opacity: cs.opacity,
        visibility: cs.visibility,
        display: cs.display,
        zIndex: cs.zIndex,
        position: cs.position,
        transform: cs.transform,
        backgroundColor: cs.backgroundColor,
        border: cs.border,
        pointerEvents: cs.pointerEvents
      };
    })() : null;

    const markerPaneHtml = markerPane ? markerPane.innerHTML : null;

    const mapEl = document.querySelector('.leaflet-container');
    const mapInstance = mapEl && mapEl._leaflet_id ? window.L && window.L.DomUtil && mapEl : mapEl;

    return {
      markerPaneChildren,
      officialClassCounts,
      firstOfficialOuterHTML,
      firstOfficialComputed,
      markerPaneHtml,
      hasOfficialNodes: officialNodes.length,
      titleText: document.title
    };
  });

  console.log(JSON.stringify(phaseData));
  await browser.close();
})();
