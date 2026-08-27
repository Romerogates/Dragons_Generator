import { environment } from '@env/environment';

/** Préfixe une URL relative API avec l'URL du backend (prod : /api via nginx). */
export function resolveApiAssetUrl(path: string | null | undefined): string {
  if (!path) return '#';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // Fichiers statiques servis directement par nginx (/uploads), pas sous /api
  if (path.startsWith('/uploads/')) return path;
  const base = environment.apiUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
