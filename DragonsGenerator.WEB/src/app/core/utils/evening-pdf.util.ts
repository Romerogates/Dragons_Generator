import type { CampaignHandout, CampaignSession } from '@core/models/Campaign/campaign';
import { handoutPlayerBody } from '@core/models/Campaign/campaign';

export interface EveningPackExtras {
  adventureSynopsis?: string;
  encounterNames?: string[];
  creatureNames?: string[];
  playerNames?: string[];
}

/** Construit le PDF soirée (sans déclencher le téléchargement). */
export async function renderEveningPdf(
  campaignTitle: string,
  session: CampaignSession,
  handouts: CampaignHandout[],
  extras?: EveningPackExtras,
): Promise<{ filename: string; save: () => void }> {
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

  if (
    extras &&
    (extras.adventureSynopsis?.trim() ||
      extras.encounterNames?.length ||
      extras.creatureNames?.length ||
      extras.playerNames?.length)
  ) {
    doc.addPage();
    y = margin;
    writeWrapped('Pack table (prépa)', 14, 'bold');
    y += 4;
    if (extras.playerNames?.length) {
      writeWrapped('Joueurs', 12, 'bold');
      writeWrapped(extras.playerNames.join(', '), 10);
      y += 4;
    }
    if (extras.adventureSynopsis?.trim()) {
      writeWrapped('Synopsis', 12, 'bold');
      writeWrapped(extras.adventureSynopsis.trim().slice(0, 1200), 10);
      y += 4;
    }
    if (extras.encounterNames?.length) {
      writeWrapped('Rencontres', 12, 'bold');
      writeWrapped(extras.encounterNames.map((n, i) => `${i + 1}. ${n}`).join('\n'), 10);
      y += 4;
    }
    if (extras.creatureNames?.length) {
      writeWrapped('Créatures', 12, 'bold');
      writeWrapped(extras.creatureNames.join(', '), 10);
    }
  }

  const published = handouts.filter((h) => h.published);
  for (const h of published) {
    doc.addPage();
    y = margin;
    writeWrapped(h.title?.trim() || 'Document', 14, 'bold');
    y += 4;
    writeWrapped(handoutPlayerBody(h).trim() || '(vide)', 10);
  }

  const safe = (campaignTitle || 'campagne').replace(/[^\w-]+/g, '_').slice(0, 40);
  const suffix = extras ? 'pack-soiree' : 'soiree';
  const filename = `${safe}-${suffix}.pdf`;
  return { filename, save: () => doc.save(filename) };
}

/** Export PDF « soirée » : run sheet + documents publiés (+ prépa optionnelle). */
export async function exportEveningPdf(
  campaignTitle: string,
  session: CampaignSession,
  handouts: CampaignHandout[],
  extras?: EveningPackExtras,
): Promise<void> {
  const rendered = await renderEveningPdf(campaignTitle, session, handouts, extras);
  rendered.save();
}

/** Pack soirée unifié = run sheet + prépa + docs publiés. */
export async function exportUnifiedEveningPack(
  campaignTitle: string,
  session: CampaignSession,
  handouts: CampaignHandout[],
  extras: EveningPackExtras,
): Promise<void> {
  await exportEveningPdf(campaignTitle, session, handouts, extras);
}
