import { expect, type Page } from '@playwright/test';

const isCi = !!process.env['CI'];

/** Titres affichés sur les cartes (fallback si data-card-id absent). */
const CARD_TITLES: Record<string, string | RegExp> = {
  'sp-humain': 'Humains',
  'cls-lettre': 'Lettré',
  'cls-guerrier': 'Guerrier',
  'cls-magicien': 'Magicien',
  'cls-pretre': 'Prêtre',
  'subcls-domaine-de-la-vie': 'Vie',
  'feat-style-duel': 'Duel',
  'feat-astuce-audace': 'Audace',
  'feat-astuce-brio': 'Brio',
  'subcls-champion': 'Champion',
};

/** Vide le brouillon local et ouvre /create avec une session propre. */
export async function startFreshWizard(
  page: Page,
  opts: { level?: number } = {},
): Promise<void> {
  await page.goto('/create');
  await page.evaluate(() => {
    localStorage.removeItem('dragon_character_builder_v6');
    // Évite le dialog pré-tiré / manuel ajouté à l’entrée forge.
    localStorage.setItem('dragons-forge-skip-mode-prompt', '1');
  });
  await page.reload();
  const restart = page.getByTestId('wizard-draft-restart');
  if (await restart.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await restart.click();
    await page.getByRole('button', { name: 'Effacer et recommencer' }).click();
  }
  // Si le dialog mode apparaît quand même, choisir manuel.
  const modeManual = page.getByTestId('forge-mode-manual');
  if (await modeManual.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await modeManual.click();
  }
  // Étape 0 — Niveau : optionnel override, sinon défaut 1.
  const levelContinue = page.getByTestId('level-step-continue');
  await expect(levelContinue).toBeVisible({ timeout: 30_000 });
  const level = opts.level ?? 1;
  if (level !== 1) {
    // Role+exact : plus fiable que testid+hasText (évite collisions / builds partiels).
    await page.getByRole('button', { name: String(level), exact: true }).click();
  }
  await levelContinue.click();
  await expect(page.getByRole('heading', { name: /Choisissez votre peuple/i })).toBeVisible({
    timeout: 30_000,
  });
}

function visibleCarouselCard(page: Page, cardId: string) {
  const byId = page.locator(`[data-card-id="${cardId}"]`).filter({ visible: true });
  const title = CARD_TITLES[cardId];
  if (!title) return byId.first();
  const byTitle = page
    .getByRole('heading', { name: title, level: 3 })
    .locator('xpath=ancestor::*[contains(@class,"cursor-pointer")][1]')
    .filter({ visible: true });
  return byId.or(byTitle).first();
}

async function isCarouselCardCentered(page: Page, cardId: string): Promise<boolean> {
  const cards = page.locator(`[data-card-id="${cardId}"]`).filter({ visible: true });
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const ok = await cards.nth(i).evaluate((el) => {
      const style = getComputedStyle(el);
      if (style.pointerEvents === 'none') return false;
      return parseFloat(style.opacity) > 0.9;
    });
    if (ok) return true;
  }

  // Fallback titre (si data-card-id absent sur un vieux build).
  const title = CARD_TITLES[cardId];
  if (!title) return false;
  const byTitle = page
    .getByRole('heading', { name: title, level: 3 })
    .locator('xpath=ancestor::*[@data-wizard-flip-card][1]')
    .filter({ visible: true });
  if ((await byTitle.count()) === 0) return false;
  return byTitle.first().evaluate((el) => {
    const style = getComputedStyle(el);
    if (style.pointerEvents === 'none') return false;
    return parseFloat(style.opacity) > 0.9;
  });
}

export type PickCarouselOptions = {
  /** @deprecated Ignoré — un seul clic suffit une fois la carte centrée. */
  clickCount?: 1 | 2;
};

/**
 * Sélectionne une carte carrousel (espèce / classe).
 * Navigation uniquement via flèches : les cartes latérales (classe desktop)
 * ont `pointer-events-none` et un wrapper overflow intercepte les clics.
 */
export async function pickCarouselCard(
  page: Page,
  cardId: string,
  _options: PickCarouselOptions = {},
): Promise<void> {
  const clickTimeout = isCi ? 15_000 : 8_000;
  const settleDelay = isCi ? 450 : 350;
  const nextBtn = page.getByRole('button', { name: 'Carte suivante' }).filter({ visible: true }).first();
  const prevBtn = page
    .getByRole('button', { name: 'Carte précédente' })
    .filter({ visible: true })
    .first();

  // Attendre qu'au moins une carte du carrousel soit dans le DOM.
  await page.locator('[data-wizard-flip-card]').filter({ visible: true }).first().waitFor({
    state: 'visible',
    timeout: 20_000,
  });

  for (let attempt = 0; attempt < 80; attempt++) {
    if (await isCarouselCardCentered(page, cardId)) {
      break;
    }

    const advanced =
      (await nextBtn.isVisible().catch(() => false)) &&
      (await nextBtn.click().then(
        () => true,
        () => false,
      ));
    if (!advanced) {
      const wentBack =
        (await prevBtn.isVisible().catch(() => false)) &&
        (await prevBtn.click().then(
          () => true,
          () => false,
        ));
      if (!wentBack) break;
    }
    await page.waitForTimeout(settleDelay);
  }

  if (!(await isCarouselCardCentered(page, cardId))) {
    throw new Error(`Carte carrousel introuvable ou non centrée : ${cardId}`);
  }

  const centered = visibleCarouselCard(page, cardId);
  await centered.click({ timeout: clickTimeout });
}

export async function incrementAbility(page: Page, label: string, times: number): Promise<void> {
  const row = page.locator('.group').filter({ hasText: label }).first();
  await row.waitFor({ state: 'visible' });
  const plus = row.locator('button').filter({ hasText: '+' });
  for (let i = 0; i < times; i++) {
    await plus.click();
  }
}

export async function expectStepHeading(page: Page, text: RegExp | string): Promise<void> {
  await expect(page.getByRole('heading', { name: text })).toBeVisible({ timeout: 30_000 });
}

/** Valide l’étape Classe (bouton Forger) — plus d’auto-avance après le dernier choix carrousel. */
export async function finishClassStep(page: Page): Promise<void> {
  const forge = page.getByRole('button', { name: /^Forger cette voie$/ });
  await expect(forge).toBeVisible({ timeout: 15_000 });
  await forge.click();
}
