import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { CampaignSession, SessionTimelineItem, SessionTimelineKind } from '@core/models/Campaign/campaign';

@Component({
  selector: 'app-campaign-session-timeline',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './campaign-session-timeline.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignSessionTimeline {
  readonly session = input.required<CampaignSession>();
  readonly encounterNames = input<Record<string, string>>({});
  readonly timelineChange = output<SessionTimelineItem[]>();

  readonly kinds: { id: SessionTimelineKind; label: string }[] = [
    { id: 'encounter', label: 'Rencontre' },
    { id: 'break', label: 'Pause' },
    { id: 'note', label: 'Note MJ' },
    { id: 'handout', label: 'Document' },
  ];

  items(): SessionTimelineItem[] {
    return this.session().timeline ?? [];
  }

  add(kind: SessionTimelineKind): void {
    const item: SessionTimelineItem = {
      id: crypto.randomUUID?.() ?? `tl-${Date.now()}`,
      kind,
      label: kind === 'break' ? 'Pause' : kind === 'note' ? 'Note' : 'Étape',
    };
    this.timelineChange.emit([...this.items(), item]);
  }

  patch(id: string, patch: Partial<SessionTimelineItem>): void {
    this.timelineChange.emit(this.items().map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  remove(id: string): void {
    this.timelineChange.emit(this.items().filter((i) => i.id !== id));
  }

  move(id: string, dir: -1 | 1): void {
    const list = [...this.items()];
    const idx = list.findIndex((i) => i.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= list.length) return;
    [list[idx], list[next]] = [list[next], list[idx]];
    this.timelineChange.emit(list);
  }

  kindIcon(kind: SessionTimelineKind): string {
    switch (kind) {
      case 'encounter':
        return 'fluent-emoji:crossed-swords';
      case 'break':
        return 'fluent-emoji:hot-beverage';
      case 'handout':
        return 'fluent-emoji:page-facing-up';
      default:
        return 'fluent-emoji:memo';
    }
  }
}
