import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { accentGradient, profileInitial } from '@core/utils/profile.util';
import { CodexGlyph } from '@shared/components/codex-glyph/codex-glyph';

@Component({
  selector: 'app-profile-avatar',
  standalone: true,
  imports: [CommonModule, CodexGlyph],
  template: `
    <span
      class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-black text-white shadow-inner"
      [class]="sizeClass()"
      [ngClass]="gradient()"
    >
      @if (avatarEmoji()) {
        <app-codex-glyph [icon]="avatarEmoji()!" [size]="glyphSize()" [alt]="displayName()" />
      } @else {
        {{ initial() }}
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileAvatarComponent {
  readonly displayName = input.required<string>();
  readonly avatarEmoji = input<string | null | undefined>(null);
  readonly accentColor = input<string | null | undefined>(null);
  readonly size = input<'xs' | 'sm' | 'md' | 'lg'>('md');

  gradient(): string {
    return accentGradient(this.accentColor());
  }

  initial(): string {
    return profileInitial(this.displayName());
  }

  sizeClass(): string {
    switch (this.size()) {
      case 'xs':
        return 'w-7 h-7 text-[10px]';
      case 'sm':
        return 'w-9 h-9 text-xs';
      case 'lg':
        return 'w-16 h-16 text-2xl';
      default:
        return 'w-11 h-11 text-sm';
    }
  }

  glyphSize(): string {
    switch (this.size()) {
      case 'xs':
        return '1.35rem';
      case 'sm':
        return '1.7rem';
      case 'lg':
        return '3.25rem';
      default:
        return '2.15rem';
    }
  }
}
