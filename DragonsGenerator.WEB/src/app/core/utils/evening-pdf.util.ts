import type { CampaignHandout, CampaignSession } from '@core/models/Campaign/campaign';

/** Export PDF « soirée » : run sheet + documents publiés. */
export async function exportEveningPdf(
  campaignTitle: string,
  session: CampaignSession,
  handouts: CampaignHandout[],
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (need: number) => {
    if (y + need > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, fontSize: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text || '—', maxW) as string[];
    for (const line of lines) {
      ensureSpace(fontSize + 6);
      doc.text(line, margin, y);
      y += fontSize + 4;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(campaignTitle || 'Campagne', margin, y);
  y += 22;
  writeWrapped(session.title?.trim() || 'Session', 13, 'bold');
  if (session.scheduledAt) {
    try {
      const d = new Date(session.scheduledAt);
      if (!Number.isNaN(d.getTime())) {
        writeWrapped(d.toLocaleString('fr-FR'), 10);
      }
    } catch {
      /* ignore */
    }
  }
  y += 8;

  writeWrapped('Objectifs', 12, 'bold');
  writeWrapped(session.objectives?.trim() || '(aucun)', 10);
  y += 6;
  writeWrapped('Scènes', 12, 'bold');
  writeWrapped(session.scenes?.trim() || '(aucune)', 10);
  y += 6;
  writeWrapped('Checklist', 12, 'bold');
  writeWrapped(session.prepChecklist?.trim() || '(vide)', 10);
  y += 6;
  if (session.playerRecap?.trim()) {
    writeWrapped('Récap joueurs', 12, 'bold');
    writeWrapped(session.playerRecap.trim(), 10);
  }

  const published = handouts.filter((h) => h.published);
  for (const h of published) {
    doc.addPage();
    y = margin;
    writeWrapped(h.title?.trim() || 'Document', 14, 'bold');
    y += 4;
    writeWrapped(h.body?.trim() || '(vide)', 10);
  }

  const safe = (campaignTitle || 'campagne').replace(/[^\w-]+/g, '_').slice(0, 40);
  doc.save(`${safe}-soiree.pdf`);
}
