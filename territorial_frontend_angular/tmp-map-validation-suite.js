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
  await page.waitForTimeout(3000);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await loginAsAdmin(page);

  const result = await page.evaluate(async () => {
    const ngApi = window.ng;
    const host = document.querySelector('app-map');
    const cmp = ngApi?.getComponent(host);
    if (!cmp) return { error: 'MapComponent no disponible' };

    const markerStats = (() => {
      const markers = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
      let online = 0;
      let offline = 0;
      let lastKnown = 0;
      for (const marker of markers) {
        const html = marker.innerHTML || '';
        if (html.includes('background:#22c55e')) online += 1;
        else if (html.includes('background:#94a3b8')) offline += 1;
        else if (html.includes('background:#2563eb')) lastKnown += 1;
      }
      return { totalMarkers: markers.length, online, offline, lastKnown, nonConnected: offline + lastKnown };
    })();

    // PRUEBA 1
    const panelItems = cmp.getRealtimePanelItems().map((item) => ({
      id_official: item.id_official,
      name: cmp.getOfficialDisplayName(item.id_official),
      state: cmp.resolveOfficialConnectionState(item),
      panelLabel: cmp.getOfficialPanelConnectionLabel(item),
      gps_active: item.gps_active
    }));
    const panelOffline = panelItems.filter((item) => item.panelLabel === 'Sin conexión').length;

    // PRUEBA 2: merge socket vs rest
    const baseId = 999991;
    cmp.latestTrackingByOfficial.set(baseId, {
      id_official: baseId,
      id_entity: 1,
      latitude: 5.06,
      longitude: -75.51,
      lastUpdate: '2026-06-16T12:00:00.000Z',
      last_gps_update: '2026-06-16T12:00:00.000Z',
      gps_active: true
    });

    const socketUpdate = {
      id_official: baseId,
      id_entity: 1,
      latitude: 5.061,
      longitude: -75.511,
      lastUpdate: '2026-06-16T12:01:00.000Z',
      last_gps_update: '2026-06-16T12:01:00.000Z',
      gps_active: false
    };
    const afterSocket = cmp.mergeTrackingSnapshot(baseId, socketUpdate, 'socket');
    cmp.latestTrackingByOfficial.set(baseId, afterSocket);

    const restOlder = {
      id_official: baseId,
      id_entity: 1,
      latitude: 5.062,
      longitude: -75.512,
      lastUpdate: '2026-06-16T12:00:30.000Z',
      last_gps_update: '2026-06-16T12:00:30.000Z',
      gps_active: true
    };
    const afterRestOlder = cmp.mergeTrackingSnapshot(baseId, restOlder, 'rest');

    const tieRest = {
      id_official: baseId,
      id_entity: 1,
      latitude: 5.063,
      longitude: -75.513,
      lastUpdate: '2026-06-16T12:01:00.000Z',
      last_gps_update: '2026-06-16T12:01:00.000Z',
      gps_active: true
    };
    const tieSocket = {
      id_official: baseId,
      id_entity: 1,
      latitude: 5.064,
      longitude: -75.514,
      lastUpdate: '2026-06-16T12:01:00.000Z',
      last_gps_update: '2026-06-16T12:01:00.000Z',
      gps_active: false
    };
    cmp.latestTrackingByOfficial.set(baseId, afterSocket);
    const afterTieRest = cmp.mergeTrackingSnapshot(baseId, tieRest, 'rest');
    cmp.latestTrackingByOfficial.set(baseId, afterTieRest);
    const afterTieSocket = cmp.mergeTrackingSnapshot(baseId, tieSocket, 'socket');
    cmp.latestTrackingByOfficial.delete(baseId);

    const mergeLogs = [
      {
        step: 'socket newer over base',
        source: 'socket',
        currentTs: '2026-06-16T12:00:00.000Z',
        incomingTs: '2026-06-16T12:01:00.000Z',
        winner: afterSocket.gps_active === false ? 'incoming(socket)' : 'current',
        finalState: afterSocket.gps_active === true ? 'ONLINE' : 'OFFLINE/LAST_KNOWN_POSITION'
      },
      {
        step: 'rest older after socket',
        source: 'rest',
        currentTs: '2026-06-16T12:01:00.000Z',
        incomingTs: '2026-06-16T12:00:30.000Z',
        winner: afterRestOlder.gps_active === false ? 'current(socket)' : 'incoming(rest)',
        finalState: afterRestOlder.gps_active === true ? 'ONLINE' : 'OFFLINE/LAST_KNOWN_POSITION'
      },
      {
        step: 'timestamp tie with socket priority',
        source: 'socket',
        currentTs: '2026-06-16T12:01:00.000Z',
        incomingTs: '2026-06-16T12:01:00.000Z',
        winner: afterTieSocket.gps_active === false ? 'incoming(socket)' : 'current(rest)',
        finalState: afterTieSocket.gps_active === true ? 'ONLINE' : 'OFFLINE/LAST_KNOWN_POSITION'
      }
    ];

    // PRUEBA 3
    const lkpSample = {
      id_official: 700001,
      id_entity: 1,
      latitude: 5.065,
      longitude: -75.515,
      gps_active: false,
      lastUpdate: '2026-06-16T12:02:00.000Z'
    };
    const lkpState = cmp.resolveOfficialConnectionState(lkpSample);
    const lkpPanelLabel = cmp.getOfficialPanelConnectionLabel(lkpSample);
    const lkpIconHtml = cmp.buildOfficialIcon('LAST_KNOWN_POSITION').options.html;
    const lkpMapDifferentiated = lkpIconHtml.includes('#2563eb');

    // PRUEBA 4
    const inactiveId = 700002;
    cmp.officialsById.set(inactiveId, {
      id_official: inactiveId,
      id_entity: 1,
      name: 'Tmp Inactivo',
      email: 'tmp@x.com',
      role: 'Funcionario',
      status: 'inactive',
      gps_active: true
    });
    const inactiveSample = {
      id_official: inactiveId,
      id_entity: 1,
      latitude: 5.066,
      longitude: -75.516,
      gps_active: true,
      lastUpdate: '2026-06-16T12:03:00.000Z'
    };
    const inactiveState = cmp.resolveOfficialConnectionState(inactiveSample);
    const inactivePanelLabel = cmp.getOfficialPanelConnectionLabel(inactiveSample);
    cmp.officialsById.delete(inactiveId);

    // PRUEBA 5
    const markerStatsNow = () => {
      const markers = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
      let online = 0;
      let offline = 0;
      let lastKnown = 0;
      for (const marker of markers) {
        const html = marker.innerHTML || '';
        if (html.includes('background:#22c55e')) online += 1;
        else if (html.includes('background:#94a3b8')) offline += 1;
        else if (html.includes('background:#2563eb')) lastKnown += 1;
      }
      return { online, offline, lastKnown, nonConnected: offline + lastKnown };
    };

    const beforeRebuild = {
      total: cmp.getRealtimeTotalCount(),
      online: cmp.getRealtimeActiveCount(),
      offline: cmp.getRealtimeOfflineCount(),
      map: markerStatsNow()
    };
    cmp.map.setZoom(cmp.map.getZoom() + 1);
    cmp.rebuildVisibleTrackingMarkers();
    cmp.refreshRealtimePanel();
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const afterRebuild = {
      total: cmp.getRealtimeTotalCount(),
      online: cmp.getRealtimeActiveCount(),
      offline: cmp.getRealtimeOfflineCount(),
      map: markerStatsNow()
    };

    // PRUEBA 6
    const oneOffline = cmp.getRealtimePanelItems().find((item) => cmp.getOfficialPanelConnectionLabel(item) === 'Sin conexión');
    let searchValidation = null;
    if (oneOffline) {
      const query = cmp.getOfficialDisplayName(oneOffline.id_official).slice(0, 4);
      cmp.officialRealtimeSearch = query;
      const filtered = cmp.getRealtimePanelItems().map((item) => ({
        id_official: item.id_official,
        name: cmp.getOfficialDisplayName(item.id_official),
        label: cmp.getOfficialPanelConnectionLabel(item)
      }));
      searchValidation = { query, filtered };
      cmp.officialRealtimeSearch = '';
    }

    return {
      test1: {
        markerStats,
        panelOffline,
        panelItems
      },
      test2: mergeLogs,
      test3: {
        state: lkpState,
        panelLabel: lkpPanelLabel,
        mapDifferentiated: lkpMapDifferentiated
      },
      test4: {
        state: inactiveState,
        panelLabel: inactivePanelLabel
      },
      test5: {
        beforeRebuild,
        afterRebuild
      },
      test6: searchValidation
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
