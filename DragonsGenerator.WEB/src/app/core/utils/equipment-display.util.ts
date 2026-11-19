import { formatGameIds } from './game-id-labels';

export interface EquipmentDisplayLike {
  type: string;
  subtype: string | null;
  cost?: { v: number | null; u: string };
  wKg?: number | null;
  data?: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  WEAPON: 'Arme',
  ARMOR: 'Armure',
  TOOL: 'Outil',
  GEAR: 'Équipement',
  VEHICLE: 'Véhicule',
  MOUNT: 'Monture',
  SERVICE: 'Service',
};

const SUBTYPE_LABELS: Record<string, string> = {
  SIMPLE_MELEE: 'Courante (mêlée)',
  SIMPLE_RANGED: 'Courante (distance)',
  MARTIAL_MELEE: 'Guerre (mêlée)',
  MARTIAL_RANGED: 'Guerre (distance)',
  LIGHT: 'Légère',
  MEDIUM: 'Intermédiaire',
  HEAVY: 'Lourde',
  SHIELD: 'Bouclier',
  ARCANE_FOCUS: 'Focaliseur arcanique',
  DRUIDIC_FOCUS: 'Focaliseur druidique',
  HOLY_SYMBOL: 'Symbole sacré',
  CLOTHING: 'Vêtement',
  CONTAINER: 'Contenant',
  ANIMAL: 'Animal',
  LAND: 'Terrestre',
  WATER: 'Maritime',
  AIR: 'Aérien',
  INSTRUMENT: 'Instrument',
  GAMING_SET: 'Jeu',
  ARTISAN_TOOL: 'Outils d’artisan',
  SPECIAL_KIT: 'Trousse',
  THIEVES_TOOLS: 'Outils de voleur',
  NAVIGATION: 'Navigation',
};

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  tranchant: 'tranchant',
  perforant: 'perforant',
  contondant: 'contondant',
  feu: 'feu',
  froid: 'froid',
  foudre: 'foudre',
  acide: 'acide',
  poison: 'poison',
  necrotique: 'nécrotique',
  radiant: 'radiant',
  force: 'force',
  psychique: 'psychique',
  tonnerre: 'tonnerre',
};

function labelDamageType(raw: string): string {
  const key = raw.toLowerCase().trim();
  return DAMAGE_TYPE_LABELS[key] ?? raw;
}

/** Libellé FR lisible pour un id de résistance (`damage-feu` → "Feu"). Passe les autres chaînes telles quelles. */
export function resistanceLabel(id: string): string {
  if (!id) return id;
  const stripped = id.toLowerCase().startsWith('damage-') ? id.slice('damage-'.length) : id;
  const label = labelDamageType(stripped);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatWeaponRange(data: Record<string, unknown>): string | null {
  const throwRange = data['throw_range'] ?? data['throwRange'];
  const ammoRange = data['ammo_range'] ?? data['ammoRange'];
  if (throwRange && typeof throwRange === 'object') {
    const r = throwRange as { normal?: number; max?: number };
    if (r.normal != null) {
      return r.max != null ? `Lancer ${r.normal}/${r.max} m` : `Lancer ${r.normal} m`;
    }
  }
  if (ammoRange && typeof ammoRange === 'object') {
    const r = ammoRange as { normal?: number; max?: number };
    if (r.normal != null) {
      return r.max != null ? `Portée ${r.normal}/${r.max} m` : `Portée ${r.normal} m`;
    }
  }
  const range = data['range'];
  if (typeof range === 'string' && range.trim()) return range;
  if (typeof range === 'number') return `Portée ${range} m`;
  return null;
}

function formatDexModifier(data: Record<string, unknown>): string | null {
  const dexMod = data['dex_modifier'];
  if (dexMod === false || dexMod === 'none' || dexMod === 'aucun') return 'Dex non applicable';
  if (dexMod === true || dexMod === 'full' || dexMod === 'complet') return '+ Dex complet';
  const maxDex = data['max_dex_bonus'];
  if (maxDex != null && maxDex !== '') return `Dex max +${maxDex}`;
  if (dexMod === 'partial' || dexMod === 'partiel') return 'Dex partiel';
  return null;
}

export type EquipmentIconSource = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  subtype?: string | null;
};

function foldEqKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function eqHas(hay: string, needle: string): boolean {
  return hay.includes(needle);
}

const EQ_ASSET = (file: string) => `/assets/equipment/${file}`;

export function isEquipmentAssetIcon(icon: string): boolean {
  return icon.startsWith('/assets/');
}

/** Icône portrait d’un objet d’arsenal (nom d’abord, puis sous-type, puis type). */
export function getEquipmentIcon(source: EquipmentIconSource): string {
  const hay = foldEqKey(`${source.id ?? ''} ${source.name ?? ''} ${source.subtype ?? ''}`);
  const type = (source.type ?? '').toUpperCase();
  const subtype = (source.subtype ?? '').toUpperCase();

  if (type === 'ARMOR' || eqHas(hay, 'armure') || eqHas(hay, 'bouclier') || hay.startsWith('ar-')) {
    if (eqHas(hay, 'bois') && eqHas(hay, 'bouclier')) return EQ_ASSET('buckler.png');
    if (eqHas(hay, 'bouclier')) return EQ_ASSET('shield.png');
    if (eqHas(hay, 'matelas')) return EQ_ASSET('cloth.png');
    if (eqHas(hay, 'cuirasse')) return EQ_ASSET('plate.png');
    if (eqHas(hay, 'cloute') || eqHas(hay, 'peau') || eqHas(hay, 'cuir')) {
      return EQ_ASSET('leather.png');
    }
    if (eqHas(hay, 'ecaille')) return EQ_ASSET('mail.png');
    if (
      eqHas(hay, 'maille') ||
      eqHas(hay, 'cotte') ||
      eqHas(hay, 'broigne') ||
      eqHas(hay, 'chemise')
    ) {
      return EQ_ASSET('mail.png');
    }
    if (eqHas(hay, 'plaque') || eqHas(hay, 'harnois') || eqHas(hay, 'clibanion')) {
      return EQ_ASSET('plate.png');
    }
    if (subtype === 'SHIELD') return EQ_ASSET('shield.png');
    if (subtype === 'LIGHT') return EQ_ASSET('leather.png');
    if (subtype === 'MEDIUM') return EQ_ASSET('mail.png');
    if (subtype === 'HEAVY') return EQ_ASSET('plate.png');
    return EQ_ASSET('shield.png');
  }

  if (type === 'WEAPON' || hay.startsWith('wp-')) {
    if (eqHas(hay, 'arc long')) return EQ_ASSET('longbow.png');
    if (eqHas(hay, 'arc court')) return EQ_ASSET('shortbow.png');
    if (eqHas(hay, 'fronde')) return EQ_ASSET('slingshot.png');
    if (eqHas(hay, 'grande hache') || eqHas(hay, 'hallebarde')) return EQ_ASSET('battle-axe.png');
    if (eqHas(hay, 'hachette')) return EQ_ASSET('hand-axe.png');
    if (eqHas(hay, 'hache')) return EQ_ASSET('infantry-axe.png');
    if (eqHas(hay, 'marteau de guerre')) return EQ_ASSET('war-hammer.png');
    if (eqHas(hay, 'maillet')) return EQ_ASSET('maul.png');
    if (eqHas(hay, 'marteau')) return EQ_ASSET('smith-hammer.png');
    if (eqHas(hay, 'masse') || eqHas(hay, 'morgenstern') || eqHas(hay, 'fleau')) {
      return EQ_ASSET('mace.png');
    }
    if (eqHas(hay, 'massue') || eqHas(hay, 'gourdin')) return EQ_ASSET('club.png');
    if (eqHas(hay, 'dague')) return EQ_ASSET('dagger.png');
    if (eqHas(hay, 'rapiere') || eqHas(hay, 'cimeterre') || eqHas(hay, 'epee courte')) {
      return EQ_ASSET('shortsword.png');
    }
    if (eqHas(hay, 'deux mains')) return EQ_ASSET('zweihander.png');
    if (eqHas(hay, 'epee')) return EQ_ASSET('longsword.png');
    if (eqHas(hay, 'baton')) return EQ_ASSET('staff.png');
    if (eqHas(hay, 'arbalete')) return EQ_ASSET('longbow.png');
    if (eqHas(hay, 'ceste')) return EQ_ASSET('cestus.png');
    if (eqHas(hay, 'filet')) return EQ_ASSET('net.png');
    if (eqHas(hay, 'fouet')) return EQ_ASSET('whip.png');
    if (eqHas(hay, 'flechette')) return EQ_ASSET('dagger.png');
    if (eqHas(hay, 'sarbacane')) return EQ_ASSET('wand.png');
    if (eqHas(hay, 'propulseur')) return EQ_ASSET('wand.png');
    if (eqHas(hay, 'trident') || eqHas(hay, 'javeline') || eqHas(hay, 'pique') || eqHas(hay, 'lance')) {
      return EQ_ASSET('staff.png');
    }
    if (eqHas(hay, 'guisarme')) return EQ_ASSET('battle-axe.png');
    if (eqHas(hay, 'serpe')) return EQ_ASSET('hand-axe.png');
    if (eqHas(hay, 'pic')) return EQ_ASSET('war-hammer.png');
    if (subtype.includes('RANGED')) return EQ_ASSET('shortbow.png');
    return EQ_ASSET('longsword.png');
  }

  if (type === 'MOUNT') {
    if (eqHas(hay, 'elephant')) return EQ_ASSET('mnt-elephant.png');
    if (eqHas(hay, 'chameau')) return EQ_ASSET('mnt-camel.png');
    if (eqHas(hay, 'molosse')) return EQ_ASSET('mnt-dog.png');
    if (eqHas(hay, 'ane') || eqHas(hay, 'mule')) return EQ_ASSET('mnt-donkey.png');
    return EQ_ASSET('mnt-horse.png');
  }
  if (type === 'VEHICLE') {
    if (
      subtype === 'WATER' ||
      eqHas(hay, 'bateau') ||
      eqHas(hay, 'barque') ||
      eqHas(hay, 'barge') ||
      eqHas(hay, 'navire') ||
      eqHas(hay, 'drakkar') ||
      eqHas(hay, 'galere') ||
      eqHas(hay, 'voilier')
    ) {
      return EQ_ASSET('vhc-ship.png');
    }
    if (subtype === 'AIR' || eqHas(hay, 'boursouffleuse') || eqHas(hay, 'nefelytre')) {
      return EQ_ASSET('vhc-air.png');
    }
    if (eqHas(hay, 'traineau')) return EQ_ASSET('vhc-sled.png');
    return EQ_ASSET('vhc-cart.png');
  }
  if (type === 'TOOL') {
    if (eqHas(hay, 'alchimiste') || eqHas(hay, 'empoisonneur')) return EQ_ASSET('tl-alembic.png');
    if (eqHas(hay, 'herboristerie')) return EQ_ASSET('adv-hay.png');
    if (eqHas(hay, 'brasseur')) return EQ_ASSET('sv-tankard.png');
    if (eqHas(hay, 'calligraphe') || eqHas(hay, 'faussaire')) return EQ_ASSET('adv-quill.png');
    if (eqHas(hay, 'cartographe') || eqHas(hay, 'navigation')) return EQ_ASSET('adv-letter.png');
    if (eqHas(hay, 'deguisement')) return EQ_ASSET('clothes.png');
    if (eqHas(hay, 'peintre')) return EQ_ASSET('tl-toolbox.png');
    if (eqHas(hay, 'bijoutier')) return EQ_ASSET('adv-amulet.png');
    if (eqHas(hay, 'cordonnier')) return EQ_ASSET('leather.png');
    if (eqHas(hay, 'ferme')) return EQ_ASSET('adv-hay.png');
    if (eqHas(hay, 'macon')) return EQ_ASSET('tl-toolbox.png');
    if (eqHas(hay, 'menuisier') || eqHas(hay, 'sculpteur')) return EQ_ASSET('tl-toolbox.png');
    if (eqHas(hay, 'potier') || eqHas(hay, 'verrier')) return EQ_ASSET('adv-bottle.png');
    if (eqHas(hay, 'retameur')) return EQ_ASSET('tl-toolbox.png');
    if (eqHas(hay, 'tanneur')) return EQ_ASSET('leather.png');
    if (eqHas(hay, 'tisserand')) return EQ_ASSET('clothes.png');
    if (eqHas(hay, 'cuisinier')) return EQ_ASSET('adv-rations.png');
    if (eqHas(hay, 'voleur')) return EQ_ASSET('tl-key.png');
    if (eqHas(hay, 'forgeron') || eqHas(hay, 'marteau')) return EQ_ASSET('smith-hammer.png');
    if (
      eqHas(hay, 'tambour') ||
      eqHas(hay, 'flute') ||
      eqHas(hay, 'cornemuse') ||
      eqHas(hay, 'viole') ||
      eqHas(hay, 'lyre') ||
      eqHas(hay, 'dulcimer') ||
      eqHas(hay, 'luth') ||
      eqHas(hay, 'bombarde') ||
      eqHas(hay, 'cor') ||
      subtype === 'INSTRUMENT'
    ) {
      return EQ_ASSET('tl-lute.png');
    }
    if (
      eqHas(hay, 'cartes') ||
      eqHas(hay, 'echecs') ||
      hay === 'go' ||
      hay.includes(' go') ||
      subtype === 'GAMING_SET' ||
      eqHas(hay, 'jeu') ||
      eqHas(hay, 'osselets') ||
      hay === 'des' ||
      hay.startsWith('des ') ||
      hay.includes(' des')
    ) {
      return EQ_ASSET('tl-dice.png');
    }
    if (subtype === 'ARTISAN_TOOL' || subtype === 'SPECIAL_KIT' || subtype === 'THIEVES_TOOLS') {
      return EQ_ASSET('tl-toolbox.png');
    }
    return EQ_ASSET('tl-toolbox.png');
  }
  if (type === 'GEAR') {
    if (eqHas(hay, 'billes')) return EQ_ASSET('adv-marbles.png');
    if (eqHas(hay, 'belier')) return EQ_ASSET('adv-ram.png');
    if (eqHas(hay, 'barde')) return EQ_ASSET('leather.png');
    if (
      eqHas(hay, 'grimoire') ||
      eqHas(hay, 'livre') ||
      eqHas(hay, 'parchemin') ||
      eqHas(hay, 'carnet')
    ) {
      return EQ_ASSET('book.png');
    }
    if (eqHas(hay, 'liturgique')) return EQ_ASSET('robes.png');
    if (eqHas(hay, 'vetement') || eqHas(hay, 'costume')) return EQ_ASSET('clothes.png');
    if (eqHas(hay, 'baguette')) return EQ_ASSET('wand.png');
    if (eqHas(hay, 'sceptre') || eqHas(hay, 'rod')) return EQ_ASSET('rod.png');
    if (eqHas(hay, 'encens')) return EQ_ASSET('adv-incense.png');
    if (eqHas(hay, 'moulin')) return EQ_ASSET('adv-prayer.png');
    if (eqHas(hay, 'baton') || eqHas(hay, 'totem') || eqHas(hay, 'branche')) {
      return EQ_ASSET('staff.png');
    }
    if (eqHas(hay, 'cristal') || eqHas(hay, 'orbe')) return EQ_ASSET('adv-orb.png');
    if (
      eqHas(hay, 'potion') ||
      eqHas(hay, 'acide') ||
      eqHas(hay, 'gregeois') ||
      eqHas(hay, 'eau benite') ||
      eqHas(hay, 'huile') ||
      eqHas(hay, 'fiole') ||
      eqHas(hay, 'flasque')
    ) {
      return EQ_ASSET('adv-vial.png');
    }
    if (eqHas(hay, 'torche')) return EQ_ASSET('adv-torch.png');
    if (eqHas(hay, 'lampe') || eqHas(hay, 'lanterne')) return EQ_ASSET('adv-lantern.png');
    if (eqHas(hay, 'bougie')) return EQ_ASSET('adv-candle.png');
    if (
      eqHas(hay, 'amulette') ||
      eqHas(hay, 'symbole') ||
      eqHas(hay, 'reliquaire') ||
      eqHas(hay, 'embleme') ||
      eqHas(hay, 'grigris')
    ) {
      return EQ_ASSET('adv-amulet.png');
    }
    if (eqHas(hay, 'fleche') || eqHas(hay, 'carreau') || eqHas(hay, 'carquois')) {
      return EQ_ASSET('adv-quiver.png');
    }
    if (eqHas(hay, 'peche')) return EQ_ASSET('adv-fishing.png');
    if (eqHas(hay, 'barre a mine') || eqHas(hay, 'piton')) return EQ_ASSET('adv-pick.png');
    if (eqHas(hay, 'pied-de-biche')) return EQ_ASSET('adv-crowbar.png');
    if (eqHas(hay, 'marteau')) return EQ_ASSET('smith-hammer.png');
    if (eqHas(hay, 'menottes')) return EQ_ASSET('adv-shackles.png');
    if (eqHas(hay, 'cadenas')) return EQ_ASSET('adv-lock.png');
    if (eqHas(hay, 'chaine')) return EQ_ASSET('adv-chain.png');
    if (eqHas(hay, 'corde') || eqHas(hay, 'ficelle')) return EQ_ASSET('adv-rope.png');
    if (eqHas(hay, 'clochette')) return EQ_ASSET('adv-bell.png');
    if (eqHas(hay, 'chausse-trappe')) return EQ_ASSET('adv-caltrops.png');
    if (eqHas(hay, 'piege')) return EQ_ASSET('adv-trap.png');
    if (eqHas(hay, 'grappin')) return EQ_ASSET('adv-hook.png');
    if (eqHas(hay, 'palan')) return EQ_ASSET('adv-pulley.png');
    if (eqHas(hay, 'echelle') || eqHas(hay, 'escalade')) return EQ_ASSET('adv-ladder.png');
    if (eqHas(hay, 'tente')) return EQ_ASSET('adv-tent.png');
    if (eqHas(hay, 'couchage') || eqHas(hay, 'couverture')) return EQ_ASSET('adv-bedroll.png');
    if (eqHas(hay, 'selle') || eqHas(hay, 'mors') || eqHas(hay, 'bride')) {
      return EQ_ASSET('adv-saddle.png');
    }
    if (eqHas(hay, 'fourrage')) return EQ_ASSET('adv-hay.png');
    if (eqHas(hay, 'rations') || eqHas(hay, 'gamelle')) return EQ_ASSET('adv-rations.png');
    if (eqHas(hay, 'savon')) return EQ_ASSET('adv-soap.png');
    if (eqHas(hay, 'craie')) return EQ_ASSET('adv-chalk.png');
    if (eqHas(hay, 'encre') || eqHas(hay, 'plume')) return EQ_ASSET('adv-quill.png');
    if (eqHas(hay, 'bouteille')) return EQ_ASSET('adv-bottle.png');
    if (eqHas(hay, 'outre')) return EQ_ASSET('adv-waterskin.png');
    if (eqHas(hay, 'necessaire a feu')) return EQ_ASSET('adv-tinder.png');
    if (eqHas(hay, 'trousse') || eqHas(hay, 'guerisseur')) return EQ_ASSET('adv-kit.png');
    if (
      eqHas(hay, 'sauf-conduit') ||
      eqHas(hay, 'lettre') ||
      eqHas(hay, 'papier') ||
      eqHas(hay, 'recommandation')
    ) {
      return EQ_ASSET('adv-letter.png');
    }
    if (eqHas(hay, 'souvenir')) return EQ_ASSET('adv-trinket.png');
    if (eqHas(hay, 'etui')) return EQ_ASSET('adv-letter.png');
    if (eqHas(hay, 'coffre')) return EQ_ASSET('adv-chest.png');
    if (
      subtype === 'CONTAINER' ||
      eqHas(hay, 'sac') ||
      eqHas(hay, 'sacoche') ||
      eqHas(hay, 'fonte')
    ) {
      return EQ_ASSET('adv-backpack.png');
    }
    return EQ_ASSET('adv-backpack.png');
  }
  if (type === 'SERVICE') {
    if (eqHas(hay, 'repas') || eqHas(hay, 'vin')) return EQ_ASSET('sv-tankard.png');
    if (eqHas(hay, 'ecurie')) return EQ_ASSET('mnt-horse.png');
    return EQ_ASSET('sv-bed.png');
  }

  return EQ_ASSET('adv-backpack.png');
}

/** Portrait de tuile pour une catégorie d’arsenal. */
export function getEquipmentCategoryIcon(type: string): string {
  switch ((type ?? '').toUpperCase()) {
    case 'WEAPON':
      return EQ_ASSET('cat-weapon.png');
    case 'ARMOR':
      return EQ_ASSET('cat-armor.png');
    case 'MOUNT':
      return EQ_ASSET('cat-mount.png');
    case 'VEHICLE':
      return EQ_ASSET('cat-vehicle.png');
    case 'TOOL':
      return EQ_ASSET('cat-tool.png');
    case 'GEAR':
      return EQ_ASSET('cat-gear.png');
    case 'SERVICE':
      return EQ_ASSET('cat-service.png');
    default:
      return EQ_ASSET('adv-backpack.png');
  }
}

export function equipmentTypeLabel(type: string): string {
  return TYPE_LABELS[type?.toUpperCase()] ?? type;
}

export function equipmentSubtypeLabel(subtype: string | null): string {
  if (!subtype) return '';
  const key = subtype.replace(/-/g, '_').toUpperCase();
  return SUBTYPE_LABELS[key] ?? subtype;
}

export function equipmentDescription(eq: EquipmentDisplayLike): string | null {
  const desc = eq.data?.['desc'] ?? eq.data?.['description'];
  return typeof desc === 'string' && desc.trim() ? desc.trim() : null;
}

/** Texte court pour les cartes d’arsenal (description JSON, sans répéter le sous-type). */
export function equipmentCardBlurb(eq: EquipmentDisplayLike, maxLen = 160): string | null {
  const raw = equipmentDescription(eq);
  if (!raw) return null;
  if (raw.length <= maxLen) return raw;
  const cut = raw.slice(0, maxLen);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 80 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** Ligne compacte pour boutons / listes du wizard. */
export function equipmentSummaryText(eq: EquipmentDisplayLike): string {
  const data = eq.data ?? {};
  const parts: string[] = [];

  const sub = equipmentSubtypeLabel(eq.subtype);
  if (sub) parts.push(sub);

  if (eq.type === 'WEAPON') {
    const dmg = data['dmg_d'] ?? data['damage_dice'];
    const dmgType = data['dmg_t'] ?? data['damage_type'];
    if (dmg) {
      parts.push(`${dmg}${dmgType ? ' ' + labelDamageType(String(dmgType)) : ''}`);
    }
    const props = data['props'] ?? data['properties'];
    if (Array.isArray(props) && props.length) {
      parts.push(formatGameIds(props as string[], ', '));
    }
    const range = formatWeaponRange(data);
    if (range) parts.push(range);
    const strReq = data['str_req'] ?? data['str_required'];
    if (strReq) parts.push(`For ${strReq}`);
  } else if (eq.type === 'ARMOR') {
    const ac = data['ac'] ?? data['ac_base'];
    if (ac != null) parts.push(`CA ${ac}`);
    const dexLabel = formatDexModifier(data);
    if (dexLabel) parts.push(dexLabel);
    if (data['stealth_dis'] || data['stealth_disadvantage']) {
      parts.push('Discrétion −');
    }
    const strReq = data['str_req'] ?? data['str_required'];
    if (strReq) parts.push(`For ${strReq}`);
  }

  if (eq.wKg != null) parts.push(`${eq.wKg} kg`);
  if (eq.cost?.v != null && eq.cost.u) {
    parts.push(`${eq.cost.v} ${eq.cost.u}`);
  }

  return parts.filter(Boolean).join(' · ');
}

/** Stats détaillées pour panneau / carte étendue. */
export function equipmentStatLines(eq: EquipmentDisplayLike): string[] {
  const summary = equipmentSummaryText(eq);
  const lines = summary ? [summary] : [];
  const desc = equipmentDescription(eq);
  if (desc) lines.push(desc);
  return lines;
}
