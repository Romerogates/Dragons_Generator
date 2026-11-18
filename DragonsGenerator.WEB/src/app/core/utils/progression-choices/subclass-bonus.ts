import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import {
  PROGRESSION_MAX_LEVEL,
  type SubclassFeatureLike,
  dedupeStrings,
  dedupeSubclassFeatures,
  featureUnlockLevel,
  progressionData,
  toStringArray,
} from './shared';

export interface SubclassBonusProficiencies {
  armor: string[];
  weapons: string[];
  skills: string[];
  expertise: string[];
  tools: string[];
  /** IDs de langue (ex. lang-draconique) accordées automatiquement. */
  languages: string[];
  /** Codes courts (str/dex/con/int/wis/cha) de jets de sauvegarde accordés. */
  savingThrows: string[];
  /** Nombre de langues bonus au choix (ex. Domaine du Partage : 3). */
  bonusLanguages: number;
  /** Parmi les langues bonus, nombre devant être exotiques. */
  requiredExoticLanguages: number;
  /**
   * Compétences accordées dont le bonus de maîtrise est doublé (expertise) si le
   * personnage la possède déjà par ailleurs (sinon simple maîtrise, déjà incluse dans `skills`).
   */
  conditionalSkills: string[];
}

const EMPTY_SUBCLASS_BONUS: SubclassBonusProficiencies = {
  armor: [],
  weapons: [],
  skills: [],
  expertise: [],
  tools: [],
  languages: [],
  savingThrows: [],
  bonusLanguages: 0,
  requiredExoticLanguages: 0,
  conditionalSkills: [],
};

/**
 * Certains JSON de classe utilisent le préfixe `lang-` pour `grants_language` (ex.
 * `lang-draconique`, `lang-argot-des-voleurs`) alors que le catalogue des langues utilise
 * toujours `lg-` (ex. `lg-draconique`). Sans cette normalisation, l'id brut fuit tel quel
 * dans l'UI (étape Langues) faute de correspondance dans le catalogue.
 */
function normalizeLanguageId(id: string): string {
  return id.startsWith('lang-') ? `lg-${id.slice('lang-'.length)}` : id;
}

/**
 * Certaines features accordent une catégorie entière d'armes via un jeton abstrait
 * (`category-all-weapons`) plutôt qu'une liste d'ids concrets (ex. Magicien "Mage de guerre"
 * niv. 6 : "maîtrisez toutes les armes courantes et de guerre"). On l'étend vers les vrais ids
 * de proficience de catégorie utilisés ailleurs dans le jeu (`wp-cat-simple`/`wp-cat-martial`).
 */
function expandWeaponCategoryToken(id: string): string[] {
  if (id === 'category-all-weapons') return ['wp-cat-simple', 'wp-cat-martial'];
  return [id];
}

/**
 * Résout un octroi d'armure à palier conditionnel (ex. Magicien "Mage de guerre" : "maîtrisez
 * les armures légères, ou intermédiaires si vous maîtrisiez déjà les légères"). Forme JSON :
 * `{ condition_not_proficient: "ar-X", condition_already_Y: "ar-Z" }` — le suffixe de la clé
 * `condition_already_Y` indique le palier à vérifier (`ar-Y`) ; s'il est déjà connu, on octroie
 * la valeur associée (palier supérieur), sinon on retombe sur `condition_not_proficient`.
 */
function resolveTieredArmorGrant(
  grant: Record<string, unknown>,
  known: (armorId: string) => boolean,
): string | null {
  const alreadyEntry = Object.entries(grant).find(([k]) => k.startsWith('condition_already_'));
  if (alreadyEntry) {
    const tierWord = alreadyEntry[0].slice('condition_already_'.length);
    if (tierWord && known(`ar-${tierWord}`) && typeof alreadyEntry[1] === 'string') {
      return alreadyEntry[1];
    }
  }
  const base = grant['condition_not_proficient'];
  return typeof base === 'string' ? base : null;
}

/**
 * Proficiences/expertises/langues "fixes" accordées directement par le domaine/sous-classe choisi,
 * y compris celles nichées dans les features individuelles (grants_proficiency, grants_language,
 * languages_granted, grants_saving_throw_proficiency, bonus_languages…), en plus du bloc
 * `bonus_proficiencies` déjà présent sur certaines sous-classes.
 * Ces bonus ne sont pas des choix : ils doivent être appliqués automatiquement.
 */
export function subclassBonusProficiencies(
  cls: CharacterClass,
  subclassId?: string | null,
  level: number = PROGRESSION_MAX_LEVEL,
  /**
   * Maîtrises d'armure déjà connues avant l'application des bonus de sous-classe (classe racine +
   * espèce + historique). Nécessaire pour résoudre les octrois à palier conditionnel (ex. Magicien
   * "Mage de guerre" : légère → intermédiaire si déjà légère, niveau après niveau).
   */
  baseArmorProficiencies: string[] = [],
): SubclassBonusProficiencies {
  if (!subclassId) return EMPTY_SUBCLASS_BONUS;
  const data = progressionData(cls);
  const subs = data.subclasses as
    | {
        options?: {
          id?: string;
          bonus_proficiencies?: {
            armor?: string[];
            weapons?: string[];
            skills?: string[];
            expertise?: string[];
          };
          features?: SubclassFeatureLike[];
          features_details?: SubclassFeatureLike[];
        }[];
      }
    | undefined;
  const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
  const sub = options.find((o) => o?.id === subclassId);
  if (!sub) return EMPTY_SUBCLASS_BONUS;

  const bonus = sub.bonus_proficiencies;
  const armor = new Set(dedupeStrings(bonus?.armor));
  const weapons = new Set(dedupeStrings(bonus?.weapons));
  const skills = new Set(dedupeStrings(bonus?.skills));
  const expertise = new Set(dedupeStrings(bonus?.expertise));
  const tools = new Set<string>();
  const languages = new Set<string>();
  const savingThrows = new Set<string>();
  const conditionalSkills = new Set<string>();
  let bonusLanguages = 0;
  let requiredExoticLanguages = 0;

  const feats = dedupeSubclassFeatures(sub);
  for (const feat of feats) {
    const featLevel = featureUnlockLevel(feat as Record<string, unknown>);
    if (featLevel > level) continue;
    const mech = feat.mechanics ?? {};

    // Forme alternative "skill_proficiency_grant" avec liste de compétences FIXES (ex. Barde
    // Bateleur "Physique d'acrobate" : Acrobaties + Athlétisme, doublées si déjà maîtrisées).
    // Le pool ouvert ("pool": "any") est un CHOIX joueur, pas un octroi fixe : géré séparément
    // par `extractSubclassSkillProficiencyChoices`, ignoré ici.
    const skillGrantMech =
      mech['type'] === 'skill_proficiency_grant' && Array.isArray(mech['skills'])
        ? toStringArray(mech['skills'])
        : [];

    const grantedIds = [
      ...toStringArray(feat['grants_proficiency']),
      ...toStringArray(feat['grant_proficiency']),
      ...toStringArray(mech['grants_proficiency']),
      ...toStringArray(mech['grant_proficiency']),
      ...skillGrantMech,
    ];
    for (const id of grantedIds) {
      if (id.startsWith('tl-')) tools.add(id);
      else if (id.startsWith('ar-')) armor.add(id);
      else if (id.startsWith('wp-')) weapons.add(id);
      else skills.add(id);
    }

    // Octroi d'arme(s) par catégorie abstraite (ex. Magicien "Mage de guerre" niv. 6 :
    // "category-all-weapons" → toutes les armes courantes ET de guerre).
    for (const id of toStringArray(mech['weapons_grant'])) {
      expandWeaponCategoryToken(id).forEach((w) => weapons.add(w));
    }

    // Octroi d'armure à palier conditionnel selon ce qu'on maîtrise déjà (ex. Magicien "Mage de
    // guerre" : légère, ou intermédiaire si légère déjà maîtrisée). On résout séquentiellement
    // (les features sont dans l'ordre de niveau croissant) en tenant compte des maîtrises de base
    // ET de celles déjà accordées par une feature de sous-classe précédente dans cette boucle.
    const armorGrant = mech['armor_grant'];
    if (armorGrant && typeof armorGrant === 'object') {
      const resolved = resolveTieredArmorGrant(armorGrant as Record<string, unknown>, (id) =>
        armor.has(id) || baseArmorProficiencies.includes(id),
      );
      if (resolved) armor.add(resolved);
    }

    const upgradeRuleDoublesSkills =
      mech['type'] === 'skill_proficiency_grant' &&
      mech['upgrade_rule'] === 'if_already_proficient_double_proficiency_bonus';

    const doubleFlag =
      feat['double_prof_if_already_proficient'] ??
      mech['double_prof_if_already_proficient'] ??
      feat['expertise_if_already_proficient'] ??
      mech['expertise_if_already_proficient'] ??
      (upgradeRuleDoublesSkills ? true : undefined);
    if (doubleFlag) {
      const doubleIds =
        typeof doubleFlag === 'boolean'
          ? grantedIds
          : Array.isArray(doubleFlag)
            ? toStringArray(doubleFlag)
            : toStringArray(doubleFlag);
      for (const id of doubleIds) conditionalSkills.add(id);
    }

    for (const id of toStringArray(feat['grants_language'])) languages.add(normalizeLanguageId(id));
    for (const id of toStringArray(mech['grants_language'])) languages.add(normalizeLanguageId(id));
    for (const id of toStringArray(feat['languages_granted'])) languages.add(normalizeLanguageId(id));
    for (const id of toStringArray(mech['languages_granted'])) languages.add(normalizeLanguageId(id));

    const saveGrant = feat['grants_saving_throw_proficiency'] ?? mech['grants_saving_throw_proficiency'];
    for (const code of toStringArray(saveGrant)) savingThrows.add(code.toLowerCase());

    const bonusLangRaw = mech['bonus_languages'] ?? feat['bonus_languages'];
    if (typeof bonusLangRaw === 'number') bonusLanguages += bonusLangRaw;
    const reqExoticRaw = mech['required_exotic_count'] ?? feat['required_exotic_count'];
    if (typeof reqExoticRaw === 'number') requiredExoticLanguages += reqExoticRaw;
  }

  return {
    armor: [...armor],
    weapons: [...weapons],
    skills: [...skills],
    expertise: [...expertise],
    tools: [...tools],
    languages: [...languages],
    savingThrows: [...savingThrows],
    bonusLanguages,
    requiredExoticLanguages,
    conditionalSkills: [...conditionalSkills],
  };
}

/**
 * Résistances aux dégâts fixes/passives accordées par une feature de sous-classe
 * (ex. Druide Cercle des Esprits → résistance psychique niv. 6). Les résistances
 * conditionnelles (Rage du Barbare, tant que…) ne sont pas modélisées ici : elles restent
 * décrites sur la feature elle-même, pas sur la fiche comme un bonus permanent.
 */
export function subclassBonusResistances(
  cls: CharacterClass,
  subclassId?: string | null,
  level: number = PROGRESSION_MAX_LEVEL,
): string[] {
  if (!subclassId) return [];
  const data = progressionData(cls);
  const subs = data.subclasses as
    | { options?: { id?: string; features?: SubclassFeatureLike[]; features_details?: SubclassFeatureLike[] }[] }
    | undefined;
  const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
  const sub = options.find((o) => o?.id === subclassId);
  if (!sub) return [];

  const result = new Set<string>();
  const feats = dedupeSubclassFeatures(sub);
  for (const feat of feats) {
    const featLevel = featureUnlockLevel(feat as Record<string, unknown>);
    if (featLevel > level) continue;
    const mech = feat.mechanics ?? {};
    const raw = (mech['resistances'] ?? feat['resistances']) as unknown;
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      if (entry && typeof entry === 'object') {
        const obj = entry as { type?: string; damage_type?: string };
        if (obj.type === 'damage_type' && typeof obj.damage_type === 'string') {
          result.add(obj.damage_type.trim());
        }
      }
      // Formes string simples (ex. Rage du Barbare) volontairement ignorées : ce sont
      // des bonus conditionnels/temporaires, pas des résistances passives de fiche.
    }
  }
  return [...result];
}

export interface SubclassSkillChoicePool {
  id: string;
  label: string;
  count: number;
  poolIds: string[];
  /** Doublement (expertise) si la compétence est déjà maîtrisée par ailleurs. */
  expertiseIfAlreadyProficient: boolean;
  /**
   * `true` quand le pool JSON est ouvert (`"pool": "any"`, ex. Barde Conteurs "Maîtrises
   * supplémentaires" : 3 compétences libres). `poolIds` est alors vide : c'est à l'appelant
   * (étape Savoirs, qui a accès au catalogue complet) de proposer toutes les compétences.
   */
  isOpenPool: boolean;
}

/**
 * Choix de compétences/outils imbriqués dans une feature de sous-classe (au lieu d'être au
 * niveau racine de la sous-classe) — ex. Rôdeur Ombre urbaine, Lettré Exploration de l'âme,
 * Paladin Serment du Corbeau. Différés vers l'étape Savoirs, comme les armes/outils de classe.
 */
export function extractSubclassSkillProficiencyChoices(
  cls: CharacterClass,
  level: number,
  subclassId?: string | null,
): SubclassSkillChoicePool[] {
  if (!subclassId) return [];
  const data = progressionData(cls);
  const subs = data.subclasses as
    | { options?: { id?: string; features?: SubclassFeatureLike[]; features_details?: SubclassFeatureLike[] }[] }
    | undefined;
  const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
  const sub = options.find((o) => o?.id === subclassId);
  if (!sub) return [];

  const out: SubclassSkillChoicePool[] = [];
  const pushPool = (
    rawIds: unknown,
    quantity: number,
    poolId: string,
    label: string,
    expertiseFlag: unknown,
  ) => {
    const arr = Array.isArray(rawIds) ? rawIds : typeof rawIds === 'string' ? [rawIds] : [];
    // Pool ouvert (ex. Barde Conteurs "Maîtrises supplémentaires" : "pool": "any") : pas de liste
    // fermée à proposer, l'étape Savoirs doit alors afficher tout le catalogue de compétences.
    const isOpenPool = arr.length === 1 && arr[0] === 'any';
    const ids = isOpenPool
      ? []
      : arr.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (!isOpenPool && !ids.length) return;
    out.push({
      id: poolId,
      label,
      count: Math.max(1, quantity),
      poolIds: ids,
      isOpenPool,
      expertiseIfAlreadyProficient: !!expertiseFlag,
    });
  };

  const feats = dedupeSubclassFeatures(sub);
  for (const feat of feats) {
    const featLevel = featureUnlockLevel(feat as Record<string, unknown>);
    if (featLevel > level) continue;
    const featId = String(feat['id'] ?? 'feat');
    const mech = feat.mechanics ?? {};

    const pools = (feat['choice_pools'] as Record<string, unknown>[] | undefined) ?? [];
    for (const pool of pools) {
      const t = String(pool['type'] ?? '');
      if (t !== 'skill_proficiency' && t !== 'skill_or_tool_proficiency') continue;
      pushPool(
        pool['pool'] ?? pool['options'],
        Number(pool['quantity'] ?? 1),
        String(pool['id'] ?? `choice-skill-${featId}`),
        String(pool['name'] ?? 'Compétences au choix'),
        pool['expertise_if_already_proficient'],
      );
    }

    const singlePool = feat['choice_pool'] as Record<string, unknown> | undefined;
    if (singlePool) {
      const t = String(singlePool['type'] ?? '');
      if (t === 'skill_proficiency' || t === 'skill_or_tool_proficiency') {
        pushPool(
          singlePool['pool'] ?? singlePool['options'],
          Number(singlePool['quantity'] ?? 1),
          String(singlePool['id'] ?? `choice-skill-${featId}`),
          String(singlePool['name'] ?? 'Compétences au choix'),
          singlePool['expertise_if_already_proficient'],
        );
      }
    }

    const mechPool = mech['choice_pool'];
    if (Array.isArray(mechPool) && mechPool.every((v) => typeof v === 'string')) {
      pushPool(
        mechPool,
        1,
        `choice-skill-${featId}`,
        'Compétence au choix',
        mech['grant_type'] === 'proficiency_or_expertise',
      );
    }

    // Forme alternative "skill_proficiency_grant" avec pool OUVERT (ex. Barde Conteurs
    // "Maîtrises supplémentaires" : "pool": "any", "quantity": 3). Le pendant à liste fixe
    // (`skills: [...]`) est un octroi automatique, géré par `subclassBonusProficiencies`, pas ici.
    if (mech['type'] === 'skill_proficiency_grant' && mech['pool'] === 'any') {
      pushPool(
        mech['pool'],
        Number(mech['quantity'] ?? 1),
        `choice-skill-${featId}`,
        String(feat['name'] ?? 'Compétences au choix'),
        false,
      );
    }
  }

  return out;
}
