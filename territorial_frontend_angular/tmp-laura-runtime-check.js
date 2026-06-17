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
  await page.waitForTimeout(4000);

  const out = await page.evaluate(() => {
    const cmp = window.ng?.getComponent(document.querySelector('app-map'));
    if (!cmp) return { error: 'MapComponent unavailable' };

    const lauraEntry = Array.from(cmp.latestTrackingByOfficial.values())
      .find((t) => (cmp.getOfficialDisplayName(t.id_official) || '').toLowerCase().includes('laura'));

    if (!lauraEntry) return { error: 'No se encontró Laura en latestTrackingByOfficial' };

    const id = lauraEntry.id_official;
    const marker = cmp.officialMarkers.get(id) ?? null;
    const markerHtml = marker?.options?.icon && 'options' in marker.options.icon
      ? String(marker.options.icon.options?.html ?? '').toLowerCase()
      : '';
    const markerState = markerHtml.includes('#22c55e')
      ? 'ONLINE'
      : markerHtml.includes('#2563eb')
        ? 'LAST_KNOWN_POSITION'
        : markerHtml.includes('#94a3b8')
          ? 'OFFLINE'
          : 'UNKNOWN';

    const popupContent = marker?.getPopup?.()?.getContent?.() ?? null;
    const panelState = cmp.getOfficialConnectionStateForUi(id);
    const panelLabelComputed = cmp.getOfficialPanelConnectionLabel(lauraEntry);
    const panelLauraItem = cmp.getRealtimePanelItems().find((item) => item.id_official === id) ?? null;
    const panelLabelFromPanelItem = panelLauraItem ? cmp.getOfficialPanelConnectionLabel(panelLauraItem) : null;

    const domRows = Array.from(document.querySelectorAll('.rt-item'));
    const domLauraRows = domRows
      .filter((row) => (row.querySelector('.rt-item__info strong')?.textContent || '').toLowerCase().includes('laura'))
      .map((row) => ({
        name: row.querySelector('.rt-item__info strong')?.textContent?.trim() ?? null,
        label: row.querySelector('.rt-item__info small')?.textContent?.trim() ?? null,
        visible: row.getClientRects().length > 0,
        html: row.outerHTML.slice(0, 320)
      }));
    const panelLabelDom = domLauraRows[0]?.label ?? null;

    return {
      officialId: id,
      displayName: cmp.getOfficialDisplayName(id),
      gps_active: lauraEntry.gps_active ?? null,
      coords: { lat: lauraEntry.latitude, lng: lauraEntry.longitude },
      resolverState: cmp.resolveOfficialConnectionState(lauraEntry),
      markerState,
      panelState,
      panelLabelComputed,
      panelLabelFromPanelItem,
      panelLabelDom,
      domLauraRows,
      popupContent
    };
  });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
