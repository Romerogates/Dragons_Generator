/** Modèles d'historiques / privilèges personnalisés réutilisables (localStorage). */

export interface CustomBackgroundTemplate {
  id: string;
  savedAt: string;
  name: string;
  privilegeName: string;
  privilegeDesc: string;
  gold: number;
  trait: string;
  ideal: string;
  bond: string;
  flaw: string;
  /** 3e compétence d'historique (sinon 2). */
  extraSkill?: boolean;
}

const STORAGE_KEY = 'dg_custom_background_templates';
const MAX_TEMPLATES = 12;

export function listCustomBackgroundTemplates(): CustomBackgroundTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomBackgroundTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomBackgroundTemplate(
  draft: Omit<CustomBackgroundTemplate, 'id' | 'savedAt'>,
): CustomBackgroundTemplate[] {
  const name = draft.name.trim() || 'Historique personnalisé';
  const list = listCustomBackgroundTemplates().filter(
    (t) => t.name.toLowerCase() !== name.toLowerCase(),
  );
  const next: CustomBackgroundTemplate = {
    ...draft,
    name,
    id: `cbg-${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
  };
  const updated = [next, ...list].slice(0, MAX_TEMPLATES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteCustomBackgroundTemplate(id: string): CustomBackgroundTemplate[] {
  const updated = listCustomBackgroundTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
