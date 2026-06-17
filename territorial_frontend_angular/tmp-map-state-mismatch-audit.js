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
  await page.waitForTimeout(4500);

  const result = await page.evaluate(() => {
    const cmp = window.ng?.getComponent(document.querySelector('app-map'));
    if (!cmp) return { error: 'MapComponent no disponible' };

    const panelItems = cmp.getRealtimePanelItems();
    const panelById = new Map(panelItems.map((item) => [item.id_official, item]));

    const markerEntries = Array.from(cmp.officialMarkers.entries());
    const allOfficials = markerEntries.map(([officialId, marker]) => {
      const tracking = cmp.latestTrackingByOfficial.get(officialId);
      const panelItem = panelById.get(officialId) ?? null;
      const markerHtml = marker?.options?.icon?.options?.html ?? '';
      const mapConnectionState = (() => {
        const lower = String(markerHtml).toLowerCase();
        if (lower.includes('#22c55e')) return 'ONLINE';
        if (lower.includes('#2563eb')) return 'LAST_KNOWN_POSITION';
        if (lower.includes('#94a3b8')) return 'OFFLINE';
        return 'UNKNOWN';
      })();
      const mapMarkerType = mapConnectionState === 'ONLINE'
        ? 'dot-green'
        : mapConnectionState === 'LAST_KNOWN_POSITION'
          ? 'dot-blue'
          : mapConnectionState === 'OFFLINE'
            ? 'dot-gray'
            : 'unknown';

      const resolverInput = panelItem ?? tracking ?? null;
      const resolveResult = resolverInput ? cmp.resolveOfficialConnectionState(resolverInput) : 'MISSING';
      const panelConnectionState = panelItem ? cmp.resolveOfficialConnectionState(panelItem) : 'MISSING';
      const panelLabel = panelItem ? cmp.getOfficialPanelConnectionLabel(panelItem) : 'MISSING';

      const official = cmp.officialsById.get(officialId);
      const fromTracking = tracking ?? panelItem ?? {};
      return {
        officialId,
        displayName: cmp.getOfficialDisplayName(officialId),
        mapMarkerType,
        mapConnectionState,
        panelConnectionState,
        panelLabel,
        gps_active: fromTracking.gps_active ?? null,
        status: official?.status ?? null,
        latitude: fromTracking.latitude ?? null,
        longitude: fromTracking.longitude ?? null,
        last_gps_update: fromTracking.last_gps_update ?? null,
        lastUpdate: fromTracking.lastUpdate ?? null,
        resolveOfficialConnectionStateResult: resolveResult,
        isOnlineForMap: mapConnectionState === 'ONLINE',
        isOnlineForPanel: panelConnectionState === 'ONLINE'
      };
    });

    const stateMismatch = allOfficials
      .filter((item) =>
        (item.mapConnectionState === 'OFFLINE' || item.mapConnectionState === 'LAST_KNOWN_POSITION')
        && item.panelConnectionState === 'ONLINE'
      )
      .map((item) => ({
        officialId: item.officialId,
        name: item.displayName,
        mapState: item.mapConnectionState,
        panelState: item.panelConnectionState,
        gps_active: item.gps_active,
        reason: 'marker visual state differs from panel resolver state'
      }));

    return {
      officials: allOfficials,
      stateMismatch,
      summary: {
        totalCompared: allOfficials.length,
        mismatches: stateMismatch.length
      }
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
