import {
  equipmentCardBlurb,
  equipmentSubtypeLabel,
  getEquipmentCategoryIcon,
  getEquipmentIcon,
  resistanceLabel,
} from './equipment-display.util';

describe('getEquipmentIcon', () => {
  it('gives distinct armor portraits instead of a helmet for everything', () => {
    expect(getEquipmentIcon({ name: 'Armure de cuir', type: 'ARMOR', subtype: 'LIGHT' })).toBe(
      '/assets/equipment/leather.png',
    );
    expect(
      getEquipmentIcon({ name: 'Armure de cuir cloutée', type: 'ARMOR', subtype: 'LIGHT' }),
    ).toBe('/assets/equipment/leather.png');
    expect(getEquipmentIcon({ name: 'Cotte de mailles', type: 'ARMOR', subtype: 'HEAVY' })).toBe(
      '/assets/equipment/mail.png',
    );
    expect(getEquipmentIcon({ name: 'Armure de plaques', type: 'ARMOR', subtype: 'HEAVY' })).toBe(
      '/assets/equipment/plate.png',
    );
    expect(getEquipmentIcon({ name: 'Harnois', type: 'ARMOR', subtype: 'HEAVY' })).toBe(
      '/assets/equipment/plate.png',
    );
    expect(getEquipmentIcon({ name: 'Bouclier', type: 'ARMOR', subtype: 'SHIELD' })).toBe(
      '/assets/equipment/shield.png',
    );
    expect(getEquipmentIcon({ name: 'Bouclier de bois', type: 'ARMOR', subtype: 'SHIELD' })).toBe(
      '/assets/equipment/buckler.png',
    );
    expect(getEquipmentIcon({ name: 'Armure de peau', type: 'ARMOR', subtype: 'MEDIUM' })).toBe(
      '/assets/equipment/leather.png',
    );
    expect(getEquipmentIcon({ name: 'Cuirasse', type: 'ARMOR', subtype: 'MEDIUM' })).toBe(
      '/assets/equipment/plate.png',
    );
  });

  it('picks weapon portraits from the name', () => {
    expect(getEquipmentIcon({ name: 'Dague', type: 'WEAPON', subtype: 'SIMPLE_MELEE' })).toBe(
      '/assets/equipment/dagger.png',
    );
    expect(getEquipmentIcon({ name: 'Arc long', type: 'WEAPON', subtype: 'MARTIAL_RANGED' })).toBe(
      '/assets/equipment/longbow.png',
    );
    expect(getEquipmentIcon({ name: 'Hachette', type: 'WEAPON', subtype: 'SIMPLE_MELEE' })).toBe(
      '/assets/equipment/hand-axe.png',
    );
    expect(getEquipmentIcon({ name: 'Épée à deux mains', type: 'WEAPON', subtype: 'MARTIAL_MELEE' })).toBe(
      '/assets/equipment/zweihander.png',
    );
  });

  it('uses painted portraits only when the object matches', () => {
    expect(getEquipmentIcon({ name: 'Outils de forgeron', type: 'TOOL', subtype: 'ARTISAN_TOOL' })).toBe(
      '/assets/equipment/smith-hammer.png',
    );
    expect(getEquipmentIcon({ name: 'Grimoire', type: 'GEAR' })).toBe('/assets/equipment/book.png');
    expect(getEquipmentIcon({ name: 'Sac à dos', type: 'GEAR', subtype: 'CONTAINER' })).toBe(
      '/assets/equipment/adv-backpack.png',
    );
    expect(getEquipmentIcon({ name: 'Cor', type: 'TOOL', subtype: 'INSTRUMENT' })).toBe(
      '/assets/equipment/tl-lute.png',
    );
    expect(getEquipmentIcon({ name: 'Filet', type: 'WEAPON', subtype: 'SIMPLE_RANGED' })).toBe(
      '/assets/equipment/net.png',
    );
    expect(getEquipmentIcon({ name: 'Ceste', type: 'WEAPON', subtype: 'MARTIAL_MELEE' })).toBe(
      '/assets/equipment/cestus.png',
    );
    expect(getEquipmentIcon({ name: 'Fouet', type: 'WEAPON', subtype: 'MARTIAL_MELEE' })).toBe(
      '/assets/equipment/whip.png',
    );
    expect(getEquipmentIcon({ name: 'Javeline', type: 'WEAPON', subtype: 'SIMPLE_MELEE' })).toBe(
      '/assets/equipment/staff.png',
    );
    expect(getEquipmentIcon({ name: 'Lance', type: 'WEAPON', subtype: 'SIMPLE_MELEE' })).toBe(
      '/assets/equipment/staff.png',
    );
    expect(getEquipmentIcon({ name: 'Trident', type: 'WEAPON', subtype: 'MARTIAL_MELEE' })).toBe(
      '/assets/equipment/staff.png',
    );
    expect(getEquipmentIcon({ name: 'Sarbacane', type: 'WEAPON', subtype: 'MARTIAL_RANGED' })).toBe(
      '/assets/equipment/wand.png',
    );
    expect(getEquipmentIcon({ name: 'Propulseur', type: 'WEAPON', subtype: 'MARTIAL_RANGED' })).toBe(
      '/assets/equipment/wand.png',
    );
  });

  it('gives a matching portrait for kit items that used to be generic', () => {
    expect(getEquipmentIcon({ name: 'Billes (sac de 1000)', type: 'GEAR' })).toBe(
      '/assets/equipment/adv-marbles.png',
    );
    expect(getEquipmentIcon({ name: 'Bélier portatif', type: 'GEAR' })).toBe(
      '/assets/equipment/adv-ram.png',
    );
    expect(getEquipmentIcon({ name: 'Torche', type: 'GEAR' })).toBe('/assets/equipment/adv-torch.png');
    expect(getEquipmentIcon({ name: 'Corde en chanvre', type: 'GEAR' })).toBe(
      '/assets/equipment/adv-rope.png',
    );
    expect(getEquipmentIcon({ name: 'Piège à loups', type: 'GEAR' })).toBe(
      '/assets/equipment/adv-trap.png',
    );
    expect(getEquipmentIcon({ name: 'Barde', type: 'GEAR' })).toBe('/assets/equipment/leather.png');
    expect(getEquipmentIcon({ name: 'Outils de cordonnier', type: 'TOOL', subtype: 'ARTISAN_TOOL' })).toBe(
      '/assets/equipment/leather.png',
    );
    expect(getEquipmentIcon({ name: 'Cor', type: 'TOOL', subtype: 'INSTRUMENT' })).toBe(
      '/assets/equipment/tl-lute.png',
    );
    expect(getEquipmentIcon({ name: 'Cheval de selle', type: 'MOUNT' })).toBe(
      '/assets/equipment/mnt-horse.png',
    );
  });

  it('covers remaining armor, weapon, mount, vehicle, tool, gear and service portraits', () => {
    const cases: { name: string; type: string; subtype?: string; file: string }[] = [
      { name: 'Matelas matelassé', type: 'ARMOR', subtype: 'LIGHT', file: 'cloth.png' },
      { name: 'Armure d’écailles', type: 'ARMOR', subtype: 'MEDIUM', file: 'mail.png' },
      { name: 'Broigne', type: 'ARMOR', subtype: 'MEDIUM', file: 'mail.png' },
      { name: 'Chemise de mailles', type: 'ARMOR', subtype: 'HEAVY', file: 'mail.png' },
      { name: 'Clibanion', type: 'ARMOR', subtype: 'HEAVY', file: 'plate.png' },
      { name: 'Armure inconnue', type: 'ARMOR', file: 'shield.png' },
      { name: 'Arc court', type: 'WEAPON', subtype: 'SIMPLE_RANGED', file: 'shortbow.png' },
      { name: 'Fronde', type: 'WEAPON', subtype: 'SIMPLE_RANGED', file: 'slingshot.png' },
      { name: 'Grande hache', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'battle-axe.png' },
      { name: 'Hallebarde', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'battle-axe.png' },
      { name: 'Hache', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'infantry-axe.png' },
      { name: 'Marteau de guerre', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'war-hammer.png' },
      { name: 'Maillet', type: 'WEAPON', subtype: 'SIMPLE_MELEE', file: 'maul.png' },
      { name: 'Marteau léger', type: 'WEAPON', subtype: 'SIMPLE_MELEE', file: 'smith-hammer.png' },
      { name: 'Masse d’armes', type: 'WEAPON', subtype: 'SIMPLE_MELEE', file: 'mace.png' },
      { name: 'Morgenstern', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'mace.png' },
      { name: 'Fléau', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'mace.png' },
      { name: 'Massue', type: 'WEAPON', subtype: 'SIMPLE_MELEE', file: 'club.png' },
      { name: 'Gourdin', type: 'WEAPON', subtype: 'SIMPLE_MELEE', file: 'club.png' },
      { name: 'Rapière', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'shortsword.png' },
      { name: 'Cimeterre', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'shortsword.png' },
      { name: 'Épée courte', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'shortsword.png' },
      { name: 'Épée longue', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'longsword.png' },
      { name: 'Bâton', type: 'WEAPON', subtype: 'SIMPLE_MELEE', file: 'staff.png' },
      { name: 'Arbalète légère', type: 'WEAPON', subtype: 'SIMPLE_RANGED', file: 'longbow.png' },
      { name: 'Fléchettes', type: 'WEAPON', subtype: 'SIMPLE_RANGED', file: 'dagger.png' },
      { name: 'Guisarme', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'battle-axe.png' },
      { name: 'Serpe', type: 'WEAPON', subtype: 'SIMPLE_MELEE', file: 'hand-axe.png' },
      { name: 'Pic de guerre', type: 'WEAPON', subtype: 'MARTIAL_MELEE', file: 'war-hammer.png' },
      { name: 'Arme de jet', type: 'WEAPON', subtype: 'SIMPLE_RANGED', file: 'shortbow.png' },
      { name: 'Arme quelconque', type: 'WEAPON', file: 'longsword.png' },
      { name: 'Éléphant', type: 'MOUNT', file: 'mnt-elephant.png' },
      { name: 'Chameau', type: 'MOUNT', file: 'mnt-camel.png' },
      { name: 'Molosse', type: 'MOUNT', file: 'mnt-dog.png' },
      { name: 'Âne', type: 'MOUNT', file: 'mnt-donkey.png' },
      { name: 'Mule', type: 'MOUNT', file: 'mnt-donkey.png' },
      { name: 'Barque', type: 'VEHICLE', subtype: 'WATER', file: 'vhc-ship.png' },
      { name: 'Boursouffleuse', type: 'VEHICLE', subtype: 'AIR', file: 'vhc-air.png' },
      { name: 'Traîneau', type: 'VEHICLE', subtype: 'LAND', file: 'vhc-sled.png' },
      { name: 'Chariot', type: 'VEHICLE', subtype: 'LAND', file: 'vhc-cart.png' },
      { name: 'Outils d’alchimiste', type: 'TOOL', subtype: 'ARTISAN_TOOL', file: 'tl-alembic.png' },
      { name: 'Trousse d’herboristerie', type: 'TOOL', subtype: 'SPECIAL_KIT', file: 'adv-hay.png' },
      { name: 'Ustensiles de brasseur', type: 'TOOL', subtype: 'ARTISAN_TOOL', file: 'sv-tankard.png' },
      { name: 'Outils de calligraphe', type: 'TOOL', subtype: 'ARTISAN_TOOL', file: 'adv-quill.png' },
      { name: 'Jeu de cartes', type: 'TOOL', subtype: 'GAMING_SET', file: 'tl-dice.png' },
      { name: 'Dés', type: 'TOOL', subtype: 'GAMING_SET', file: 'tl-dice.png' },
      { name: 'Go', type: 'TOOL', subtype: 'GAMING_SET', file: 'tl-dice.png' },
      { name: 'Livre', type: 'GEAR', file: 'book.png' },
      { name: 'Habit liturgique', type: 'GEAR', file: 'robes.png' },
      { name: 'Costume', type: 'GEAR', file: 'clothes.png' },
      { name: 'Baguette', type: 'GEAR', file: 'wand.png' },
      { name: 'Sceptre', type: 'GEAR', file: 'rod.png' },
      { name: 'Encens', type: 'GEAR', file: 'adv-incense.png' },
      { name: 'Orbe', type: 'GEAR', file: 'adv-orb.png' },
      { name: 'Potion de soin', type: 'GEAR', file: 'adv-vial.png' },
      { name: 'Lanterne sourde', type: 'GEAR', file: 'adv-lantern.png' },
      { name: 'Bougie', type: 'GEAR', file: 'adv-candle.png' },
      { name: 'Amulette', type: 'GEAR', file: 'adv-amulet.png' },
      { name: 'Carquois', type: 'GEAR', file: 'adv-quiver.png' },
      { name: 'Canne à pêche', type: 'GEAR', file: 'adv-fishing.png' },
      { name: 'Piton', type: 'GEAR', file: 'adv-pick.png' },
      { name: 'Pied-de-biche', type: 'GEAR', file: 'adv-crowbar.png' },
      { name: 'Menottes', type: 'GEAR', file: 'adv-shackles.png' },
      { name: 'Cadenas', type: 'GEAR', file: 'adv-lock.png' },
      { name: 'Chaîne', type: 'GEAR', file: 'adv-chain.png' },
      { name: 'Clochette', type: 'GEAR', file: 'adv-bell.png' },
      { name: 'Chausse-trappe', type: 'GEAR', file: 'adv-caltrops.png' },
      { name: 'Grappin', type: 'GEAR', file: 'adv-hook.png' },
      { name: 'Palan', type: 'GEAR', file: 'adv-pulley.png' },
      { name: 'Échelle', type: 'GEAR', file: 'adv-ladder.png' },
      { name: 'Tente', type: 'GEAR', file: 'adv-tent.png' },
      { name: 'Couverture', type: 'GEAR', file: 'adv-bedroll.png' },
      { name: 'Selle', type: 'GEAR', file: 'adv-saddle.png' },
      { name: 'Fourrage', type: 'GEAR', file: 'adv-hay.png' },
      { name: 'Rations', type: 'GEAR', file: 'adv-rations.png' },
      { name: 'Savon', type: 'GEAR', file: 'adv-soap.png' },
      { name: 'Craie', type: 'GEAR', file: 'adv-chalk.png' },
      { name: 'Plume', type: 'GEAR', file: 'adv-quill.png' },
      { name: 'Bouteille', type: 'GEAR', file: 'adv-bottle.png' },
      { name: 'Outre', type: 'GEAR', file: 'adv-waterskin.png' },
      { name: 'Nécessaire à feu', type: 'GEAR', file: 'adv-tinder.png' },
      { name: 'Trousse de guérisseur', type: 'GEAR', file: 'adv-kit.png' },
      { name: 'Lettre de recommandation', type: 'GEAR', file: 'adv-letter.png' },
      { name: 'Souvenir', type: 'GEAR', file: 'adv-trinket.png' },
      { name: 'Coffre', type: 'GEAR', file: 'adv-chest.png' },
      { name: 'Sacoche', type: 'GEAR', file: 'adv-backpack.png' },
      { name: 'Repas', type: 'SERVICE', file: 'sv-tankard.png' },
      { name: 'Écurie', type: 'SERVICE', file: 'mnt-horse.png' },
      { name: 'Chambre', type: 'SERVICE', file: 'sv-bed.png' },
      { name: 'Objet bizarre', type: 'OTHER', file: 'adv-backpack.png' },
    ];
    for (const c of cases) {
      expect(getEquipmentIcon({ name: c.name, type: c.type, subtype: c.subtype }))
        .withContext(c.name)
        .toBe(`/assets/equipment/${c.file}`);
    }
  });
});

describe('getEquipmentCategoryIcon', () => {
  it('gives a painted tile for each arsenal family', () => {
    expect(getEquipmentCategoryIcon('WEAPON')).toBe('/assets/equipment/cat-weapon.png');
    expect(getEquipmentCategoryIcon('armor')).toBe('/assets/equipment/cat-armor.png');
    expect(getEquipmentCategoryIcon('GEAR')).toBe('/assets/equipment/cat-gear.png');
    expect(getEquipmentCategoryIcon('TOOL')).toBe('/assets/equipment/cat-tool.png');
    expect(getEquipmentCategoryIcon('MOUNT')).toBe('/assets/equipment/cat-mount.png');
    expect(getEquipmentCategoryIcon('VEHICLE')).toBe('/assets/equipment/cat-vehicle.png');
    expect(getEquipmentCategoryIcon('SERVICE')).toBe('/assets/equipment/cat-service.png');
    expect(getEquipmentCategoryIcon('unknown')).toBe('/assets/equipment/adv-backpack.png');
  });
});

describe('equipmentCardBlurb', () => {
  it('uses the JSON description instead of repeating the subtype', () => {
    expect(
      equipmentCardBlurb({
        type: 'WEAPON',
        subtype: 'martial_melee',
        data: { description: 'Fourche à trois dents, lançable.' },
      }),
    ).toBe('Fourche à trois dents, lançable.');
  });
});

describe('equipmentSubtypeLabel', () => {
  it('translates API ids in any case', () => {
    expect(equipmentSubtypeLabel('martial_melee')).toBe('Guerre (mêlée)');
    expect(equipmentSubtypeLabel('MARTIAL_MELEE')).toBe('Guerre (mêlée)');
    expect(equipmentSubtypeLabel('simple_ranged')).toBe('Courante (distance)');
  });
});

describe('resistanceLabel', () => {
  it('strips the damage- prefix and capitalizes the French label', () => {
    expect(resistanceLabel('damage-feu')).toBe('Feu');
    expect(resistanceLabel('damage-tonnerre')).toBe('Tonnerre');
    expect(resistanceLabel('damage-contondant')).toBe('Contondant');
  });

  it('falls back to the raw id when unknown', () => {
    expect(resistanceLabel('mystere')).toBe('Mystere');
  });

  it('returns falsy input unchanged', () => {
    expect(resistanceLabel('')).toBe('');
  });
});
