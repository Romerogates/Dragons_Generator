export type SupportReportCategory = 'compte' | 'bug' | 'ia' | 'campagne' | 'autre';

export function supportReportHref(opts: {
  subject: string;
  message: string;
  category?: SupportReportCategory;
  campaignId?: string | null;
  characterId?: string | null;
}): string {
  const p = new URLSearchParams();
  const subject = opts.subject.trim().slice(0, 200);
  const message = opts.message.trim().slice(0, 4000);
  if (subject) p.set('subject', subject);
  if (message) p.set('message', message);
  if (opts.category) p.set('category', opts.category);
  if (opts.campaignId) p.set('campaignId', opts.campaignId);
  if (opts.characterId) p.set('characterId', opts.characterId);
  const q = p.toString();
  return q ? `/support?${q}` : '/support';
}
