const { chromium } = require('playwright');

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

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

    const entries = Array.from(cmp.latestTrackingByOfficial.values()).map((t) => ({
      officialId: t.id_official,
      displayName: cmp.getOfficialDisplayName(t.id_official),
      state: cmp.resolveOfficialConnectionState(t),
      panelLabel: cmp.getOfficialPanelConnectionLabel(t)
    }));
    return { entries };
  });

  if (result.error) {
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
    return;
  }

  const groups = new Map();
  for (const row of result.entries) {
    const key = normalizeName(row.displayName);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const collisions = Array.from(groups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([nameKey, rows]) => ({
      normalizedName: nameKey,
      rows
    }));

  const fuzzy = [];
  const all = result.entries.slice();
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const a = normalizeName(all[i].displayName);
      const b = normalizeName(all[j].displayName);
      if (!a || !b) continue;
      if (a.includes(b) || b.includes(a)) {
        if (a !== b) {
          fuzzy.push({ a: all[i], b: all[j] });
        }
      }
    }
  }

  console.log(JSON.stringify({ collisions, fuzzy }, null, 2));
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
