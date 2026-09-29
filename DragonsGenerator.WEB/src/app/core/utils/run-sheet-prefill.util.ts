import type {
  CampaignData,
  CampaignSession,
  EncounterGroup,
} from '@core/models/Campaign/campaign';

export interface RunSheetPrefill {
  objectives?: string;
  scenes?: string;
  prepChecklist?: string;
}

/**
 * Préremplit le run sheet depuis la prépa campagne (aventure, rencontres, docs).
 * N’écrase pas les champs déjà remplis sauf `overwrite`.
 */
export function prefillRunSheetFromCampaign(
  data: Pick<CampaignData, 'adventure' | 'encounters' | 'creatures' | 'handouts' | 'dungeonMaps'>,
  session: Pick<CampaignSession, 'objectives' | 'scenes' | 'prepChecklist' | 'title'>,
  opts?: { overwrite?: boolean },
): RunSheetPrefill {
  const overwrite = opts?.overwrite === true;
  const patch: RunSheetPrefill = {};

  if (overwrite || !session.objectives?.trim()) {
    const synopsis = (data.adventure ?? '').trim();
    if (synopsis) {
      const first = synopsis.split(/\n+/).map((l) => l.trim()).filter(Boolean)[0] ?? '';
      patch.objectives =
        first.length > 280 ? `${first.slice(0, 277)}…` : first || `Mener « ${session.title || 'la session'} »`;
    } else {
      patch.objectives = `Mener « ${session.title || 'la session'} »`;
    }
  }

  if (overwrite || !session.scenes?.trim()) {
    const encounters = data.encounters ?? [];
    if (encounters.length) {
      patch.scenes = encounters
        .map((e, i) => `${i + 1}) ${encounterLabel(e)}`)
        .join('\n');
    } else {
      patch.scenes = '1) Accroche\n2) Exploration\n3) Confrontation\n4) Epilogue';
    }
  }

  if (overwrite || !session.prepChecklist?.trim()) {
    const lines: string[] = [];
    const unpublished = (data.handouts ?? []).filter((h) => !h.published);
    if (unpublished.length) {
      lines.push(`Publier ${unpublished.length} document(s) : ${unpublished.map((h) => h.title || 'sans titre').join(', ')}`);
    }
    const maps = data.dungeonMaps ?? [];
    if (maps.length) {
      lines.push(`Carte(s) : ${maps.map((m) => m.name).join(', ')}`);
    }
    const creatureCount = data.creatures?.length ?? 0;
    if (creatureCount) {
      lines.push(`${creatureCount} créature(s) en prépa`);
    }
    lines.push('Ouvrir la collecte d’initiative');
    lines.push('Récap joueurs en fin de session');
    patch.prepChecklist = lines.join('\n');
  }

  return patch;
}

function encounterLabel(e: EncounterGroup): string {
  const name = e.name?.trim();
  if (name) return name;
  const n = e.creatures?.length ?? 0;
  return n ? `Rencontre (${n} créature(s))` : 'Rencontre';
}
