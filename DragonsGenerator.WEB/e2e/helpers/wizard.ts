import { expect, type Page } from '@playwright/test';

const CAROUSEL_DELAY_MS = 250;
const isCi = !!process.env['CI'];

/** Titres affichés sur les cartes (fallback si data-card-id absent). */
const CARD_TITLES: Record<string, string | RegExp> = {
  'sp-humain': 'Humains',
  'cls-lettre': 'Lettré',
  'feat-astuce-audace': 'Audace',
  'feat-astuce-brio': 'Brio',
};

/** Vide le brouillon local et ouvre /create avec une session propre. */
export async function startFreshWizard(page: Page): Promise<void> {
  await page.goto('/create');
  await page.evaluate(() => localStorage.removeItem('dragon_character_builder_v6'));
  await page.reload();
  const restart = page.getByTestId('wizard-draft-restart');
  if (await restart.isVisible().catch(() => false)) {
    await restart.click();
  }
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
  const card = visibleCarouselCard(page, cardId);
  if ((await card.count()) === 0) return false;
  return card.evaluate((el) => {
    const style = getComputedStyle(el);
    if (style.pointerEvents === 'none') return false;
    return parseFloat(style.opacity) > 0.9;
  });
}

export type PickCarouselOptions = {
  /** 2 = centrer puis sélectionner (espèce). 1 = sélection directe (classe, astuces…). */
  clickCount?: 1 | 2;
};

/** Clic(s) carrousel — centrer si besoin puis sélectionner. */
export async function pickCarouselCard(
  page: Page,
  cardId: string,
  options: PickCarouselOptions = {},
): Promise<void> {
  const clickCount = options.clickCount ?? 2;
  const carouselDelay = isCi ? 400 : CAROUSEL_DELAY_MS;
  const clickTimeout = isCi ? 15_000 : 5_000;
  const settleDelay = isCi ? 350 : 150;
  const nextBtn = page.getByRole('button', { name: 'Carte suivante' }).filter({ visible: true }).first();

  for (let attempt = 0; attempt < 50; attempt++) {
    const card = visibleCarouselCard(page, cardId);
    if ((await card.count()) === 0) {
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(settleDelay);
        continue;
      }
      break;
    }

    if (!(await isCarouselCardCentered(page, cardId))) {
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(settleDelay);
        continue;
      }
    }

    await page.waitForTimeout(settleDelay);

    for (let c = 0; c < clickCount; c++) {
      const freshCard = visibleCarouselCard(page, cardId);
      await freshCard.waitFor({ state: 'visible', timeout: clickTimeout });
      await freshCard.click({ timeout: clickTimeout });
      if (c < clickCount - 1) {
        await page.waitForTimeout(carouselDelay);
      }
    }
    return;
  }

  throw new Error(`Carte carrousel introuvable : ${cardId}`);
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
