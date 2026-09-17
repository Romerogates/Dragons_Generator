import { test, expect } from '@playwright/test';
import { applyAuthSession, loginSeedSession } from './helpers/auth';
import {
  createCampaignAs,
  setSessionModeAs,
  startActiveSessionAs,
} from './helpers/campaign';

/** Smoke : combat /play avec stats réelles du bestiaire Codex (assassin + gobelin). */
test.describe('Campagne — table avec créatures Codex', () => {
  test('importe Maître assassin + Guerrier gobelin, combat visible', async ({ page }) => {
    test.setTimeout(150_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Codex Table ${Date.now()}`);
    const sessionId = await startActiveSessionAs(page, owner, campaignId);
    await setSessionModeAs(page, owner, campaignId, sessionId, 'in_person');

    const assassinRes = await page.request.get('/api/creatures/cre-maitre-assassin');
    expect(assassinRes.ok()).toBeTruthy();
    const assassin = (await assassinRes.json()) as {
      name: string;
      armorClass: number;
      hitPoints: string;
      actions: Array<{ name: string; description: string }>;
    };

    const goblinRes = await page.request.get('/api/creatures/cre-guerrier-gobelin');
    expect(goblinRes.ok()).toBeTruthy();
    const goblin = (await goblinRes.json()) as {
      name: string;
      armorClass: number;
      hitPoints: string;
      actions: Array<{ name: string; description: string }>;
    };

    const parseHp = (hp: string) => {
      const m = hp.match(/^(\d+)/);
      return m ? Number(m[1]) : 10;
    };

    const getRes = await page.request.get(`/api/me/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    const campaign = (await getRes.json()) as {
      title: string;
      data: {
        activeSessionId?: string | null;
        sessions?: Array<Record<string, unknown> & { id: string }>;
        [key: string]: unknown;
      };
    };

    const allyId = `cb-ally-${Date.now()}`;
    const monsterId = `cb-gob-${Date.now()}`;
    const assassinId = `cb-ass-${Date.now()}`;

    const combatants = [
      {
        id: allyId,
        name: 'Garde E2E',
        kind: 'npc',
        armorClass: 16,
        maxHp: 20,
        currentHp: 20,
        initiativeBonus: 0,
        initiativeRoll: 18,
        attacks: [
          {
            name: 'Épée longue',
            attackBonus: 5,
            damageDice: '1d8+3',
            damageBonus: 3,
            damageType: 'tranchant',
          },
        ],
      },
      {
        id: goblin.id ? monsterId : monsterId,
        name: goblin.name,
        kind: 'monster',
        armorClass: goblin.armorClass,
        maxHp: parseHp(goblin.hitPoints),
        currentHp: parseHp(goblin.hitPoints),
        initiativeBonus: 2,
        initiativeRoll: 8,
        sourceCreatureId: 'cre-guerrier-gobelin',
        attacks: goblin.actions.slice(0, 2).map((a) => ({
          name: a.name,
          attackBonus: 4,
          damageDice: '1d6+2',
          damageBonus: 2,
          damageType: 'perforant',
        })),
      },
      {
        id: assassinId,
        name: assassin.name,
        kind: 'monster',
        armorClass: assassin.armorClass,
        maxHp: parseHp(assassin.hitPoints),
        currentHp: parseHp(assassin.hitPoints),
        initiativeBonus: 4,
        initiativeRoll: 12,
        sourceCreatureId: 'cre-maitre-assassin',
        attacks: assassin.actions
          .filter((a) => /épée|arbalète|attaque/i.test(a.name))
          .slice(0, 2)
          .map((a) => ({
            name: a.name,
            attackBonus: 8,
            damageDice: '1d6+4',
            damageBonus: 4,
            damageType: 'perforant',
          })),
      },
    ];

    const activeId = campaign.data.activeSessionId!;
    const sessions = (campaign.data.sessions ?? []).map((s) =>
      s.id === activeId
        ? {
            ...s,
            activeCombat: {
              id: `combat-codex-${Date.now()}`,
              label: 'Embuscade Codex',
              round: 1,
              turnIndex: 0,
              flowPhase: 'fight',
              collectingInitiative: false,
              combatants,
            },
          }
        : s,
    );

    const putRes = await page.request.put(`/api/me/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: {
        title: campaign.title,
        data: { ...campaign.data, sessions },
      },
    });
    expect(putRes.ok(), await putRes.text()).toBeTruthy();

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /Combattre|Reprendre/i }).click();
    await expect(page.getByText(/Tour de/i).first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(/Guerrier gobelin|Maître assassin/i).first()).toBeVisible();
    await expect(page.getByText(new RegExp(`PV ${parseHp(goblin.hitPoints)}/`))).toBeVisible();

    await page.getByRole('button', { name: /Attaquer/i }).click();
    await expect(
      page.getByText(/Épée longue|Choisissez l’attaque/i).first(),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Continuer → Cible|Cible →/i }).click();
    await page.getByRole('button', { name: /Guerrier gobelin/i }).click();

    const encodeInput = page.getByRole('spinbutton', { name: /Encoder un d20/i });
    await expect(encodeInput).toBeVisible({ timeout: 10_000 });
    await encodeInput.fill('18');
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByRole('button', { name: /Lancer les dégâts/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /Lancer les dégâts/i }).click();

    await expect(page.getByText(/touché|dégâts/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('fiche Codex → Ajouter à la table → gobelin visible en combat', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Codex Click ${Date.now()}`);
    await startActiveSessionAs(page, owner, campaignId);

    // Lie le dock + persiste l’id campagne (sessionStorage) pour le CTA Codex.
    await applyAuthSession(page, owner, `/campaigns/${campaignId}`);
    await expect(page.getByRole('button', { name: 'Session en cours' })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`/creatures/cre-guerrier-gobelin`);
    await expect(page.getByRole('heading', { name: /Guerrier gobelin/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Ajouter à la table/i }).click();
    await expect(page.getByText(/ajouté à la table/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /Combattre|Reprendre/i }).click();
    await expect(page.getByText(/Guerrier gobelin/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/PV 7\//)).toBeVisible();
  });

  test('dock survit à /play → Codex → retour (sessionStorage)', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Dock Persist ${Date.now()}`);
    await startActiveSessionAs(page, owner, campaignId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });

    const storedId = await page.evaluate(() =>
      sessionStorage.getItem('dg-active-table-campaign'),
    );
    expect(storedId).toBe(campaignId);

    await page.goto('/creatures');
    await expect(page.getByRole('heading', { name: /Bestiaire|Créatures/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    const stillStored = await page.evaluate(() =>
      sessionStorage.getItem('dg-active-table-campaign'),
    );
    expect(stillStored).toBe(campaignId);

    await page.goto(`/creatures/cre-guerrier-gobelin`);
    await expect(page.getByRole('heading', { name: /Guerrier gobelin/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Ajouter à la table/i }).click();
    await expect(page.getByText(/ajouté à la table/i)).toBeVisible({ timeout: 15_000 });
  });

  test('fiche Codex → Ajouter à une rencontre → groupe créé', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Codex Encounter ${Date.now()}`);
    await startActiveSessionAs(page, owner, campaignId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}`);
    await expect(page.getByRole('button', { name: 'Session en cours' })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`/creatures/cre-guerrier-gobelin`);
    await expect(page.getByRole('heading', { name: /Guerrier gobelin/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Ajouter à une rencontre/i }).click();
    await expect(page.getByText(/nouvelle rencontre|ajouté à/i)).toBeVisible({
      timeout: 15_000,
    });

    const getRes = await page.request.get(`/api/me/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const campaign = (await getRes.json()) as {
      data: { encounters?: Array<{ name: string; creatures: Array<{ creatureId: string }> }> };
    };
    expect(campaign.data.encounters?.length).toBeGreaterThanOrEqual(1);
    expect(
      campaign.data.encounters?.some((e) =>
        e.creatures.some((c) => c.creatureId === 'cre-guerrier-gobelin'),
      ),
    ).toBeTruthy();
  });

  test('fiche Codex → rencontre → Lancer le combat sur /play', async ({ page }) => {
    test.setTimeout(150_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Codex Launch ${Date.now()}`);
    await startActiveSessionAs(page, owner, campaignId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}`);
    await expect(page.getByRole('button', { name: 'Session en cours' })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`/creatures/cre-guerrier-gobelin`);
    await expect(page.getByRole('heading', { name: /Guerrier gobelin/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Ajouter à une rencontre/i }).click();
    await expect(page.getByText(/nouvelle rencontre|ajouté à/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(`/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });

    const encountersTab = page.getByRole('button', { name: /Rencontres|Renc\.?/i }).first();
    await expect(encountersTab).toBeVisible({ timeout: 15_000 });
    await encountersTab.click();

    await expect(page.getByRole('button', { name: /Lancer le combat/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /Lancer le combat/i }).click();

    await expect(page.getByText(/Guerrier gobelin/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/PV 7\//)).toBeVisible({ timeout: 10_000 });
  });
});
