import type { Civilisation } from '@core/models/Civilisations/civilisations';
import type { CivilizationSelection } from '@core/services/character-builder.service';

export function buildAutoCivilizationSelection(civ: Civilisation): CivilizationSelection {
  return {
    civilizationId: civ.id,
    civilizationName: civ.name,
    languages: civ.linguistics.officialLanguages.map((l) => l.label),
    writingSystems: civ.linguistics.writingSystems.map((w) => w.label),
  };
}
