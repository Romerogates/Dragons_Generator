import type { jsPDF } from 'jspdf';
import { GuideRulebookPdfService } from './guide-rulebook-pdf.service';

function pdfOutlineRoot(pdf: jsPDF): { children: unknown[] } {
  if (!('outline' in pdf)) {
    throw new Error('jsPDF outline plugin missing');
  }
  const outline = pdf.outline as { root?: { children?: unknown[] } };
  return { children: outline.root?.children ?? [] };
}

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
    const outlineRoot = pdfOutlineRoot(pdf);
    expect(outlineRoot.children.length).toBe(2);
  });
});
