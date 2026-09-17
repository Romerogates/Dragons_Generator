import { GuideRulebookPdfService } from './guide-rulebook-pdf.service';

describe('GuideRulebookPdfService', () => {
  it('builds a PDF with cover, TOC and chapter outline', async () => {
    const service = new GuideRulebookPdfService();
    const pdf = await service.buildPdf({
      title: 'MJ à la table',
      subtitle: 'Livret de test',
      pdfFilename: 'test-mj-table.pdf',
      chapters: [
        {
          title: 'Première session',
          sections: [
            {
              title: 'Objectif',
              paragraphs: ['Jouer une soirée sans stress.'],
              bullets: ['Inviter', 'Entrer en session'],
            },
          ],
        },
        {
          title: 'Combat',
          sections: [
            {
              title: 'Initiative',
              paragraphs: ['Chacun lance 1d20 + DEX.'],
            },
          ],
        },
      ],
    });

    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(4);
    const outlineRoot = (pdf as unknown as { outline: { root: { children: unknown[] } } }).outline
      .root;
    expect(outlineRoot.children.length).toBe(2);
  });
});
