import { createCampaignHandout, type CampaignSession } from '@core/models/Campaign/campaign';
import {
  exportEveningPdf,
  exportUnifiedEveningPack,
  renderEveningPdf,
} from './evening-pdf.util';

function session(over: Partial<CampaignSession> = {}): CampaignSession {
  return {
    id: 's1',
    title: 'Soirée 1',
    scheduledAt: '2026-01-15T20:00:00Z',
    status: 'planned',
    ...over,
  };
}

describe('evening-pdf.util', () => {
  it('rend un PDF soirée minimal', async () => {
    const rendered = await renderEveningPdf(
      '',
      session({ title: '', scheduledAt: '', objectives: '', scenes: '', prepChecklist: '' }),
      [],
    );
    expect(rendered.filename).toBe('campagne-soiree.pdf');
    expect(typeof rendered.save).toBe('function');
  });

  it('ignore une date invalide et saute le récap vide', async () => {
    const rendered = await renderEveningPdf(
      'Hub',
      session({ scheduledAt: 'not-a-date', playerRecap: '   ' }),
      [],
    );
    expect(rendered.filename).toBe('Hub-soiree.pdf');
  });

  it('ignore une date qui throw', async () => {
    const rendered = await renderEveningPdf(
      'Hub',
      session({
        scheduledAt: {
          toString() {
            throw new Error('bad-date');
          },
        } as unknown as string,
      }),
      [],
    );
    expect(rendered.filename).toBe('Hub-soiree.pdf');
  });

  it('ajoute le pack prépa et les documents publiés', async () => {
    const published = createCampaignHandout('');
    published.published = true;
    published.body = 'Note joueur';
    const draft = createCampaignHandout('Brouillon');
    const rendered = await renderEveningPdf(
      'Les Dragons',
      session({
        objectives: 'Trouver l’artefact',
        scenes: 'Taverne',
        prepChecklist: 'Dés',
        playerRecap: 'Vous arrivez au village.',
      }),
      [published, draft],
      {
        adventureSynopsis: '  Une quête  ',
        encounterNames: ['Gobelins'],
        creatureNames: ['Grib'],
        playerNames: ['Lila'],
      },
    );
    expect(rendered.filename).toBe('Les_Dragons-pack-soiree.pdf');
  });

  it('garde le suffixe pack si extras est vide', async () => {
    const rendered = await renderEveningPdf('Hub', session(), [], {});
    expect(rendered.filename).toBe('Hub-pack-soiree.pdf');
  });

  it('rend chaque bloc extras isolément', async () => {
    expect((await renderEveningPdf('Hub', session(), [], { adventureSynopsis: 'S' })).filename).toBe(
      'Hub-pack-soiree.pdf',
    );
    expect((await renderEveningPdf('Hub', session(), [], { encounterNames: ['A'] })).filename).toBe(
      'Hub-pack-soiree.pdf',
    );
    expect((await renderEveningPdf('Hub', session(), [], { creatureNames: ['G'] })).filename).toBe(
      'Hub-pack-soiree.pdf',
    );
  });

  it('pagine un texte long via ensureSpace', async () => {
    const huge = Array.from({ length: 80 }, (_, i) => `Paragraphe ${i} ${'lorem '.repeat(20)}`).join(
      '\n',
    );
    const rendered = await renderEveningPdf('Hub', session({ playerRecap: huge, objectives: huge }), []);
    expect(rendered.filename).toBe('Hub-soiree.pdf');
  });

  it('exportEveningPdf et exportUnifiedEveningPack exposent le même rendu', async () => {
    const rendered = await renderEveningPdf('Hub', session(), [], { playerNames: ['Lila'] });
    expect(rendered.filename).toBe('Hub-pack-soiree.pdf');
    expect(exportEveningPdf).toBeDefined();
    expect(exportUnifiedEveningPack).toBeDefined();
  });
});
