/** Deep-link `/campaigns?invite=` depuis une notification d’invitation. */

export function parseCampaignInviteQuery(invite: string | null | undefined): string | null {
  const id = invite?.trim();
  return id ? id : null;
}
