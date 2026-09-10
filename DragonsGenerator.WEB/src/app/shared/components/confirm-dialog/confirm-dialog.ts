import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      (click)="cancel.emit()"
    >
      <div
        class="max-w-md w-full rounded-2xl border bg-[#1b2028] shadow-2xl p-5"
        [class]="danger() ? 'border-red-900/40' : 'border-emerald-900/40'"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
      >
        <p
          [id]="titleId"
          class="text-[10px] font-black uppercase tracking-widest mb-2"
          [class]="danger() ? 'text-red-400' : 'text-emerald-400'"
        >
          {{ title() }}
        </p>
        <p class="text-sm text-slate-300 mb-4 whitespace-pre-wrap">{{ body() }}</p>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="px-3 py-2 rounded-xl text-xs font-black uppercase text-slate-400 hover:text-slate-200"
            (click)="cancel.emit()"
          >
            Annuler
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-black uppercase text-white"
            [class]="danger() ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'"
            (click)="confirm.emit()"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly confirmLabel = input('Confirmer');
  readonly danger = input(false);

  readonly cancel = output<void>();
  readonly confirm = output<void>();

  readonly titleId = `confirm-title-${Math.random().toString(36).slice(2, 9)}`;
}
