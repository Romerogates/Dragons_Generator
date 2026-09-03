import type { CreationChoice, Species, Subspecies, Trait } from '@core/models/Species/species';

/**
 * Maîtrises FIXES accordées par des traits d'espèce/sous-espèce (ex. Elfe "Sens aiguisés" →
 * Perception, Nain "Formation martiale naine" → 4 armes, Nains gardiens "Gardien" → bouclier,
 * Gnome des roches "Bricoleur" → outils de rétameur). Ce ne sont PAS des choix : elles doivent
 * s'appliquer automatiquement. Les ids d'armes/armures ne sont pas toujours préfixés dans le
 * JSON brut (`hachette` vs `ar-bouclier`) : on normalise ici.
 */
export interface SpeciesTraitBonusProficiencies {
  skills: string[];
  weapons: string[];
  armor: string[];
  tools: string[];
}

export function speciesTraitBonusProficiencies(traits: Trait[]): SpeciesTraitBonusProficiencies {
  const skills = new Set<string>();
  const weapons = new Set<string>();
  const armor = new Set<string>();
  const tools = new Set<string>();
  const prefixed = (id: string, prefix: string) => (id.startsWith(prefix) ? id : `${prefix}${id}`);

  for (const trait of traits) {
    const mech = trait.mechanics as Record<string, unknown> | undefined;
    if (!mech) continue;
    const grants = Array.isArray(mech['grants']) ? (mech['grants'] as unknown[]) : [];
    const ids = grants.filter((g): g is string => typeof g === 'string' && g.trim().length > 0);

    if (mech['type'] === 'skill_proficiency') {
      ids.forEach((id) => skills.add(id));
    } else if (mech['type'] === 'weapon_proficiency') {
      ids.forEach((id) => weapons.add(prefixed(id, 'wp-')));
    } else if (mech['type'] === 'armor_proficiency') {
      ids.forEach((id) => armor.add(prefixed(id, 'ar-')));
    }

    const toolGrant = mech['tool_proficiency_granted'];
    if (typeof toolGrant === 'string' && toolGrant.trim()) {
      tools.add(prefixed(toolGrant.trim(), 'tl-'));
    }
  }

  return { skills: [...skills], weapons: [...weapons], armor: [...armor], tools: [...tools] };
}

/** Résout le type de dégâts choisi pour une lignée/héritage draconique (Drakéide). */
export function resolveLineageDamageType(
  species: Species | null | undefined,
  sub: Subspecies | null | undefined,
  lineageOptionId: string | undefined,
): string | null {
  if (!lineageOptionId || !species) return null;
  const choice = [...(species.creationChoices ?? []), ...(sub?.creationChoices ?? [])].find(
    (c: CreationChoice) => c.id === 'choice-lignee-draconique' || c.id === 'choice-heritage-draconique',
  );
  if (!choice || !Array.isArray(choice.options)) return null;
  for (const raw of choice.options) {
    if (typeof raw !== 'object' || !raw) continue;
    const opt = raw as Record<string, unknown>;
    if (opt['id'] === lineageOptionId && typeof opt['damage_type'] === 'string') {
      return opt['damage_type'] as string;
    }
  }
  return null;
}

/** Résistances fixes accordées par des traits d'espèce/sous-espèce (résout la lignée draconique). */
export function speciesResistancesFromTraits(
  traits: Trait[],
  species: Species | null | undefined,
  sub: Subspecies | null | undefined,
  lineageOptionId: string | undefined,
): string[] {
  const res: string[] = [];
  for (const trait of traits) {
    const mech = trait.mechanics as Record<string, unknown> | undefined;
    if (!mech) continue;

    const pushMaybeLineage = (item: unknown) => {
      if (item === 'damage-from-lineage' || item === 'damage_from_lineage') {
        const dmg = resolveLineageDamageType(species, sub, lineageOptionId);
        if (dmg) res.push(dmg);
      } else if (typeof item === 'string') {
        res.push(item);
      }
    };

    if (Array.isArray(mech['damage_resistance'])) {
      (mech['damage_resistance'] as unknown[]).forEach(pushMaybeLineage);
    }
    if (Array.isArray(mech['resistances'])) {
      (mech['resistances'] as unknown[]).forEach(pushMaybeLineage);
    }
    if (mech['type'] === 'damage_resistance' && mech['damage_type_from'] === 'heritage_draconique') {
      const dmg = resolveLineageDamageType(species, sub, lineageOptionId);
      if (dmg) res.push(dmg);
    }
  }
  return [...new Set(res)];
}
