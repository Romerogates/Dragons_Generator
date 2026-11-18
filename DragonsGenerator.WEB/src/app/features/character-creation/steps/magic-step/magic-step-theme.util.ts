import { spellSchoolKey } from '@core/utils/magic-spell-filter.util';

export function magicCardClasses(school: string, isSelected: boolean): string {
  if (!isSelected) return 'border-slate-800 hover:border-slate-600 shadow-md';
  switch (spellSchoolKey(school)) {
    case 'abjuration':
      return 'border-2 border-cyan-500';
    case 'conjuration':
    case 'invocation':
      return 'border-2 border-yellow-500';
    case 'divination':
      return 'border-2 border-indigo-500';
    case 'enchantement':
      return 'border-2 border-fuchsia-500';
    case 'evocation':
      return 'border-2 border-red-500';
    case 'illusion':
      return 'border-2 border-purple-500';
    case 'necromancie':
      return 'border-2 border-lime-500';
    case 'transmutation':
      return 'border-2 border-orange-500';
    default:
      return 'border-2 border-slate-500';
  }
}

export function magicTextClasses(school: string, isSelected: boolean): string {
  if (!isSelected) return 'text-slate-300 group-hover:text-slate-100';
  switch (spellSchoolKey(school)) {
    case 'abjuration':
      return 'text-cyan-400';
    case 'conjuration':
    case 'invocation':
      return 'text-yellow-400';
    case 'divination':
      return 'text-indigo-400';
    case 'enchantement':
      return 'text-fuchsia-400';
    case 'evocation':
      return 'text-red-400';
    case 'illusion':
      return 'text-purple-400';
    case 'necromancie':
      return 'text-lime-400';
    case 'transmutation':
      return 'text-orange-400';
    default:
      return 'text-slate-200';
  }
}

export function magicBadgeClasses(school: string): string {
  switch (spellSchoolKey(school)) {
    case 'abjuration':
      return 'bg-cyan-950/30 text-cyan-500 border-cyan-900/50';
    case 'conjuration':
    case 'invocation':
      return 'bg-yellow-950/30 text-yellow-500 border-yellow-900/50';
    case 'divination':
      return 'bg-indigo-950/30 text-indigo-400 border-indigo-900/50';
    case 'enchantement':
      return 'bg-fuchsia-950/30 text-fuchsia-400 border-fuchsia-900/50';
    case 'evocation':
      return 'bg-red-950/30 text-red-500 border-red-900/50';
    case 'illusion':
      return 'bg-purple-950/30 text-purple-400 border-purple-900/50';
    case 'necromancie':
      return 'bg-lime-950/30 text-lime-500 border-lime-900/50';
    case 'transmutation':
      return 'bg-orange-950/30 text-orange-500 border-orange-900/50';
    default:
      return 'bg-slate-900 text-slate-400 border-slate-700';
  }
}

export function magicCheckboxClasses(school: string, isSelected: boolean): string {
  if (!isSelected)
    return 'border-slate-700 group-hover:border-slate-500 bg-[#1b2028] text-transparent';
  switch (spellSchoolKey(school)) {
    case 'abjuration':
      return 'border-cyan-500 bg-cyan-950/50 text-cyan-400';
    case 'conjuration':
    case 'invocation':
      return 'border-yellow-500 bg-yellow-950/50 text-yellow-500';
    case 'divination':
      return 'border-indigo-500 bg-indigo-950/50 text-indigo-400';
    case 'enchantement':
      return 'border-fuchsia-500 bg-fuchsia-950/50 text-fuchsia-400';
    case 'evocation':
      return 'border-red-500 bg-red-950/50 text-red-500';
    case 'illusion':
      return 'border-purple-500 bg-purple-950/50 text-purple-400';
    case 'necromancie':
      return 'border-lime-500 bg-lime-950/50 text-lime-500';
    case 'transmutation':
      return 'border-orange-500 bg-orange-950/50 text-orange-500';
    default:
      return 'border-slate-500 bg-slate-800 text-slate-200';
  }
}
