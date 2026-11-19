import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { isPaintedAssetPath, resolvePaintedIcon } from '@core/utils/painted-icon.util';

/** Iconify id or `/assets/…` portrait. */
@Component({
  selector: 'app-codex-glyph',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center justify-center leading-none' },
  template: `
    @if (asset()) {
      <img
        [src]="resolved()"
        [alt]="alt()"
        class="object-contain pointer-events-none bg-transparent"
        [style.width]="size()"
        [style.height]="size()"
      />
    } @else {
      <iconify-icon [icon]="icon()" [attr.width]="size()" [attr.height]="size()"></iconify-icon>
    }
  `,
})
export class CodexGlyph {
  readonly icon = input.required<string>();
  readonly alt = input('');
  readonly size = input('1em');
  readonly resolved = computed(() => resolvePaintedIcon(this.icon()));
  readonly asset = computed(() => isPaintedAssetPath(this.resolved()));
}
