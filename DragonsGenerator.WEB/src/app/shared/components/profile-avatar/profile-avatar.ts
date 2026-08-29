import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { accentGradient, profileInitial } from '@core/utils/profile.util';

@Component({
  selector: 'app-profile-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-black text-white shadow-inner"
      [class]="sizeClass()"
      [ngClass]="gradient()"
    >
      @if (avatarEmoji()) {
        <iconify-icon [icon]="avatarEmoji()!" [class]="emojiClass()"></iconify-icon>
      } @else {
        {{ initial() }}
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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

  emojiClass(): string {
    switch (this.size()) {
      case 'xs':
        return 'text-base';
      case 'sm':
        return 'text-lg';
      case 'lg':
        return 'text-3xl';
      default:
        return 'text-xl';
    }
  }
}
