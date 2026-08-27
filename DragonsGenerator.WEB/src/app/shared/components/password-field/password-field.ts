import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <label class="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">
      {{ label }}
      <div class="relative mt-1">
        <input
          [type]="visible() ? 'text' : 'password'"
          [required]="required"
          [minlength]="minlength ?? null"
          [name]="name"
          [placeholder]="placeholder"
          [ngModel]="value"
          (ngModelChange)="valueChange.emit($event)"
          class="w-full rounded-lg bg-[#171b22] border border-slate-700 px-3 py-2.5 pr-10 text-sm text-slate-100 focus:border-amber-500 outline-none"
        />
        <button
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-amber-400 transition-colors"
          [attr.aria-label]="visible() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
          (click)="visible.set(!visible())"
        >
          <iconify-icon [icon]="visible() ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"></iconify-icon>
        </button>
      </div>
    </label>
  `,
})
export class PasswordFieldComponent {
  @Input({ required: true }) label = 'Mot de passe';
  @Input() value = '';
  @Input() name = 'password';
  @Input() placeholder = '';
  @Input() required = false;
  @Input() minlength?: number;
  @Output() valueChange = new EventEmitter<string>();

  readonly visible = signal(false);
}
