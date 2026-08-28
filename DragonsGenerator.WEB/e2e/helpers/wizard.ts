import { expect, type Page } from '@playwright/test';

const CAROUSEL_DELAY_MS = 250;

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
  // Ignore le carrousel mobile (lg:hidden) dupliqué en viewport desktop.
  return page.locator(`[data-card-id="${cardId}"]`).filter({ visible: true }).first();
}

async function isCarouselCardCentered(page: Page, cardId: string): Promise<boolean> {
  const card = visibleCarouselCard(page, cardId);
  if ((await card.count()) === 0) return false;
  return card.evaluate((el) => getComputedStyle(el).pointerEvents !== 'none');
}

/** Double-clic carrousel (centrer puis sélectionner). */
export async function pickCarouselCard(page: Page, cardId: string): Promise<void> {
  const nextBtn = page.getByRole('button', { name: 'Carte suivante' }).filter({ visible: true }).first();

  for (let attempt = 0; attempt < 50; attempt++) {
    const card = visibleCarouselCard(page, cardId);
    if ((await card.count()) === 0) {
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(150);
        continue;
      }
      break;
    }

    if (!(await isCarouselCardCentered(page, cardId))) {
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(150);
        continue;
      }
    }

    await card.click();
    await page.waitForTimeout(CAROUSEL_DELAY_MS);
    await card.click();
    await page.waitForTimeout(CAROUSEL_DELAY_MS);
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
