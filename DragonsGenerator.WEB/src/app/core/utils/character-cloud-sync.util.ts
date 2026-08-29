import { HttpErrorResponse } from '@angular/common/http';

export function formatCharacterCloudLoadError(name: string, err: unknown): string {
  const label = `Personnage « ${name.trim() || 'sans nom'} »`;
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return `${label} : serveur inaccessible.`;
    }
    if (err.status === 401 || err.status === 403) {
      return `${label} : session expirée ou droits insuffisants.`;
    }
    const reason = extractHttpErrorMessage(err);
    if (reason) {
      return `${label} : ${reason}.`;
    }
    return `${label} : erreur ${err.status}.`;
  }
  return `${label} : échec du chargement.`;
}

export function formatCharacterCloudListError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'Impossible de lister vos personnages cloud : serveur inaccessible.';
    }
    if (err.status === 401 || err.status === 403) {
      return 'Impossible de lister vos personnages cloud : reconnectez-vous.';
    }
    const reason = extractHttpErrorMessage(err);
    if (reason) {
      return `Impossible de lister vos personnages cloud : ${reason}.`;
    }
    return `Impossible de lister vos personnages cloud (erreur ${err.status}).`;
  }
  return 'Impossible de lister vos personnages cloud.';
}

export function formatCharacterCloudSyncSummary(errors: string[]): string {
  if (errors.length === 1) {
    return errors[0];
  }
  return `${errors.length} personnages n'ont pas pu être chargés depuis le cloud : ${errors.join(' · ')}`;
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
