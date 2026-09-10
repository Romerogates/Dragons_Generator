import { test, expect } from '@playwright/test';
import { applyAuthSession, loginSeedSession } from './helpers/auth';
import {
  createCampaignAs,
  seedFightCombatAs,
  setSessionModeAs,
  startActiveSessionAs,
} from './helpers/campaign';

test.describe('Campagne — attaque sur le tour (MJ)', () => {
  test('Attaquer → carte cible → encode → dégâts → PV + journal', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Atk ${Date.now()}`);
    const sessionId = await startActiveSessionAs(page, owner, campaignId);
    await setSessionModeAs(page, owner, campaignId, sessionId, 'in_person');
    await seedFightCombatAs(page, owner, campaignId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /Combattre|Reprendre/i }).click();
    await expect(page.getByText(/Tour de/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Garde E2E/i).first()).toBeVisible();

    await page.getByRole('button', { name: /Attaquer/i }).click();
    await expect(page.getByText(/Choisissez l’attaque|Épée longue/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Épée longue/i }).click();
    await page.getByRole('button', { name: /Continuer → Cible/i }).click();

    await expect(page.getByText(/Cliquez une carte pour cibler/i)).toBeVisible();
    await page.getByRole('button', { name: /Gobelin/i }).click();

    await expect(page.getByText(/Jet pour toucher/i)).toBeVisible({ timeout: 10_000 });
    const encodeInput = page.getByRole('spinbutton', { name: /Encoder un d20/i });
    await expect(encodeInput).toBeVisible();
    await encodeInput.fill('18');
    await page.getByRole('button', { name: 'Valider' }).click();

    await expect(page.getByRole('button', { name: /Lancer les dégâts/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /Lancer les dégâts/i }).click();

    const goblinCard = page.getByRole('button', { name: /Gobelin/i });
    await expect(goblinCard).not.toContainText('PV 7/7', { timeout: 10_000 });
    await expect(page.getByText(/touché.*dégâts|→ \d+ dégâts/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('jet raté → pas de baisse PV, retour menu', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Miss ${Date.now()}`);
    const sessionId = await startActiveSessionAs(page, owner, campaignId);
    await setSessionModeAs(page, owner, campaignId, sessionId, 'in_person');
    await seedFightCombatAs(page, owner, campaignId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /Combattre|Reprendre/i }).click();
    await expect(page.getByText(/Tour de/i).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Attaquer/i }).click();
    await page.getByRole('button', { name: /Continuer → Cible/i }).click();
    await page.getByRole('button', { name: /Gobelin/i }).click();

    const encodeInput = page.getByRole('spinbutton', { name: /Encoder un d20/i });
    await encodeInput.fill('1');
    await page.getByRole('button', { name: 'Valider' }).click();

    await expect(page.getByText(/Raté/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Attaquer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Gobelin/i })).toContainText('PV 7/7');
  });
});
