import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rollDie } from '@core/utils/combat-roll.util';

export type DiceRollPhase = 'idle' | 'rolling' | 'result';

@Component({
  selector: 'app-dice-roll',
  standalone: true,
  imports: [FormsModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="inline-flex flex-col items-start gap-1.5">
      @if (method() === 'encode') {
        <div class="flex flex-wrap items-center gap-2">
          <input
            type="number"
            [min]="1"
            [max]="faces()"
            class="w-14 min-h-9 bg-[#171b22] border border-slate-700 rounded-lg text-center text-sm text-slate-200 py-1"
            [ngModel]="encodeValue()"
            (ngModelChange)="encodeValue.set(+$event || 1)"
            [attr.aria-label]="'Encoder un d' + faces()"
          />
          <button
            type="button"
            class="min-h-9 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border border-amber-800/50 text-amber-200 hover:bg-amber-950/40 disabled:opacity-40"
            [disabled]="disabled()"
            (click)="confirmEncode()"
          >
            Valider
          </button>
        </div>
      } @else {
        <div class="flex flex-wrap items-center gap-2">
          <div
            class="dice-face relative rounded-lg border border-amber-700/60 bg-gradient-to-br from-amber-900/80 to-slate-900 flex items-center justify-center font-mono text-amber-100 shadow-inner"
            [ngClass]="[
              compact() ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm',
              phase() === 'rolling' ? 'dice-rolling' : '',
            ]"
            aria-live="polite"
          >
            {{ displayFace() }}
          </div>
          <button
            type="button"
            class="min-h-9 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border border-sky-800/50 text-sky-200 hover:bg-sky-950/40 disabled:opacity-40"
            [disabled]="disabled() || phase() === 'rolling'"
            (click)="launchDice()"
          >
            @if (phase() === 'rolling') {
              …
            } @else {
              Lancer d{{ faces() }}
            }
          </button>
        </div>
      }
      @if (phase() === 'result' && lastResult() != null && showResult()) {
        <p class="text-[10px] font-black uppercase tracking-widest text-emerald-400">
          {{ lastResult() }}
        </p>
      }
    </div>
  `,
  styles: `
    .dice-rolling {
      animation: dice-tumble 0.75s ease-in-out;
    }
    @keyframes dice-tumble {
      0% {
        transform: rotate(0deg) scale(1);
      }
      25% {
        transform: rotate(90deg) scale(1.06);
      }
      50% {
        transform: rotate(180deg) scale(0.96);
      }
      75% {
        transform: rotate(270deg) scale(1.04);
      }
      100% {
        transform: rotate(360deg) scale(1);
      }
    }
  `,
})
export class DiceRollComponent {
  readonly faces = input(20);
  /** `dice` = animation ; `encode` = saisie manuelle. */
  readonly method = input<'dice' | 'encode'>('dice');
  readonly disabled = input(false);
  readonly label = input('Jet');
  /** Version compacte pour les panneaux combat densifiés. */
  readonly compact = input(false);
  readonly showResult = input(true);

  readonly rolled = output<number>();

  readonly phase = signal<DiceRollPhase>('idle');
  readonly lastResult = signal<number | null>(null);
  readonly encodeValue = signal(10);
  readonly spinFace = signal(1);

  displayFace(): string | number {
    if (this.phase() === 'rolling') return this.spinFace();
    if (this.lastResult() != null) return this.lastResult()!;
    return `d${this.faces()}`;
  }

  launchDice(): void {
    if (this.disabled() || this.phase() === 'rolling') return;
    this.phase.set('rolling');
    const spin = setInterval(() => {
      this.spinFace.set(rollDie(this.faces()));
    }, 70);
    window.setTimeout(() => {
      clearInterval(spin);
      const result = rollDie(this.faces());
      this.lastResult.set(result);
      this.phase.set('result');
      this.rolled.emit(result);
    }, 750);
  }

  confirmEncode(): void {
    if (this.disabled()) return;
    const max = this.faces();
    const v = Math.min(max, Math.max(1, this.encodeValue() || 1));
    this.encodeValue.set(v);
    this.lastResult.set(v);
    this.phase.set('result');
    this.rolled.emit(v);
  }
}
