import { HttpErrorResponse } from '@angular/common/http';

export type OfflineSyncQueueItemType = 'character-save' | 'campaign-create' | 'campaign-update';

export interface OfflineSyncErrorContext {
  type: OfflineSyncQueueItemType;
  name?: string | null;
  title?: string;
}

export function offlineSyncItemLabel(ctx: OfflineSyncErrorContext): string {
  switch (ctx.type) {
    case 'character-save':
      return `Personnage « ${ctx.name?.trim() || 'sans nom'} »`;
    case 'campaign-create':
      return `Campagne « ${ctx.title ?? 'sans titre'} » (création)`;
    case 'campaign-update':
      return `Campagne « ${ctx.title ?? 'sans titre'} » (mise à jour)`;
  }
}

export function formatOfflineSyncError(ctx: OfflineSyncErrorContext, err: unknown): string {
  const label = offlineSyncItemLabel(ctx);
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return `${label} : serveur inaccessible. Nouvel essai automatique au retour du réseau.`;
    }
    if (err.status === 401 || err.status === 403) {
      return `${label} : session expirée ou droits insuffisants. Reconnectez-vous puis relancez la sync.`;
    }
    const reason = extractHttpErrorMessage(err);
    if (reason) {
      return `${label} : ${reason} (élément conservé en file d'attente).`;
    }
    return `${label} : erreur ${err.status} (élément conservé en file d'attente).`;
  }
  return `${label} : échec de synchronisation (élément conservé en file d'attente).`;
}

function extractHttpErrorMessage(err: HttpErrorResponse): string | null {
  const body = err.error as
    | { errors?: { reason?: string }[] | Record<string, string[]>; message?: string }
    | undefined;
  if (Array.isArray(body?.errors) && body.errors[0]?.reason) {
    return body.errors[0].reason;
  }
  if (body?.message) return body.message;
  return null;
}
