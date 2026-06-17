const { chromium } = require('playwright');

async function loginAsAdmin(page) {
  await page.goto('http://localhost:4200/auth/login', { waitUntil: 'networkidle' });
  await page.fill('#admin-email', 'admin@manizales.gov.co');
  await page.fill('#admin-password', 'admin');
  await Promise.all([
    page.waitForURL('**/dashboard'),
    page.click('button:has-text("Iniciar sesión")')
  ]);
  await page.goto('http://localhost:4200/mapa', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await loginAsAdmin(page);

  const audit = await page.evaluate(() => {
    const ngApi = window.ng;
    const host = document.querySelector('app-map');
    const cmp = ngApi?.getComponent(host);
    if (!cmp) {
      return { error: 'MapComponent no disponible en runtime' };
    }

    // Force a deterministic rebuild snapshot for the audit.
    cmp.rebuildVisibleTrackingMarkers();

    const latestEntries = Array.from(cmp.latestTrackingByOfficial.values());
    const markerEntries = Array.from(cmp.officialMarkers.entries());
    const panelItems = cmp.getRealtimePanelItems();
    const searchQuery = (cmp.officialRealtimeSearch ?? '').trim().toLowerCase();

    const mapDump = markerEntries.map(([officialId, marker]) => {
      const tracking = cmp.latestTrackingByOfficial.get(officialId);
      const official = cmp.officialsById.get(officialId);
      const state = tracking ? cmp.resolveOfficialConnectionState(tracking) : 'MISSING_TRACKING';
      const latLng = marker.getLatLng();
      return {
        officialId,
        displayName: cmp.getOfficialDisplayName(officialId),
        connectionStateResolved: state,
        gps_active: tracking?.gps_active ?? null,
        hasCoords: Boolean(tracking && Number.isFinite(tracking.latitude) && Number.isFinite(tracking.longitude)),
        status: official?.status ?? null,
        markerExists: true,
        markerType: 'official',
        lat: Number.isFinite(latLng?.lat) ? Number(latLng.lat.toFixed(6)) : null,
        lng: Number.isFinite(latLng?.lng) ? Number(latLng.lng.toFixed(6)) : null
      };
    });

    const mapSummary = {
      totalMarkers: mapDump.length,
      online: mapDump.filter((m) => m.connectionStateResolved === 'ONLINE').length,
      offline: mapDump.filter((m) => m.connectionStateResolved === 'OFFLINE').length,
      lastKnown: mapDump.filter((m) => m.connectionStateResolved === 'LAST_KNOWN_POSITION').length,
      nonConnected: mapDump.filter((m) => m.connectionStateResolved !== 'ONLINE').length
    };

    const panelIdSet = new Set(panelItems.map((item) => item.id_official));
    const panelDump = latestEntries.map((tracking) => {
      const officialId = tracking.id_official;
      const state = cmp.resolveOfficialConnectionState(tracking);
      const entityId = tracking.id_entity ?? cmp.officialsById.get(officialId)?.id_entity ?? null;
      const visibleByFilter = cmp.isOfficialVisibleForFilters(officialId, entityId);
      const knownOfficial = cmp.officialsById.get(officialId);
      const activeStatus = !knownOfficial || cmp.isOfficialStatusActive(knownOfficial.status);
      const realtimeEnabled = Boolean(cmp.showRealtimeOfficials);
      const matchesSearch = !searchQuery || cmp.getOfficialDisplayName(officialId).toLowerCase().includes(searchQuery);
      const shouldRender = realtimeEnabled && activeStatus && visibleByFilter;
      const includedInPanel = panelIdSet.has(officialId);
      let excludedReason = null;
      if (!includedInPanel) {
        if (!realtimeEnabled) excludedReason = 'showRealtimeOfficials=false';
        else if (!activeStatus) excludedReason = 'official.status inactive';
        else if (!visibleByFilter) excludedReason = 'filtered by entity';
        else if (!matchesSearch) excludedReason = `filtered by search "${searchQuery}"`;
        else if (!shouldRender) excludedReason = 'failed shouldRenderOfficial';
        else excludedReason = 'not returned by getRealtimePanelItems';
      }
      return {
        officialId,
        displayName: cmp.getOfficialDisplayName(officialId),
        connectionStateResolved: state,
        panelLabel: includedInPanel ? cmp.getOfficialPanelConnectionLabel(tracking) : null,
        includedInPanel,
        excludedReason
      };
    });

    const panelSummary = {
      total: panelItems.length,
      online: panelItems.filter((item) => cmp.resolveOfficialConnectionState(item) === 'ONLINE').length,
      offline: panelItems.filter((item) => cmp.resolveOfficialConnectionState(item) === 'OFFLINE').length,
      lastKnown: panelItems.filter((item) => cmp.resolveOfficialConnectionState(item) === 'LAST_KNOWN_POSITION').length,
      nonConnected: panelItems.filter((item) => cmp.resolveOfficialConnectionState(item) !== 'ONLINE').length
    };

    const mapIds = mapDump.map((m) => m.officialId);
    const panelIds = panelItems.map((p) => p.id_official);
    const mapIdSet = new Set(mapIds);
    const panelIdSet2 = new Set(panelIds);

    const missingInPanel = mapDump
      .filter((m) => !panelIdSet2.has(m.officialId))
      .map((m) => ({ officialId: m.officialId, name: m.displayName, state: m.connectionStateResolved }));

    const missingInMap = panelItems
      .filter((p) => !mapIdSet.has(p.id_official))
      .map((p) => ({ officialId: p.id_official, name: cmp.getOfficialDisplayName(p.id_official), state: cmp.resolveOfficialConnectionState(p) }));

    const panelById = new Map(panelItems.map((p) => [p.id_official, p]));
    const differentState = mapDump
      .filter((m) => panelById.has(m.officialId))
      .map((m) => {
        const p = panelById.get(m.officialId);
        return {
          officialId: m.officialId,
          name: m.displayName,
          mapState: m.connectionStateResolved,
          panelState: cmp.resolveOfficialConnectionState(p),
          panelLabel: cmp.getOfficialPanelConnectionLabel(p)
        };
      })
      .filter((r) => r.mapState !== r.panelState);

    const duplicates = (ids) => {
      const count = new Map();
      for (const id of ids) count.set(id, (count.get(id) || 0) + 1);
      return Array.from(count.entries()).filter(([, c]) => c > 1).map(([id, c]) => ({ officialId: id, count: c }));
    };

    const duplicateIds = {
      map: duplicates(mapIds),
      panel: duplicates(panelIds)
    };

    return {
      mapDump,
      mapSummary,
      panelDump,
      panelSummary,
      diff: {
        mapIds,
        panelIds,
        missingInPanel,
        missingInMap,
        differentState,
        duplicateIds
      }
    };
  });

  console.log(JSON.stringify(audit, null, 2));
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
