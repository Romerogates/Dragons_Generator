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

/** Double-clic carrousel (centrer puis sélectionner). */
export async function pickCarouselCard(page: Page, cardId: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const card = page.locator(`[data-card-id="${cardId}"]`).first();
    if ((await card.count()) > 0 && (await card.isVisible())) {
      await card.click();
      await page.waitForTimeout(CAROUSEL_DELAY_MS);
      await card.click();
      await page.waitForTimeout(CAROUSEL_DELAY_MS);
      return;
    }
    const next = page.getByRole('button', { name: 'Carte suivante' });
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      await page.waitForTimeout(150);
    } else {
      break;
    }
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
