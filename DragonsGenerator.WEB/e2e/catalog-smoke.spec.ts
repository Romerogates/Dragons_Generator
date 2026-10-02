import { test, expect } from '@playwright/test';

/** Paths Codex navbar (hors hub /codex) — alignés sur CODEX_NAV_LINKS. */
const CODEX_CATALOGS: { path: string; heading: RegExp; rowHref: string }[] = [
  { path: '/species', heading: /Registre des/i, rowHref: '/species/' },
  { path: '/classes', heading: /Classes de/i, rowHref: '/classes/' },
  { path: '/civilisations', heading: /Atlas/i, rowHref: '/civilisations/' },
  { path: '/equipments', heading: /Arsenal/i, rowHref: '/equipments/' },
  { path: '/spells', heading: /Grimoire/i, rowHref: '/spells/' },
  { path: '/creatures', heading: /Bestiaire/i, rowHref: '/creatures/' },
  { path: '/skills', heading: /Compétences/i, rowHref: '/skills/' },
  { path: '/feats', heading: /Dons/i, rowHref: '/feats/' },
  { path: '/backgrounds', heading: /Historiques/i, rowHref: '/backgrounds/' },
  { path: '/combat-actions', heading: /Actions de combat/i, rowHref: '/combat-actions/' },
  { path: '/deities', heading: /Divinités/i, rowHref: '/deities/' },
];

test.describe('Catalogues (smoke)', () => {
  for (const catalog of CODEX_CATALOGS) {
    test(`${catalog.path} → heading + ≥1 row`, async ({ page }) => {
      await page.goto(catalog.path);
      await expect(page.getByRole('heading', { name: catalog.heading }).first()).toBeVisible({
        timeout: 45_000,
      });
      await expect(page.locator(`a[href^="${catalog.rowHref}"]`).first()).toBeVisible({
        timeout: 30_000,
      });
    });
  }

  test('species list has search', async ({ page }) => {
    await page.goto('/species');
    await expect(page.getByPlaceholder(/Rechercher une espèce/i)).toBeVisible({ timeout: 30_000 });
  });

  test('spells list has class filter', async ({ page }) => {
    await page.goto('/spells');
    await expect(page.getByRole('combobox').or(page.locator('select')).first()).toBeVisible({
      timeout: 45_000,
    });
  });
});
