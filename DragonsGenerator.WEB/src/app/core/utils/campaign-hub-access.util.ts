/** Accès UI du hub campagne (MJ / support / spectateur) — hors Atlas. */

export function campaignIsSupportInspect(
  role: string | null | undefined,
  supportQuery: string | null | undefined,
): boolean {
  return role === 'support' || supportQuery === '1';
}

export function campaignMjUi(
  c: { isOwner: boolean; role?: string } | null | undefined,
  supportQuery: string | null | undefined,
): boolean {
  if (!c) return false;
  return c.isOwner === true || campaignIsSupportInspect(c.role, supportQuery);
}

export function campaignLoginReturnUrl(
  campaignId: string | null | undefined,
  currentUrl: string,
): string {
  if (campaignId) return `/campaigns/${campaignId}`;
  return currentUrl && currentUrl !== '/' ? currentUrl : '/campaigns';
}

export function campaignJoinUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/join/${token}`;
}

export function friendsInviteUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/friends`;
}

export function campaignJoinSharePayload(title: string, url: string): {
  title: string;
  text: string;
  url: string;
} {
  return {
    title,
    text: `Rejoins la table « ${title} » sur Dragons Generator`,
    url,
  };
}

export type ClipboardCopyResult = 'ok' | 'unavailable' | 'fail';

export type ClipboardLike = { writeText(data: string): Promise<void> };

export async function copyTextToClipboard(
  text: string,
  clipboard?: ClipboardLike | null,
): Promise<ClipboardCopyResult> {
  if (!clipboard?.writeText) return 'unavailable';
  try {
    await clipboard.writeText(text);
    return 'ok';
  } catch {
    return 'fail';
  }
}

export function clipboardCopyFeedback(
  result: ClipboardCopyResult,
  kind: 'join' | 'friends',
): string {
  if (result === 'ok') {
    return kind === 'join'
      ? 'Lien d’invitation copié — vos invités rejoignent sans être amis.'
      : 'Lien Amis copié — pour inviter un ami déjà dans votre liste.';
  }
  if (result === 'unavailable') {
    return kind === 'join' ? 'Presse-papiers indisponible.' : 'Presse-papiers indisponible.';
  }
  return 'Impossible de copier le lien.';
}

export function joinLinkShareFallbackFeedback(result: ClipboardCopyResult): string {
  if (result === 'unavailable') return 'Partage indisponible sur cet appareil.';
  return clipboardCopyFeedback(result, 'join');
}
