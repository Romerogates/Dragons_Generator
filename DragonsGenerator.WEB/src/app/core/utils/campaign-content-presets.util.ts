import {
  createCampaignHandout,
  createEncounterFromCreatures,
  createNotebookPage,
  type CampaignHandout,
  type EncounterGroup,
  type NotebookPage,
} from '@core/models/Campaign/campaign';
import type { StoryCreatureSelection } from '@core/models/Story/story';

export interface HandoutPackPreset {
  id: string;
  label: string;
  description: string;
  handouts: { title: string; kind?: CampaignHandout['kind'] }[];
}

export interface NotebookTemplatePreset {
  id: string;
  label: string;
  title: string;
  body: string;
}

export interface EncounterPackPreset {
  id: string;
  label: string;
  description: string;
  encounters: {
    name: string;
    creatures: {
      creatureId: string;
      creatureName: string;
      challengeRating?: string;
      xp?: number;
      quantity?: number;
    }[];
  }[];
}

/** Packs documents prêts à injecter dans une campagne. */
export const HANDOUT_PACK_PRESETS: HandoutPackPreset[] = [
  {
    id: 'oneshot-starter',
    label: 'Pack oneshot',
    description: 'Brief joueurs, carte, récap fin de soirée',
    handouts: [
      { title: 'Brief joueurs', kind: 'letter' },
      { title: 'Carte de la zone', kind: 'map' },
      { title: 'Récap de fin', kind: 'summary' },
    ],
  },
  {
    id: 'prep-mj',
    label: 'Pack prépa MJ',
    description: 'Run sheet, PNJs, loot',
    handouts: [
      { title: 'Run sheet', kind: 'other' },
      { title: 'PNJs clés', kind: 'other' },
      { title: 'Butin & récompenses', kind: 'other' },
    ],
  },
];

export const NOTEBOOK_TEMPLATE_PRESETS: NotebookTemplatePreset[] = [
  {
    id: 'run-sheet',
    label: 'Run sheet',
    title: 'Run sheet',
    body: '## Objectifs\n- \n\n## Scènes\n1. \n2. \n\n## Checklist\n- [ ] Init\n- [ ] Combat\n- [ ] Récap\n',
  },
  {
    id: 'pnj',
    label: 'PNJs',
    title: 'PNJs',
    body: '## Nom\nMotivation :\nSecret :\n',
  },
  {
    id: 'loot',
    label: 'Loot',
    title: 'Butin',
    body: '| Objet | Qui | Notes |\n| --- | --- | --- |\n|  |  |  |\n',
  },
];

/** Packs de rencontres prêts (refs Codex Eana). */
export const ENCOUNTER_PACK_PRESETS: EncounterPackPreset[] = [
  {
    id: 'cite-franche-streets',
    label: 'Cité Franche — rues',
    description: 'Escarmouche urbaine : bandits + gobelins',
    encounters: [
      {
        name: 'Embuscade dans la ruelle',
        creatures: [
          {
            creatureId: 'cre-baron-du-crime',
            creatureName: 'Baron du crime',
            challengeRating: '5',
            xp: 1800,
            quantity: 1,
          },
          {
            creatureId: 'cre-cavalier-gobelin',
            creatureName: 'Cavalier gobelin',
            challengeRating: '1',
            xp: 200,
            quantity: 2,
          },
        ],
      },
      {
        name: 'Patrouille des docks',
        creatures: [
          {
            creatureId: 'cre-guerrier-orc',
            creatureName: 'Guerrier orc',
            challengeRating: '1/2',
            xp: 100,
            quantity: 3,
          },
          {
            creatureId: 'cre-bandit-vampirien',
            creatureName: 'Bandit vampirien',
            challengeRating: '2',
            xp: 450,
            quantity: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'oneshot-dungeon',
    label: 'Oneshot donjon',
    description: 'Entrée + boss léger',
    encounters: [
      {
        name: 'Gardes de l’entrée',
        creatures: [
          {
            creatureId: 'cre-squelette',
            creatureName: 'Squelette',
            challengeRating: '1/4',
            xp: 50,
            quantity: 4,
          },
          {
            creatureId: 'cre-zombie',
            creatureName: 'Zombie',
            challengeRating: '1/4',
            xp: 50,
            quantity: 2,
          },
        ],
      },
      {
        name: 'Chambre du chef',
        creatures: [
          {
            creatureId: 'cre-spectre',
            creatureName: 'Spectre',
            challengeRating: '1',
            xp: 200,
            quantity: 1,
          },
          {
            creatureId: 'cre-guerrier-orc',
            creatureName: 'Guerrier orc',
            challengeRating: '1/2',
            xp: 100,
            quantity: 2,
          },
        ],
      },
    ],
  },
];

export function buildHandoutsFromPack(packId: string): CampaignHandout[] {
  const pack = HANDOUT_PACK_PRESETS.find((p) => p.id === packId);
  if (!pack) return [];
  return pack.handouts.map((h) => {
    const created = createCampaignHandout(h.title);
    return { ...created, kind: h.kind ?? created.kind, published: false };
  });
}

export function buildNotebookPageFromTemplate(templateId: string): NotebookPage | null {
  const t = NOTEBOOK_TEMPLATE_PRESETS.find((p) => p.id === templateId);
  if (!t) return null;
  const page = createNotebookPage(t.title);
  return { ...page, text: t.body };
}

export function buildEncountersFromPack(packId: string): EncounterGroup[] {
  const pack = ENCOUNTER_PACK_PRESETS.find((p) => p.id === packId);
  if (!pack) return [];
  return pack.encounters.map((enc) => {
    const selections: StoryCreatureSelection[] = enc.creatures.map((c) => ({
      creatureId: c.creatureId,
      creatureName: c.creatureName,
      category: '',
      challengeRating: c.challengeRating ?? '',
      customName: '',
      role: 'antagonist' as const,
      backstory: '',
    }));
    const xpMap: Record<string, number> = {};
    for (const c of enc.creatures) {
      xpMap[c.creatureId] = c.xp ?? 0;
    }
    const group = createEncounterFromCreatures(enc.name, selections, xpMap);
    return {
      ...group,
      creatures: group.creatures.map((gc) => {
        const src = enc.creatures.find((c) => c.creatureId === gc.creatureId);
        return src?.quantity && src.quantity > 1 ? { ...gc, quantity: src.quantity } : gc;
      }),
    };
  });
}
