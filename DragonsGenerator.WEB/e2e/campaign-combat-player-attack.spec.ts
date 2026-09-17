import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
  registerConfirmAndLogin,
} from './helpers/auth';
import {
  approveCharacterAs,
  createCampaignAs,
  createCharacterAs,
  invitePlayerToCampaign,
  proposeCharacterAs,
  seedFightCombatAs,
  setSessionModeAs,
  startActiveSessionAs,
} from './helpers/campaign';

test.describe('Campagne — attaque joueur sur son tour', () => {
  test('tour joueur → Attaquer → encode → dégâts → PV', async ({ page }) => {
    test.setTimeout(150_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'AtkPj');
    const campaignId = await createCampaignAs(page, owner, `E2E PjAtk ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Héros Attaque');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    const sessionId = await startActiveSessionAs(page, owner, campaignId);
    await setSessionModeAs(page, owner, campaignId, sessionId, 'in_person');
    await seedFightCombatAs(page, owner, campaignId, {
      includePlayer: true,
      playerUserId: player.user.id,
      characterName: 'Héros Attaque',
    });

    await applyAuthSession(page, player, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    // Joueur : le combat s’affiche sans bouton Combattre (réservé MJ).
    await expect(page.getByText(/Tour de/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/c’est votre tour/i).first()).toBeVisible({
      timeout: 15_000,
    });

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
  });

  test('jet raté joueur → pas de baisse PV', async ({ page }) => {
    test.setTimeout(150_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'MissPj');
    const campaignId = await createCampaignAs(page, owner, `E2E PjMiss ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Héros Raté');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    const sessionId = await startActiveSessionAs(page, owner, campaignId);
    await setSessionModeAs(page, owner, campaignId, sessionId, 'in_person');
    await seedFightCombatAs(page, owner, campaignId, {
      includePlayer: true,
      playerUserId: player.user.id,
      characterName: 'Héros Raté',
    });

    await applyAuthSession(page, player, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Tour de/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Attaquer/i }).click();
    await page.getByRole('button', { name: /Continuer → Cible/i }).click();
    await page.getByRole('button', { name: /Gobelin/i }).click();

    const encodeInput = page.getByRole('spinbutton', { name: /Encoder un d20/i });
    await encodeInput.fill('1');
    await page.getByRole('button', { name: 'Valider' }).click();

    await expect(page.getByText(/Raté/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Gobelin/i })).toContainText('PV 7/7');
  });
});
