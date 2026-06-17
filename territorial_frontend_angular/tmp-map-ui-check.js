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
  await page.waitForTimeout(3000);

  const panelItems = await page.$$eval('.rt-item', (els) => els.map((el) => {
    const name = el.querySelector('.rt-item__info strong')?.textContent?.trim() || '';
    const label = el.querySelector('.rt-item__info small')?.textContent?.trim() || '';
    return { name, label };
  }));

  const listOffline = panelItems.filter((item) => item.label === 'Sin conexión').length;
  const listOnline = panelItems.filter((item) => item.label === 'En línea').length;

  const markerStats = await page.evaluate(() => {
    const markers = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
    let online = 0;
    let offline = 0;
    let lastKnown = 0;

    for (const marker of markers) {
      const html = marker.innerHTML || '';
      if (html.includes('background:#22c55e')) {
        online += 1;
      } else if (html.includes('background:#94a3b8')) {
        offline += 1;
      } else if (html.includes('background:#2563eb')) {
        lastKnown += 1;
      }
    }

    return {
      total: markers.length,
      online,
      offline,
      lastKnown,
      nonConnected: offline + lastKnown
    };
  });

  const componentState = await page.evaluate(() => {
    const ngApi = window.ng;
    const host = document.querySelector('app-map');
    if (!ngApi || !host) {
      return { available: false };
    }
    const cmp = ngApi.getComponent(host);
    if (!cmp) {
      return { available: false };
    }

    const visible = cmp.getRealtimePanelItems().map((item) => ({
      id_official: item.id_official,
      name: cmp.getOfficialDisplayName(item.id_official),
      gps_active: item.gps_active,
      state: cmp.resolveOfficialConnectionState(item),
      panelLabel: cmp.getOfficialPanelConnectionLabel(item),
      renderedInMap: cmp.shouldRenderOfficial(item)
    }));

    return {
      available: true,
      counts: {
        total: cmp.getRealtimeTotalCount(),
        online: cmp.getRealtimeActiveCount(),
        offline: cmp.getRealtimeOfflineCount()
      },
      visible
    };
  });

  console.log('PANEL_ITEMS=' + JSON.stringify(panelItems));
  console.log('PANEL_COUNTS=' + JSON.stringify({
    total: panelItems.length,
    online: listOnline,
    sinConexion: listOffline
  }));
  console.log('MAP_MARKERS=' + JSON.stringify(markerStats));
  console.log('COMPONENT_STATE=' + JSON.stringify(componentState));

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
