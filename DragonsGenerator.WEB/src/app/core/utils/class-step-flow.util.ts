/** Machine de phases / picks du wizard classe — hors Atlas. */

export type ClassStepPhase = 'class' | 'subclass' | 'combat_style' | 'sub_choice' | 'prog_choice';

export function resolveClassStepPhase(input: {
  holdPhase: ClassStepPhase | null;
  classId: string | null;
  subclassId: string | null;
  requiresSubclass: boolean;
  requiresCombatStyle: boolean;
  selectedStyleCount: number;
  requiredStyleCount: number;
  hasUnresolvedSubChoice: boolean;
  hasUnresolvedProgChoice: boolean;
  focusedProgChoice: boolean;
}): ClassStepPhase {
  if (input.holdPhase) return input.holdPhase;
  if (!input.classId) return 'class';
  if (input.requiresCombatStyle && input.selectedStyleCount === 0) return 'combat_style';
  if (input.requiresSubclass && !input.subclassId) return 'subclass';
  if (input.requiresCombatStyle && input.selectedStyleCount < input.requiredStyleCount) {
    return 'combat_style';
  }
  if (input.hasUnresolvedSubChoice) return 'sub_choice';
  if (input.hasUnresolvedProgChoice) return 'prog_choice';
  if (input.focusedProgChoice) return 'prog_choice';
  if (input.requiresSubclass && input.subclassId) return 'subclass';
  if (input.requiresCombatStyle) return 'combat_style';
  return 'class';
}

export function classStepSelectionComplete(input: {
  hasClass: boolean;
  requiresCombatStyle: boolean;
  combatStylesComplete: boolean;
  requiresSubclass: boolean;
  hasSubclass: boolean;
  unresolvedSubChoice: boolean;
  unresolvedProgChoice: boolean;
}): boolean {
  if (!input.hasClass) return false;
  if (input.requiresCombatStyle && !input.combatStylesComplete) return false;
  if (input.requiresSubclass && !input.hasSubclass) return false;
  if (input.unresolvedSubChoice || input.unresolvedProgChoice) return false;
  return true;
}

/** Ajoute / retire un id dans une liste plafonnée (styles, sous-choix, prog). */
export function toggleCappedPick(prev: string[], id: string, need: number): string[] {
  const next = [...prev];
  const idx = next.indexOf(id);
  if (idx >= 0) {
    next.splice(idx, 1);
    return next;
  }
  if (need <= 1) return [id];
  if (next.length < need) return [...next, id];
  next.shift();
  next.push(id);
  return next;
}

export function wrapCarouselIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

export function classStepCarouselTargetId(input: {
  phase: ClassStepPhase;
  classId: string | null;
  subclassId: string | null;
  combatStyleIds: string[];
  subChoiceLastPick: string | null;
  progChoiceLastPick: string | null;
}): string | null {
  switch (input.phase) {
    case 'class':
      return input.classId;
    case 'subclass':
      return input.subclassId ?? input.classId;
    case 'combat_style':
      return input.combatStyleIds[input.combatStyleIds.length - 1] ?? null;
    case 'sub_choice':
      return input.subChoiceLastPick;
    case 'prog_choice':
      return input.progChoiceLastPick;
    default:
      return input.classId;
  }
}

export function splitClassChoiceAnswers(
  answers: Record<string, string[] | undefined>,
  subChoiceIds: Set<string>,
): { sub: Map<string, string[]>; prog: Map<string, string[]> } {
  const prog = new Map<string, string[]>();
  const sub = new Map<string, string[]>();
  for (const [k, v] of Object.entries(answers)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    if (subChoiceIds.has(k)) sub.set(k, v);
    else prog.set(k, v);
  }
  return { sub, prog };
}

export function classStepPhaseTitle(opts: {
  phase: ClassStepPhase;
  subclassConfigName?: string | null;
  subChoiceLabel?: string | null;
  subChoicePicked?: number;
  subChoiceNeed?: number;
  progChoiceLabel?: string | null;
  progChoicePicked?: number;
  progChoiceNeed?: number;
}): string {
  switch (opts.phase) {
    case 'class':
      return 'La Vocation';
    case 'subclass':
      return opts.subclassConfigName ?? 'Spécialisation';
    case 'combat_style':
      return 'Style de Combat';
    case 'sub_choice': {
      const label = opts.subChoiceLabel;
      if (!label) return 'Faites votre choix';
      const need = opts.subChoiceNeed || 1;
      const picked = opts.subChoicePicked ?? 0;
      return need > 1 ? `${label} (${picked}/${need})` : label;
    }
    case 'prog_choice': {
      const label = opts.progChoiceLabel;
      if (!label) return 'Faites votre choix';
      const need = opts.progChoiceNeed || 1;
      const picked = opts.progChoicePicked ?? 0;
      return need > 1 ? `${label} (${picked}/${need})` : label;
    }
  }
}

export function classStepPhaseSubtitle(opts: {
  phase: ClassStepPhase;
  className?: string | null;
  combatStyleNeed?: number;
  combatStylePicked?: number;
}): string {
  switch (opts.phase) {
    case 'class':
      return 'Choisissez la classe qui dictera vos talents et votre destinée.';
    case 'subclass':
      return `Affinez les pouvoirs de votre ${opts.className ?? ''}.`;
    case 'combat_style':
      return (opts.combatStyleNeed ?? 0) > 1
        ? `Choisissez ${opts.combatStyleNeed} styles (${opts.combatStylePicked ?? 0}/${opts.combatStyleNeed}).`
        : 'Sélectionnez votre approche martiale de prédilection.';
    case 'sub_choice':
      return 'Cette option personnalisera les aptitudes de votre sous-classe.';
    case 'prog_choice':
      return 'Choisissez les options de progression débloquées par votre classe.';
  }
}
