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
});

describe('getEquipmentCategoryIcon', () => {
  it('gives a painted tile for each arsenal family', () => {
    expect(getEquipmentCategoryIcon('WEAPON')).toBe('/assets/equipment/cat-weapon.png');
    expect(getEquipmentCategoryIcon('armor')).toBe('/assets/equipment/cat-armor.png');
    expect(getEquipmentCategoryIcon('GEAR')).toBe('/assets/equipment/cat-gear.png');
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
