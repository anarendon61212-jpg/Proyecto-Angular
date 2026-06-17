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

  const out = await page.evaluate(() => {
    const ngApi = window.ng;
    const host = document.querySelector('app-map');
    const cmp = ngApi?.getComponent(host);
    if (!cmp) return { error: 'MapComponent no disponible' };

    const snapshot = () => {
      const mapItems = Array.from(cmp.officialMarkers.keys()).map((id) => {
        const t = cmp.latestTrackingByOfficial.get(id);
        return t ? {
          id,
          state: cmp.resolveOfficialConnectionState(t),
          label: cmp.getOfficialPanelConnectionLabel(t),
          name: cmp.getOfficialDisplayName(id)
        } : { id, state: 'MISSING', label: 'MISSING', name: cmp.getOfficialDisplayName(id) };
      });
      const panelItems = cmp.getRealtimePanelItems().map((t) => ({
        id: t.id_official,
        state: cmp.resolveOfficialConnectionState(t),
        label: cmp.getOfficialPanelConnectionLabel(t),
        name: cmp.getOfficialDisplayName(t.id_official)
      }));
      return { mapItems, panelItems };
    };

    const pre = snapshot();
    cmp.rebuildVisibleTrackingMarkers();
    const post = snapshot();

    const summarize = (data) => ({
      map: {
        total: data.mapItems.length,
        nonConnected: data.mapItems.filter((x) => x.state !== 'ONLINE').length
      },
      panel: {
        total: data.panelItems.length,
        nonConnected: data.panelItems.filter((x) => x.label === 'Sin conexión').length
      }
    });

    return {
      pre: summarize(pre),
      post: summarize(post),
      preMapOnly: pre.mapItems.filter((m) => !new Set(pre.panelItems.map((p) => p.id)).has(m.id)),
      prePanelOnly: pre.panelItems.filter((p) => !new Set(pre.mapItems.map((m) => m.id)).has(p.id)),
      postMapOnly: post.mapItems.filter((m) => !new Set(post.panelItems.map((p) => p.id)).has(m.id)),
      postPanelOnly: post.panelItems.filter((p) => !new Set(post.mapItems.map((m) => m.id)).has(p.id))
    };
  });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
